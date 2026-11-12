import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scene, '../..');
const output = path.join(root, 'public/graphics/voice-surface');
await mkdir(path.join(output, 'pkg'), { recursive: true });
for (const file of ['watcher_voice_surface.js', 'watcher_voice_surface_bg.wasm']) {
  await copyFile(path.join(root, 'output/motion/voice-surface/pkg', file), path.join(output, 'pkg', file));
}
// No images: the shader traces the whole scene.
await copyFile(path.join(scene, 'preview/runtime.mjs'), path.join(output, 'runtime.js'));
if (!WebAssembly.validate(await readFile(path.join(output, 'pkg/watcher_voice_surface_bg.wasm')))) throw new Error('Invalid voice-surface WASM');
console.log('Packaged Rust «Проговоренное — уже не скрытое» (Всплытие): 44-second seamless loop, a woman surfaces in a dark sea of code, her voice raises three knots of light from the depth that open into the words БОЛЬ, ВИНА, МЫСЛЬ over the water.');
