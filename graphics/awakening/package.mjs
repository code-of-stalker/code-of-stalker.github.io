import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/awakening');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_awakening.js', 'watcher_awakening_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/awakening/pkg', file), path.join(output, 'pkg', file));
}
// One input for every theme: color is applied in Rust's composite pass.
await mkdir(path.join(output, 'assets'), { recursive: true });
// Copy the immutable RGBA cutout without altering its pixels.
await copyFile(path.join(scene, 'assets/portrait-cutout.png'), path.join(output, 'assets/portrait-cutout.png'));
await copyFile(path.join(scene, 'assets/mask.png'), path.join(output, 'assets/mask.png'));
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_awakening_bg.wasm')))) throw new Error('Invalid awakening WASM');
console.log('Packaged Rust «Пробуждение»: 36-second seamless loop.');
