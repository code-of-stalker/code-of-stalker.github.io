import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/witnessing');
const source = path.join(root, 'output/motion/witnessing/pkg');
const wasm = await readFile(path.join(source, 'watcher_witnessing_bg.wasm'));
if (!WebAssembly.validate(wasm)) throw new Error('Invalid witnessing WASM');
// Fail before replacing a working package when an illustration is not ready.
const assets = ['hand-v2.png', 'world.png', 'hand-light.png', 'world-light.png'];
await Promise.all(assets.map(name => readFile(path.join(scene, 'assets', name))));
await mkdir(path.join(output, 'pkg'), { recursive: true });
await mkdir(path.join(output, 'assets'), { recursive: true });
for (const name of ['watcher_witnessing.js', 'watcher_witnessing_bg.wasm']) {
  await copyFile(path.join(source, name), path.join(output, 'pkg', name));
}
for (const name of assets) {
  await copyFile(path.join(scene, 'assets', name), path.join(output, 'assets', name));
}
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
console.log('Packaged Rust «Живое Осознавание»: two textures, one draw pass.');
