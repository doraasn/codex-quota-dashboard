import fs from 'node:fs';
import path from 'node:path';

const historyDays = 31;

/**
 * DeepSeek 每日余额记录器，按本地日期保存起始余额和余额变化。
 *
 * @author doraasn
 * @date 2026-09-08
 */
export class DeepSeekDailyBalanceStore {
  #file;
  #history;

  constructor(file) {
    this.#file = file;
  }

  /**
   * 记录当前余额并返回当日估算消费。
   *
   * @param {number} balance 当前账户余额，例如 428.5
   * @param {Date} now 当前本地时间
   * @returns {{openingBalance: number|null, estimatedSpent: number|null}} 当日余额摘要
   */
  update(balance, now = new Date()) {
    if (!Number.isFinite(balance) || balance < 0) {
      return {openingBalance: null, estimatedSpent: null};
    }
    if (!this.#history) this.#history = readHistory(this.#file);
    const result = updateDailyBalance(this.#history, balance, now);
    this.#history = result.history;
    if (result.changed) writeHistory(this.#file, this.#history);
    return {openingBalance: result.openingBalance, estimatedSpent: result.estimatedSpent};
  }
}

export function updateDailyBalance(history, balance, now = new Date()) {
  const date = localDateKey(now);
  const days = normalizeDays(history?.days);
  const previous = days[date];
  let changed = false;
  let day;

  if (!previous) {
    day = {
      openingBalance: balance,
      lastBalance: balance,
      addedBalance: 0,
      estimatedSpent: 0,
      updatedAt: now.toISOString()
    };
    changed = true;
  } else {
    day = {...previous};
    const delta = day.lastBalance - balance;
    if (delta > 0) day.estimatedSpent = roundAmount(day.estimatedSpent + delta);
    if (delta < 0) day.addedBalance = roundAmount(day.addedBalance - delta);
    if (delta !== 0) {
      day.lastBalance = balance;
      day.updatedAt = now.toISOString();
      changed = true;
    }
  }

  days[date] = day;
  const retainedDays = Object.fromEntries(
    Object.entries(days).sort(([left], [right]) => right.localeCompare(left)).slice(0, historyDays)
  );
  return {
    history: {version: 1, days: retainedDays},
    openingBalance: day.openingBalance,
    estimatedSpent: day.estimatedSpent,
    changed
  };
}

function normalizeDays(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const days = {};
  for (const [date, day] of Object.entries(value)) {
    const openingBalance = Number(day?.openingBalance);
    const lastBalance = Number(day?.lastBalance);
    const addedBalance = Number(day?.addedBalance);
    const estimatedSpent = Number(day?.estimatedSpent);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(openingBalance) || !Number.isFinite(lastBalance)) continue;
    days[date] = {
      openingBalance,
      lastBalance,
      addedBalance: Number.isFinite(addedBalance) ? Math.max(0, addedBalance) : 0,
      estimatedSpent: Number.isFinite(estimatedSpent) ? Math.max(0, estimatedSpent) : 0,
      updatedAt: typeof day.updatedAt === 'string' ? day.updatedAt : ''
    };
  }
  return days;
}

function readHistory(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {version: 1, days: {}};
  }
}

function writeHistory(file, history) {
  try {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, JSON.stringify(history, null, 2), 'utf8');
  } catch {
    // 本地记录失败时仍保持余额和平台消费接口正常刷新。
  }
}

function localDateKey(now) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function roundAmount(value) {
  return Math.round(value * 100_000_000) / 100_000_000;
}
