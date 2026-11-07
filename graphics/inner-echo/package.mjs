import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/inner-echo');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_inner_echo.js', 'watcher_inner_echo_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/inner-echo/pkg', file), path.join(output, 'pkg', file));
}
// No images: one shader traces the whole scene.
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_inner_echo_bg.wasm')))) throw new Error('Invalid inner-echo WASM');
console.log('Packaged Rust «Внутрь» (Эхо): 60-second seamless loop, a person seated on a chair, waves of perception drawing the room in cold points, the inside of the body in warm points.');
