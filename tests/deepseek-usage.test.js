import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTodayCost} from '../app/deepseek-client.js';

test('parses today cost from the platform usage response', () => {
  const now = new Date(2026, 7, 31, 11, 0);
  const payload = {
    code: 0,
    data: {
      biz_code: 0,
      biz_data: [{
        currency: 'CNY',
        days: [
          {date: '2026-08-30', data: [{model: 'm', usage: [{type: 'RESPONSE_TOKEN', amount: '1.5'}]}]},
          {
            date: '2026-08-31',
            data: [
              {model: 'a', usage: [{type: 'PROMPT_CACHE_HIT_TOKEN', amount: '0.0062848'}, {type: 'REQUEST', amount: '0'}]},
              {model: 'b', usage: [{type: 'RESPONSE_TOKEN', amount: '2.371068'}]}
            ]
          }
        ]
      }]
    }
  };
  assert.ok(Math.abs(parseTodayCost(payload, now) - 2.3773528) < 1e-9);
});

test('returns null when the today row is missing', () => {
  const payload = {data: {biz_data: [{days: [{date: '2026-08-30', data: []}]}]}};
  assert.equal(parseTodayCost(payload, new Date(2026, 7, 31)), null);
});

test('returns zero when the today row exists without cost', () => {
  const payload = {data: {biz_data: [{days: [{date: '2026-08-31', data: []}]}]}};
  assert.equal(parseTodayCost(payload, new Date(2026, 7, 31)), 0);
});
