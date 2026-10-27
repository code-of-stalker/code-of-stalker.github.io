import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const crate = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(crate, '../..');
const output = path.join(root, 'public/graphics/soft-scroll/pkg');
await mkdir(output, { recursive: true });
for (const file of ['watcher_soft_scroll.js', 'watcher_soft_scroll_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/soft-scroll/pkg', file), path.join(output, file));
}
const wasm = await readFile(path.join(output, 'watcher_soft_scroll_bg.wasm'));
if (!WebAssembly.validate(wasm)) throw new Error('Invalid soft-scroll WASM');
console.log(`Packaged Rust soft scroll: ${(wasm.length / 1024).toFixed(1)} KB.`);
