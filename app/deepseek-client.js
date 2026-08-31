import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import {toDeepSeekWidgetState} from './quota-format.js';

const defaultEndpoint = 'https://api.deepseek.com/user/balance';
const usageEndpoint = 'https://platform.deepseek.com/api/v0/usage/cost';
const timeoutMs = 8000;
const usageEveryMs = 60_000;

export function parseTodayCost(payload, now = new Date()) {
  const bizData = Array.isArray(payload?.data?.biz_data) ? payload.data.biz_data : [];
  const days = bizData[0]?.days;
  if (!Array.isArray(days)) return null;
  const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const day = days.find((item) => item?.date === dateKey);
  if (!day) return null;
  let total = 0;
  for (const model of Array.isArray(day.data) ? day.data : []) {
    for (const item of Array.isArray(model?.usage) ? model.usage : []) {
      const type = String(item?.type || '').toUpperCase();
      if (type === 'REQUEST') continue;
      const amount = Number(item?.amount);
      if (Number.isFinite(amount)) total += amount;
    }
  }
  return total;
}

export class DeepSeekClient extends EventEmitter {
  #pending = false;
  #configFiles;
  #usageAt = 0;
  #usageState = {configured: false, spent: null};

  constructor(configFiles) {
    super();
    this.#configFiles = Array.isArray(configFiles) ? configFiles : [];
  }

  refresh(forceUsage = false) {
    if (this.#pending) return false;
    this.#pending = true;
    this.#refresh(forceUsage)
      .then((state) => this.emit('balance', state))
      .catch((error) => this.emit('balance', toDeepSeekWidgetState(null, {error})))
      .finally(() => {
        this.#pending = false;
      });
    return true;
  }

  async #refresh(forceUsage) {
    const config = this.#readConfig();
    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_KEY || config.apiKey;
    if (!apiKey) return toDeepSeekWidgetState(null, {missingKey: true});
    const [balance, usage] = await Promise.all([
      this.#fetchBalance(config, apiKey),
      this.#readUsage(forceUsage)
    ]);
    return toDeepSeekWidgetState(balance, {
      todaySpent: usage.spent,
      usageConfigured: usage.configured
    });
  }

  async #fetchBalance(config, apiKey) {
    const base = (process.env.DEEPSEEK_API_BASE_URL || process.env.DEEPSEEK_BASE_URL || config.baseUrl || '').trim().replace(/\/+$/, '');
    const endpoint = base ? `${base}/user/balance` : defaultEndpoint;
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {Authorization: `Bearer ${apiKey}`},
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) throw new Error(`DeepSeek balance failed with HTTP ${response.status}`);
    return await response.json();
  }

  #readConfig() {
    try {
      const file = this.#configFiles.find((candidate) => fs.existsSync(candidate));
      if (!file) return {};
      const raw = fs.readFileSync(file, 'utf8').trim();
      if (!raw) return {};
      const config = JSON.parse(raw);
      return {
        apiKey: typeof config.apiKey === 'string' ? config.apiKey.trim() : '',
        baseUrl: typeof config.baseUrl === 'string' ? config.baseUrl.trim() : '',
        userToken: typeof config.userToken === 'string' ? config.userToken.trim() : ''
      };
    } catch {
      return {};
    }
  }

  async #readUsage(force) {
    const token = this.#readConfig().userToken || process.env.DEEPSEEK_PLATFORM_TOKEN || process.env.DEEPSEEK_USER_TOKEN;
    if (!token) {
      this.#usageState = {configured: false, spent: null};
      return this.#usageState;
    }
    const now = Date.now();
    if (!force && this.#usageAt && now - this.#usageAt < usageEveryMs) return this.#usageState;
    this.#usageAt = now;
    try {
      const date = new Date();
      const url = `${usageEndpoint}?month=${date.getMonth() + 1}&year=${date.getFullYear()}`;
      const response = await fetch(url, {
        headers: {Authorization: `Bearer ${token}`, Accept: 'application/json'},
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!response.ok) throw new Error(`DeepSeek usage failed with HTTP ${response.status}`);
      this.#usageState = {configured: true, spent: parseTodayCost(await response.json(), date)};
    } catch {
      this.#usageState = {configured: true, spent: null};
    }
    return this.#usageState;
  }
}
