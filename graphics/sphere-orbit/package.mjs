import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/sphere-orbit');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_sphere_orbit.js', 'watcher_sphere_orbit_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/sphere-orbit/pkg', file), path.join(output, 'pkg', file));
}
// No images: every line and mote is built on the GPU.
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_sphere_orbit_bg.wasm')))) throw new Error('Invalid sphere-orbit WASM');
console.log('Packaged Rust «Ты не точка»: 60-second seamless loop, a point that opens into an orbit and a sphere, the camera once around.');
