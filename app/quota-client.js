import {EventEmitter} from 'node:events';
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import {toWidgetState} from './quota-format.js';

export function locateCodex() {
  if (process.platform === 'win32') {
    const lookup = spawnSync('where.exe', ['codex.exe'], {encoding: 'utf8', windowsHide: true});
    const first = lookup.stdout?.split(/\r?\n/).find((value) => value.trim());
    if (first && fs.existsSync(first.trim())) return first.trim();
    const binRoot = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'OpenAI', 'Codex', 'bin');
    if (binRoot && fs.existsSync(binRoot)) {
      const candidates = fs
        .readdirSync(binRoot, {withFileTypes: true})
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(binRoot, entry.name, 'codex.exe'))
        .filter(fs.existsSync)
        .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
      if (candidates[0]) return candidates[0];
    }
  }
  return null;
}

export class QuotaClient extends EventEmitter {
  #child = null;
  #ready = false;
  #pending = null;
  #sequence = 20;
  #timer = null;
  #failed = false;
  #stopping = false;
  #spawnProcess;
  #requestTimeoutMs;

  constructor({spawnProcess = spawn, requestTimeoutMs = 10_000} = {}) {
    super();
    this.#spawnProcess = spawnProcess;
    this.#requestTimeoutMs = requestTimeoutMs;
  }

  start(executable) {
    if (this.#child) return;
    this.#failed = false;
    this.#stopping = false;
    try {
      this.#child = this.#spawnProcess(executable, ['app-server'], {
        cwd: os.homedir(),
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'ignore']
      });
    } catch (error) {
      this.#fail('start', errorCode(error));
      return;
    }
    this.#child.once('error', (error) => this.#fail('start', errorCode(error)));
    this.#child.once('exit', () => {
      if (!this.#stopping) this.#fail('exit');
    });
    const output = readline.createInterface({input: this.#child.stdout, crlfDelay: Infinity});
    output.on('line', (line) => this.#receive(line));
    this.#write({id: 1, method: 'initialize', params: {clientInfo: {name: 'codex_quota_dashboard', version: '1.0.8'}}});
    if (!this.#failed) this.#armTimeout('initialize-timeout');
  }

  refresh() {
    if (!this.#ready || this.#pending !== null) return false;
    this.#pending = ++this.#sequence;
    this.#write({id: this.#pending, method: 'account/rateLimits/read'});
    if (!this.#failed) this.#armTimeout('read-timeout');
    return true;
  }

  stop() {
    this.#stopping = true;
    this.#clearTimeout();
    this.#child?.kill();
    this.#child = null;
    this.#ready = false;
    this.#pending = null;
  }

  #receive(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (message.id === 1) {
      this.#clearTimeout();
      if (message.error) {
        this.#fail('initialize', errorCode(message.error));
        return;
      }
      this.#ready = true;
      this.#write({method: 'initialized', params: {}});
      this.refresh();
      return;
    }
    if (message.method === 'account/updated') {
      this.emit('account-changed');
      return;
    }
    if (message.method === 'account/rateLimits/updated') {
      this.refresh();
      return;
    }
    if (message.id !== this.#pending) return;
    this.#clearTimeout();
    this.#pending = null;
    if (message.error) {
      this.#fail('read', errorCode(message.error));
      return;
    }
    const state = toWidgetState(message.result);
    if (state.fiveHour.remaining === null && state.weekly.remaining === null) {
      this.#fail('invalid-response');
      return;
    }
    const missingResets = [];
    if (state.fiveHour.reset === '时间未知') missingResets.push('primary');
    if (state.weekly.reset === '时间未知') missingResets.push('secondary');
    if (missingResets.length) this.emit('diagnostic', {code: 'missing-reset', windows: missingResets.join(',')});
    this.emit('quota', state);
  }

  #write(message) {
    try {
      this.#child?.stdin.write(`${JSON.stringify(message)}\n`);
    } catch (error) {
      this.#fail('write', errorCode(error));
    }
  }

  #armTimeout(code) {
    this.#clearTimeout();
    this.#timer = setTimeout(() => this.#fail(code), this.#requestTimeoutMs);
    this.#timer.unref?.();
  }

  #clearTimeout() {
    clearTimeout(this.#timer);
    this.#timer = null;
  }

  #fail(code, detail) {
    if (this.#failed || this.#stopping) return;
    this.#failed = true;
    this.#clearTimeout();
    this.#ready = false;
    this.#pending = null;
    const child = this.#child;
    this.#child = null;
    if (child?.exitCode === null) child.kill();
    this.emit('offline', {code, detail});
  }
}

function errorCode(error) {
  if (error && typeof error === 'object' && 'code' in error) return String(error.code);
  return error instanceof Error ? error.name : undefined;
}
