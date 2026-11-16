import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/inner-descent');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_inner_descent.js', 'watcher_inner_descent_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/inner-descent/pkg', file), path.join(output, 'pkg', file));
}
// One image: the spoken words and the altimeter's digits; the shaders trace everything else.
await mkdir(path.join(output, 'assets'), { recursive: true });
await copyFile(path.join(scene, 'assets/labels.webp'), path.join(output, 'assets/labels.webp'));
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_inner_descent_bg.wasm')))) throw new Error('Invalid inner-descent WASM');
console.log('Packaged Rust «Используй свой голос» (Спуск): 60-second seamless loop, a man hanging over the Earth pulled down phrase by phrase, every spoken word a warm bead on the thread of his voice, the altimeter counting down to the soil; the cold outer ring and the warm inner ring around him.');
