import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/essence-flame');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_essence_flame.js', 'watcher_essence_flame_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/essence-flame/pkg', file), path.join(output, 'pkg', file));
}
// One input for every theme: the words; color is applied in Rust's shaders.
await mkdir(path.join(output, 'assets'), { recursive: true });
// Lossless WebP copy of the authored PNG (graphics/lossless-webp.py): same pixels, smaller download.
for (const file of ['labels.webp']) await copyFile(path.join(scene, 'assets', file), path.join(output, 'assets', file));
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_essence_flame_bg.wasm')))) throw new Error('Invalid essence-flame WASM');
console.log('Packaged Rust «Сущностные ощущения»: 56-second seamless loop.');
