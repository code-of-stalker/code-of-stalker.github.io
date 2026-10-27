import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/simple-practice');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_simple_practice.js', 'watcher_simple_practice_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/simple-practice/pkg', file), path.join(output, 'pkg', file));
}
// One input for every theme: color is applied in Rust's composite pass.
await mkdir(path.join(output, 'assets'), { recursive: true });
// Lossless WebP copy of the authored PNG (graphics/lossless-webp.py): same pixels, smaller download.
await copyFile(path.join(scene, 'assets/figure.webp'), path.join(output, 'assets/figure.webp'));
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_simple_practice_bg.wasm')))) throw new Error('Invalid simple-practice WASM');
console.log('Packaged Rust «Простая практика»: 44-second seamless loop.');
