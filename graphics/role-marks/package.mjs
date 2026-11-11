import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const crate = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(crate, '../..');
const output = path.join(root, 'public/graphics/role-marks/pkg');
await mkdir(output, { recursive: true });
for (const file of ['watcher_role_marks.js', 'watcher_role_marks_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/role-marks/pkg', file), path.join(output, file));
}
const wasm = await readFile(path.join(output, 'watcher_role_marks_bg.wasm'));
if (!WebAssembly.validate(wasm)) throw new Error('Invalid role-marks WASM');
console.log(`Packaged Rust role marks: ${(wasm.length / 1024).toFixed(1)} KB.`);
