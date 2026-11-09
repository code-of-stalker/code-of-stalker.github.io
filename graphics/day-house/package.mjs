import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/day-house');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_day_house.js', 'watcher_day_house_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/day-house/pkg', file), path.join(output, 'pkg', file));
}
// No images: the house, its rooms, the street and the people are built on the GPU.
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_day_house_bg.wasm')))) throw new Error('Invalid day-house WASM');
console.log('Packaged Rust «Дом в разрезе»: a cutaway model house on a lacquer table; one man passes through its day, his three rings, the walls melt into one space.');
