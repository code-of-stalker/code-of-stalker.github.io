import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/inner-radar');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_inner_radar.js', 'watcher_inner_radar_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/inner-radar/pkg', file), path.join(output, 'pkg', file));
}
// No images: the shader traces the whole scene.
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_inner_radar_bg.wasm')))) throw new Error('Invalid inner-radar WASM');
console.log('Packaged Rust «Внимание внутрь» (Радар): 60-second seamless loop, a radar scope round the chest of a seated person; a warm beam sweeps it and unlabelled marks light behind it and fade.');
