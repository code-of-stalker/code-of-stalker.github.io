import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/anywhere-path');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_anywhere_path.js', 'watcher_anywhere_path_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/anywhere-path/pkg', file), path.join(output, 'pkg', file));
}
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_anywhere_path_bg.wasm')))) throw new Error('Invalid anywhere-path WASM');
console.log('Packaged Rust «Итог» (Сквозной путь): 155.5-second seamless loop; one night journey in smooth shaded 3D with fog, lamp glow, depth of field and bloom: field, house, the table one on one, the station crowd, the train, the silent pier, a walk with a friend, home; his two rings move with him, the warm one climbs him and leaves him lit, then the route closes into a ring, the cold ring lays itself round the world and the world melts into code.');
