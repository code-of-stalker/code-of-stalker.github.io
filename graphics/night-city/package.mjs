import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/night-city');
await mkdir(path.join(output, 'pkg'), { recursive: true });
await mkdir(path.join(output, 'assets'), { recursive: true });
for (const file of ['watcher_night_city.js', 'watcher_night_city_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/night-city/pkg', file), path.join(output, 'pkg', file));
}
// One image, page 08's phone screens (tools/bake-phone.py); the street, the
// walker and the rain are built on the GPU.
await copyFile(path.join(scene, 'assets/phone.webp'), path.join(output, 'assets/phone.webp'));
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_night_city_bg.wasm')))) throw new Error('Invalid night-city WASM');
console.log('Packaged Rust «Ночной город»: a walker on a wet night street in the rain, the camera in levels from his eyes to a crane over the block.');
