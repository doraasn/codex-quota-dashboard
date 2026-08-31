import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('does not expose Codex-following or login-start behavior', () => {
  const source = fs.readFileSync(new URL('../app/main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /--follow-codex/);
  assert.doesNotMatch(source, /跟随 Codex 启动/);
  assert.doesNotMatch(source, /setLoginItemSettings/);
  assert.doesNotMatch(source, /openAtLogin:\s*true/);
});
