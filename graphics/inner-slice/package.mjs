import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/inner-slice');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_inner_slice.js', 'watcher_inner_slice_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/inner-slice/pkg', file), path.join(output, 'pkg', file));
}
// No images: one shader traces the whole scene.
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_inner_slice_bg.wasm')))) throw new Error('Invalid inner-slice WASM');
console.log('Packaged Rust «Внутрь»: 60-second seamless loop, a seated figure in height lines, the outer ring scanning the floor, a slice opening the warm inner ring.');
