import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/tuning-questions');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_tuning_questions.js', 'watcher_tuning_questions_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/tuning-questions/pkg', file), path.join(output, 'pkg', file));
}
// One set of inputs for every theme: color is applied in Rust's composite pass.
await mkdir(path.join(output, 'assets'), { recursive: true });
// Lossless WebP copies of the authored PNGs (graphics/lossless-webp.py): same pixels, smaller download.
for (const file of ['figure.webp', 'labels.webp']) await copyFile(path.join(scene, 'assets', file), path.join(output, 'assets', file));
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_tuning_questions_bg.wasm')))) throw new Error('Invalid tuning-questions WASM');
console.log('Packaged Rust «Вопросы настройки»: 62-second seamless loop.');
