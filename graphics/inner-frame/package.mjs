import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/inner-frame');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_inner_frame.js', 'watcher_inner_frame_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/inner-frame/pkg', file), path.join(output, 'pkg', file));
}
// One image: the callouts' words; every stroke is computed in Rust.
await mkdir(path.join(output, 'assets'), { recursive: true });
await copyFile(path.join(scene, 'assets/labels.webp'), path.join(output, 'assets/labels.webp'));
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_inner_frame_bg.wasm')))) throw new Error('Invalid inner-frame WASM');
console.log('Packaged Rust «Каркас» (Стройка): 60-second seamless loop, a ring truss on six legs drawn as a 3D blueprint, the six signals of the world landing on it, piles, the frame of the next levels.');
