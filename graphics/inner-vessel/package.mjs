import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/inner-vessel');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_inner_vessel.js', 'watcher_inner_vessel_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/inner-vessel/pkg', file), path.join(output, 'pkg', file));
}
// No images: the shader traces the whole scene.
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_inner_vessel_bg.wasm')))) throw new Error('Invalid inner-vessel WASM');
console.log('Packaged Rust «Тело как форма» (Наполнение): 50-second seamless loop, a glass person seated on a chair fills with warm light from the feet to the crown, grows heavy, and roots into the floor.');
