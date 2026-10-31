import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/sphere-room');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_sphere_room.js', 'watcher_sphere_room_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/sphere-room/pkg', file), path.join(output, 'pkg', file));
}
// Art's night room and its depth map; the light themes engrave the scene in Rust.
// Lossless WebP copies of the authored PNGs (graphics/lossless-webp.py): same pixels, smaller download.
await mkdir(path.join(output, 'assets'), { recursive: true });
for (const file of ['room.webp', 'depth.webp']) {
  await copyFile(path.join(scene, 'assets', file), path.join(output, 'assets', file));
}
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_sphere_room_bg.wasm')))) throw new Error('Invalid sphere-room WASM');
console.log('Packaged Rust «Скан комнаты»: 60-second seamless loop, the room as points and a plane of light for each line.');
