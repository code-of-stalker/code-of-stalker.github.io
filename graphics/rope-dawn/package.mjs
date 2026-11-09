import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/rope-dawn');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_rope_dawn.js', 'watcher_rope_dawn_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/rope-dawn/pkg', file), path.join(output, 'pkg', file));
}
// No images: the towers, the fog sea, the walker and his shadow are built on the GPU.
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_rope_dawn_bg.wasm')))) throw new Error('Invalid rope-dawn WASM');
console.log('Packaged Rust «Канатоходец на рассвете»: a man walks a rope between two towers over a sea of fog at dawn, his shadow with a glory ring on the fog.');
