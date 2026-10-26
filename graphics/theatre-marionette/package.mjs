import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/theatre-marionette');
await mkdir(path.join(output, 'pkg'), { recursive: true });
await mkdir(path.join(output, 'assets'), { recursive: true });
for (const file of ['watcher_theatre_marionette.js', 'watcher_theatre_marionette_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/theatre-marionette/pkg', file), path.join(output, 'pkg', file));
}
for (const file of ['original.png', 'background.png', 'heroine.png']) {
  await copyFile(path.join(scene, 'assets', file), path.join(output, 'assets', file));
}
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_theatre_marionette_bg.wasm')))) throw new Error('Invalid marionette WASM');
console.log('Packaged Rust marionette: strength 1.5, half-speed rain, 24-second seamless loop.');
