import test from 'node:test';
import assert from 'node:assert/strict';
import {quotaColor, remainingPercent, resetLabel, toDeepSeekWidgetState, toWidgetState} from '../app/quota-format.js';

test('converts used quota to remaining quota', () => {
  assert.equal(remainingPercent(27.4), 73);
  assert.equal(remainingPercent(undefined), null);
});

test('uses the requested color thresholds', () => {
  assert.equal(quotaColor(80), '#43c982');
  assert.equal(quotaColor(79), '#efb83f');
  assert.equal(quotaColor(9), '#ff6262');
});

test('formats today and tomorrow reset labels', () => {
  const now = new Date(2026, 7, 28, 12, 0);
  assert.match(resetLabel(new Date(2026, 7, 28, 18, 20).getTime() / 1000, now), /^今天 /);
  assert.match(resetLabel(new Date(2026, 7, 29, 1, 30).getTime() / 1000, now), /^明天 /);
});

test('maps the app-server response into two fixed windows', () => {
  const state = toWidgetState({
    rateLimits: {
      primary: {usedPercent: 15, resetsAt: 1_788_000_000},
      secondary: {usedPercent: 55, resetsAt: 1_788_600_000}
    },
    rateLimitResetCredits: {availableCount: 2}
  });
  assert.equal(state.fiveHour.remaining, 85);
  assert.equal(state.weekly.remaining, 45);
  assert.equal(state.resets, 2);
});

test('falls back to a populated keyed limit when the legacy limit is empty', () => {
  const state = toWidgetState({
    rateLimits: {},
    rateLimitsByLimitId: {
      codex: {
        primary: {usedPercent: 18, resetsAt: 1_788_000_000},
        secondary: {usedPercent: 42, resetsAt: 1_788_600_000}
      }
    }
  });
  assert.equal(state.fiveHour.remaining, 82);
  assert.equal(state.weekly.remaining, 58);
  assert.notEqual(state.fiveHour.reset, '时间未知');
  assert.notEqual(state.weekly.reset, '时间未知');
});

test('maps the DeepSeek balance response into a compact balance circle', () => {
  const state = toDeepSeekWidgetState({
    is_available: true,
    balance_infos: [{currency: 'CNY', total_balance: '110.00'}]
  });
  assert.equal(state.remaining, '110');
  assert.equal(state.reset, 'CNY');
  assert.equal(state.color, '#43c982');
});

test('shows today DeepSeek spend when the platform token is configured', () => {
  const balance = {is_available: true, balance_infos: [{currency: 'CNY', total_balance: '110.00'}]};
  const exact = toDeepSeekWidgetState(balance, {todaySpent: 18.1194577, usageConfigured: true});
  assert.equal(exact.reset, '今日 ¥18.12');
  assert.ok(exact.progress > 85 && exact.progress < 86);
  assert.equal(toDeepSeekWidgetState(balance, {todaySpent: 0, usageConfigured: true}).reset, '今日 ¥0');
  assert.equal(toDeepSeekWidgetState(balance, {todaySpent: null, usageConfigured: true}).reset, '今日 --');
  assert.equal(toDeepSeekWidgetState(balance, {todaySpent: null, usageConfigured: false}).reset, 'CNY');
});

test('uses the daily balance estimate when platform usage is unavailable', () => {
  const balance = {is_available: true, balance_infos: [{currency: 'CNY', total_balance: '90.00'}]};
  const state = toDeepSeekWidgetState(balance, {
    todaySpent: null,
    usageConfigured: true,
    estimatedSpent: 10
  });
  assert.equal(state.reset, '今日约 ¥10');
  assert.equal(state.progress, 90);
  assert.equal(state.todaySpent, 10);
});

test('shows DeepSeek configuration and request states', () => {
  assert.equal(toDeepSeekWidgetState(null, {missingKey: true}).reset, '未配置');
  assert.equal(toDeepSeekWidgetState(null, {error: new Error('failed')}).reset, '请求失败');
});
