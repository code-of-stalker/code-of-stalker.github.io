import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/inner-clouds');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_inner_clouds.js', 'watcher_inner_clouds_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/inner-clouds/pkg', file), path.join(output, 'pkg', file));
}
// No images: the shader traces the whole scene.
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_inner_clouds_bg.wasm')))) throw new Error('Invalid inner-clouds WASM');
console.log('Packaged Rust «Дай внутреннему проявляться свободно» (Окно): 64-second seamless loop; night, he sits facing the window, his sky does what it does by itself, and it is his inside: clear only in his image on the glass, the same sky in his body.');
