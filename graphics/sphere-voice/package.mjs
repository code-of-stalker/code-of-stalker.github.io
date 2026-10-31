import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/sphere-voice');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_sphere_voice.js', 'watcher_sphere_voice_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/sphere-voice/pkg', file), path.join(output, 'pkg', file));
}
// No images: one shader traces the whole scene.
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_sphere_voice_bg.wasm')))) throw new Error('Invalid sphere-voice WASM');
console.log('Packaged Rust «Используй свой голос»: 56-second seamless loop, a string of light on a sand plate, each phrase builds a belt of the dome.');
