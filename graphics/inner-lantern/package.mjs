import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/inner-lantern');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_inner_lantern.js', 'watcher_inner_lantern_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/inner-lantern/pkg', file), path.join(output, 'pkg', file));
}
// No images: the shader traces the whole scene.
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_inner_lantern_bg.wasm')))) throw new Error('Invalid inner-lantern WASM');
console.log('Packaged Rust «Внимание внутрь» (Фонарь): 64-second seamless loop; the warm inner ring turns its light inward, the camera follows it in through the back, and the beam of attention reads what comes and goes inside.');
