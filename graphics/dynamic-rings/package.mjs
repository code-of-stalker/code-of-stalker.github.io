import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/dynamic-rings');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_dynamic_rings.js', 'watcher_dynamic_rings_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/dynamic-rings/pkg', file), path.join(output, 'pkg', file));
}
// No images: the figure, the rings and the world are built on the GPU.
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_dynamic_rings_bg.wasm')))) throw new Error('Invalid dynamic-rings WASM');
console.log('Packaged Rust «Наблюдение в Динамике»: a figure of light walking inside three rings, one chapter per page.');
