import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/inner-hero');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_inner_hero.js', 'watcher_inner_hero_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/inner-hero/pkg', file), path.join(output, 'pkg', file));
}
// Art's painting with its ring erased, and the depth map (tools/prepare.py).
// Lossless WebP copies of the authored PNGs (graphics/lossless-webp.py): same pixels, smaller download.
await mkdir(path.join(output, 'assets'), { recursive: true });
for (const name of ['painting', 'depth']) await copyFile(path.join(scene, 'assets', `${name}.webp`), path.join(output, 'assets', `${name}.webp`));
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_inner_hero_bg.wasm')))) throw new Error('Invalid inner-hero WASM');
console.log('Packaged Rust «Внутренняя сфера»: 36-second seamless loop, a beat every 18 seconds.');
