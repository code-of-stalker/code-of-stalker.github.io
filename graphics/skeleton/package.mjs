import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const crate = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(crate, '../..');
const output = path.join(root, 'public/graphics/skeleton');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_skeleton.js', 'watcher_skeleton_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/skeleton/pkg', file), path.join(output, 'pkg', file));
}
await copyFile(path.join(crate, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
const wasm = path.join(output, 'pkg/watcher_skeleton_bg.wasm');
if (!WebAssembly.validate(await readFile(wasm))) throw new Error('Invalid skeleton WASM');
console.log(`Packaged Rust skeleton: ${(await stat(wasm)).size} bytes of WASM.`);
