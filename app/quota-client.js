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

  start(executable) {
    if (this.#child) return;
    this.#child = spawn(executable, ['app-server'], {
      cwd: os.homedir(),
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'ignore']
    });
    this.#child.once('error', () => this.emit('offline'));
    this.#child.once('exit', () => {
      this.#child = null;
      this.#ready = false;
      this.#pending = null;
      this.emit('offline');
    });
    const output = readline.createInterface({input: this.#child.stdout, crlfDelay: Infinity});
    output.on('line', (line) => this.#receive(line));
    this.#write({id: 1, method: 'initialize', params: {clientInfo: {name: 'codex_quota_dashboard', version: '1.0.4'}}});
  }

  refresh() {
    if (!this.#ready || this.#pending !== null) return false;
    this.#pending = ++this.#sequence;
    this.#write({id: this.#pending, method: 'account/rateLimits/read'});
    return true;
  }

  stop() {
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
    if (message.id === 1 && !message.error) {
      this.#ready = true;
      this.#write({method: 'initialized', params: {}});
      this.refresh();
      return;
    }
    if (message.id !== this.#pending) return;
    this.#pending = null;
    if (message.error) this.emit('offline');
    else this.emit('quota', toWidgetState(message.result));
  }

  #write(message) {
    this.#child?.stdin.write(`${JSON.stringify(message)}\n`);
  }
}
