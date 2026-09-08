import test from 'node:test';
import assert from 'node:assert/strict';
import {updateDailyBalance} from '../app/deepseek-daily.js';

test('records opening balance and accumulates balance decreases during the day', () => {
  const morning = updateDailyBalance({}, 100, new Date(2026, 8, 8, 8, 0));
  assert.equal(morning.openingBalance, 100);
  assert.equal(morning.estimatedSpent, 0);

  const noon = updateDailyBalance(morning.history, 94.5, new Date(2026, 8, 8, 12, 0));
  assert.equal(noon.openingBalance, 100);
  assert.equal(noon.estimatedSpent, 5.5);

  const evening = updateDailyBalance(noon.history, 90, new Date(2026, 8, 8, 18, 0));
  assert.equal(evening.estimatedSpent, 10);
});

test('does not erase consumed balance after a same-day recharge', () => {
  const morning = updateDailyBalance({}, 100, new Date(2026, 8, 8, 8, 0));
  const spent = updateDailyBalance(morning.history, 95, new Date(2026, 8, 8, 10, 0));
  const recharged = updateDailyBalance(spent.history, 115, new Date(2026, 8, 8, 11, 0));
  const spentAgain = updateDailyBalance(recharged.history, 112, new Date(2026, 8, 8, 12, 0));
  assert.equal(spentAgain.openingBalance, 100);
  assert.equal(spentAgain.estimatedSpent, 8);
  assert.equal(spentAgain.history.days['2026-09-08'].addedBalance, 20);
});

test('starts a fresh opening balance on the next local day', () => {
  const firstDay = updateDailyBalance({}, 100, new Date(2026, 8, 8, 23, 0));
  const secondDay = updateDailyBalance(firstDay.history, 92, new Date(2026, 8, 9, 8, 0));
  assert.equal(secondDay.openingBalance, 92);
  assert.equal(secondDay.estimatedSpent, 0);
  assert.ok(secondDay.history.days['2026-09-08']);
  assert.ok(secondDay.history.days['2026-09-09']);
});
