import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter, once} from 'node:events';
import {PassThrough} from 'node:stream';
import {QuotaClient} from '../app/quota-client.js';

class FakeProcess extends EventEmitter {
  constructor() {
    super();
    this.exitCode = null;
    this.stdout = new PassThrough();
    this.messages = [];
    this.stdin = {write: (line) => this.messages.push(JSON.parse(line))};
    this.killed = false;
  }

  kill() {
    this.killed = true;
    this.exitCode = 0;
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test('reads quota after initialization and uses a populated keyed limit', async () => {
  const process = new FakeProcess();
  const client = new QuotaClient({spawnProcess: () => process, requestTimeoutMs: 1000});
  client.start('codex.exe');
  assert.equal(process.messages[0].method, 'initialize');
  process.stdout.write(`${JSON.stringify({id: 1, result: {}})}\n`);
  await flush();
  const request = process.messages.find((message) => message.method === 'account/rateLimits/read');
  const quota = once(client, 'quota');
  process.stdout.write(`${JSON.stringify({
    id: request.id,
    result: {
      rateLimits: {},
      rateLimitsByLimitId: {
        codex: {
          primary: {usedPercent: 20, resetsAt: 1_788_000_000},
          secondary: {usedPercent: 40, resetsAt: 1_788_600_000}
        }
      }
    }
  })}\n`);
  const [state] = await quota;
  assert.equal(state.fiveHour.remaining, 80);
  assert.equal(state.weekly.remaining, 60);

  const accountChanged = once(client, 'account-changed');
  process.stdout.write(`${JSON.stringify({method: 'account/updated', params: {authMode: 'chatgpt'}})}\n`);
  await accountChanged;
  client.stop();
});

test('reports a read failure and closes the stale app-server process', async () => {
  const process = new FakeProcess();
  const client = new QuotaClient({spawnProcess: () => process, requestTimeoutMs: 1000});
  client.start('codex.exe');
  process.stdout.write(`${JSON.stringify({id: 1, result: {}})}\n`);
  await flush();
  const request = process.messages.find((message) => message.method === 'account/rateLimits/read');
  const offline = once(client, 'offline');
  process.stdout.write(`${JSON.stringify({id: request.id, error: {code: -32000}})}\n`);
  assert.deepEqual(await offline, [{code: 'read', detail: '-32000'}]);
  assert.equal(process.killed, true);
});

test('times out initialization so the caller can reconnect', async () => {
  const process = new FakeProcess();
  const client = new QuotaClient({spawnProcess: () => process, requestTimeoutMs: 20});
  client.start('codex.exe');
  const outcome = await Promise.race([
    once(client, 'offline'),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout event was not emitted')), 200))
  ]);
  assert.deepEqual(outcome, [{code: 'initialize-timeout', detail: undefined}]);
  assert.equal(process.killed, true);
});
