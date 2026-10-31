import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/sphere-hero');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_sphere_hero.js', 'watcher_sphere_hero_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/sphere-hero/pkg', file), path.join(output, 'pkg', file));
}
// Art's four layers: the dark originals, and the light paintings for Дюна, Мираж and Рассвет.
// Lossless WebP copies of the authored PNGs (graphics/lossless-webp.py): same pixels, smaller download.
const layers = ['parallax-base', 'reflection', 'figure', 'foreground'];
for (const folder of ['assets', 'assets-light']) {
  await mkdir(path.join(output, folder), { recursive: true });
  for (const name of layers) await copyFile(path.join(scene, folder, `${name}.webp`), path.join(output, folder, `${name}.webp`));
}
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_sphere_hero_bg.wasm')))) throw new Error('Invalid sphere-hero WASM');
console.log('Packaged Rust «Скан в глубине»: 30-second seamless loop, a wave every 10 seconds.');
