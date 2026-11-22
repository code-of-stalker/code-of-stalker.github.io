import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/inner-anywhere');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_inner_anywhere.js', 'watcher_inner_anywhere_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/inner-anywhere/pkg', file), path.join(output, 'pkg', file));
}
// The seven places packed as luminance in three plates, and him.
await mkdir(path.join(output, 'assets'), { recursive: true });
for (const name of ['places-a', 'places-b', 'places-c', 'hero']) {
  await copyFile(path.join(scene, `assets/${name}.webp`), path.join(output, `assets/${name}.webp`));
}
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_inner_anywhere_bg.wasm')))) throw new Error('Invalid inner-anywhere WASM');
console.log('Packaged Rust «Итог» (Любая среда): 65-second seamless loop; he stands the same while the world behind him changes through seven places, each poured in under the cold ring’s scan line; the warm ring fills him, then the seven places open round his star as sectors and merge into the open field.');
