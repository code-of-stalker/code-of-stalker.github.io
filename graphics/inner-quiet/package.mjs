import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/inner-quiet');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_inner_quiet.js', 'watcher_inner_quiet_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/inner-quiet/pkg', file), path.join(output, 'pkg', file));
}
// Art's «Струны» in layers: the land of noise, the quiet land, him, the depth
// map and the land behind the spikes.
await mkdir(path.join(output, 'assets'), { recursive: true });
for (const name of ['background', 'quiet', 'figure', 'depth', 'terrain']) {
  await copyFile(path.join(scene, `assets/${name}.webp`), path.join(output, `assets/${name}.webp`));
}
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_inner_quiet_bg.wasm')))) throw new Error('Invalid inner-quiet WASM');
console.log('Packaged Rust «Итог» (Тише шума): 70-second seamless loop over Art’s painting «Струны»; the noise rolls over the quiet strings and raises five spikes with their signs, the warm ring notices each and it sinks; then the warm ring fills him, both rings light up, the strings go calm from his feet outward and a tone rises through him.');
