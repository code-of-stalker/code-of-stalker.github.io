import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/sphere-anchor');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_sphere_anchor.js', 'watcher_sphere_anchor_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/sphere-anchor/pkg', file), path.join(output, 'pkg', file));
}
// Art's dark figure only: the light themes engrave the whole scene in Rust.
// A lossless WebP copy of the authored PNG (graphics/lossless-webp.py): same pixels, smaller download.
await mkdir(path.join(output, 'assets'), { recursive: true });
await copyFile(path.join(scene, 'assets/avatar.webp'), path.join(output, 'assets/avatar.webp'));
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_sphere_anchor_bg.wasm')))) throw new Error('Invalid sphere-anchor WASM');
console.log('Packaged Rust «Якорь»: 48-second seamless loop, the world stops and the body grounds.');
