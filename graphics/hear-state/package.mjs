import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/hear-state');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_hear_state.js', 'watcher_hear_state_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/hear-state/pkg', file), path.join(output, 'pkg', file));
}
// One set of inputs for every theme: color is applied in Rust's composite pass.
await mkdir(path.join(output, 'assets'), { recursive: true });
for (const file of ['figure.png', 'labels.png']) await copyFile(path.join(scene, 'assets', file), path.join(output, 'assets', file));
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_hear_state_bg.wasm')))) throw new Error('Invalid hear-state WASM');
console.log('Packaged Rust «Услышь своё состояние»: 48-second seamless loop.');
