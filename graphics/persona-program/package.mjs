import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/persona-program');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_persona_program.js', 'watcher_persona_program_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/persona-program/pkg', file), path.join(output, 'pkg', file));
}
// One set of inputs for every theme: color is applied in Rust's composite pass.
await mkdir(path.join(output, 'assets'), { recursive: true });
// Lossless WebP copies of the authored PNGs (graphics/lossless-webp.py): same pixels, smaller download.
for (const file of ['figure.webp', 'labels.webp']) await copyFile(path.join(scene, 'assets', file), path.join(output, 'assets', file));
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_persona_program_bg.wasm')))) throw new Error('Invalid persona-program WASM');
console.log('Packaged Rust «Механизм обусловленности»: 66-second seamless loop.');
