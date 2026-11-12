import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/voice-fork');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_voice_fork.js', 'watcher_voice_fork_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/voice-fork/pkg', file), path.join(output, 'pkg', file));
}
// Her light and silhouette (tools/prepare.py), published as lossless WebP
// (graphics/lossless-webp.py): same pixels, smaller download.
await mkdir(path.join(output, 'assets'), { recursive: true });
await copyFile(path.join(scene, 'assets/figure.webp'), path.join(output, 'assets/figure.webp'));
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_voice_fork_bg.wasm')))) throw new Error('Invalid voice-fork WASM');
console.log('Packaged Rust «Камертон»: 12-second seamless loop, two hums.');
