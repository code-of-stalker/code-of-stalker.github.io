import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/hero-labyrinth');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_hero_labyrinth.js', 'watcher_hero_labyrinth_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/hero-labyrinth/pkg', file), path.join(output, 'pkg', file));
}
// One input for every theme: the hero's figure; light and color are Rust's shaders.
await mkdir(path.join(output, 'assets'), { recursive: true });
// Lossless WebP copy of the baked PNG (graphics/lossless-webp.py): same pixels, smaller download.
for (const file of ['hero.webp']) await copyFile(path.join(scene, 'assets', file), path.join(output, 'assets', file));
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_hero_labyrinth_bg.wasm')))) throw new Error('Invalid hero-labyrinth WASM');
console.log('Packaged Rust «Лабиринт»: 50-second seamless loop.');
