import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/inner-focus');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_inner_focus.js', 'watcher_inner_focus_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/inner-focus/pkg', file), path.join(output, 'pkg', file));
}
// One image: the words in his thought; the shaders trace everything else.
await mkdir(path.join(output, 'assets'), { recursive: true });
await copyFile(path.join(scene, 'assets/labels.webp'), path.join(output, 'assets/labels.webp'));
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_inner_focus_bg.wasm')))) throw new Error('Invalid inner-focus WASM');
console.log('Packaged Rust «Сохраняй синхронность» (Резкость): 60-second seamless loop, a person on a chair on a pier at dusk, the city across the river, focus on the city, then on him, then on both at once; the outer ring over the city, the inner ring scanning him.');
