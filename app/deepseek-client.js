import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import {toDeepSeekWidgetState} from './quota-format.js';

const defaultEndpoint = 'https://api.deepseek.com/user/balance';
const timeoutMs = 8000;

export class DeepSeekClient extends EventEmitter {
  #pending = false;
  #configDir;

  constructor(configDir) {
    super();
    this.#configDir = configDir;
  }

  refresh() {
    if (this.#pending) return false;
    this.#pending = true;
    this.#readBalance()
      .then((state) => this.emit('balance', state))
      .catch((error) => this.emit('balance', toDeepSeekWidgetState(null, {error})))
      .finally(() => {
        this.#pending = false;
      });
    return true;
  }

  async #readBalance() {
    const config = this.#readConfig();
    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_KEY || config.apiKey;
    if (!apiKey) return toDeepSeekWidgetState(null, {missingKey: true});

    const base = (process.env.DEEPSEEK_API_BASE_URL || process.env.DEEPSEEK_BASE_URL || config.baseUrl || '').trim().replace(/\/+$/, '');
    const endpoint = base ? `${base}/user/balance` : defaultEndpoint;
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {Authorization: `Bearer ${apiKey}`},
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) throw new Error(`DeepSeek balance failed with HTTP ${response.status}`);
    return toDeepSeekWidgetState(await response.json());
  }

  #readConfig() {
    try {
      const file = path.join(this.#configDir, 'deepseek.json');
      const config = JSON.parse(fs.readFileSync(file, 'utf8'));
      return {
        apiKey: typeof config.apiKey === 'string' ? config.apiKey.trim() : '',
        baseUrl: typeof config.baseUrl === 'string' ? config.baseUrl.trim() : ''
      };
    } catch {
      return {};
    }
  }
}
