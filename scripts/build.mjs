import {spawnSync} from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const electronDist = path.join(root, 'node_modules', 'electron', 'dist');
const builder = path.join(root, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js');
const result = spawnSync(process.execPath, [builder, '--win', 'portable', '--x64', '--publish', 'never', `--config.electronDist=${electronDist}`], {
  cwd: root,
  stdio: 'inherit'
});
process.exitCode = result.status ?? 1;
