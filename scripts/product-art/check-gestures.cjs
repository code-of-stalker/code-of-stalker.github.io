// Convenience entry point; durable named cases live next to the adapter.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const result = spawnSync(process.execPath, ['--test', path.resolve(__dirname, '../../src/features/product/motion/gesture.test.mjs')], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
