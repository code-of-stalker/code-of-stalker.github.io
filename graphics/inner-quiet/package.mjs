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
// One image: him, Art's figure 1; the shaders draw everything else.
await mkdir(path.join(output, 'assets'), { recursive: true });
await copyFile(path.join(scene, 'assets/figure.webp'), path.join(output, 'assets/figure.webp'));
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_inner_quiet_bg.wasm')))) throw new Error('Invalid inner-quiet WASM');
console.log('Packaged Rust «Итог» (Тише шума): 70-second seamless loop, a man standing in a landscape of sound lines; the noise of his inside rises as spikes with their signs, the warm ring notices each one and it sinks; then his inside turns sharp, both rings light up, the land goes quiet and one calm ridge and a tone run through him.');
