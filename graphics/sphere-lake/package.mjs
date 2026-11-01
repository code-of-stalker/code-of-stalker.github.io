import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/sphere-lake');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_sphere_lake.js', 'watcher_sphere_lake_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/sphere-lake/pkg', file), path.join(output, 'pkg', file));
}
// Art's dark lake only: the light themes engrave it in Rust. A lossless WebP
// copy of the authored PNG (graphics/lossless-webp.py): same pixels, smaller download.
await mkdir(path.join(output, 'assets'), { recursive: true });
await copyFile(path.join(scene, 'assets/lake.webp'), path.join(output, 'assets/lake.webp'));
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_sphere_lake_bg.wasm')))) throw new Error('Invalid sphere-lake WASM');
console.log('Packaged Rust «Тишина воды»: 60-second seamless loop, the lake stills to a mirror.');
