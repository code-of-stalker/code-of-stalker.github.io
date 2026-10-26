import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/world-in-glasses');
await mkdir(path.join(output, 'pkg'), { recursive: true });
await mkdir(path.join(output, 'assets'), { recursive: true });
for (const file of ['watcher_world_in_glasses.js', 'watcher_world_in_glasses_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/world-in-glasses/pkg', file), path.join(output, 'pkg', file));
}
for (const file of ['original.webp', 'background.webp', 'figure.webp', 'mouths.webp', 'world.webp']) {
  await copyFile(path.join(scene, 'assets', file), path.join(output, 'assets', file));
}
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_world_in_glasses_bg.wasm')))) throw new Error('Invalid world-in-glasses WASM');
console.log('Packaged Rust world in glasses: 14-second seamless loop.');
