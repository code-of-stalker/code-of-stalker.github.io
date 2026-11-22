// Platform bridge only: start the WASM module and construct the Rust renderer.
import init, { AnywherePath, warm } from './pkg/watcher_anywhere_path.js';
let ready;
export async function mount(canvas) {
  ready ??= init().catch(error => { ready = undefined; throw error; });
  await ready;
  // Rust links the shader in the background first; the renderer's own link
  // then comes from the browser's program cache instead of freezing the page.
  let programs = warm(canvas);
  while (!programs.done()) await new Promise(resolve => setTimeout(resolve, 50));
  const renderer = new AnywherePath(canvas);
  const dispose = renderer.dispose.bind(renderer);
  renderer.dispose = () => { programs?.free(); programs = undefined; dispose(); };
  renderer.soft_edges(true);
  return renderer;
}
