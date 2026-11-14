// Platform bridge only: start the WASM module and construct the Rust renderer.
import init, { VoiceSurface } from './pkg/watcher_voice_surface.js';
let ready;
export async function mount(canvas) {
  ready ??= init().catch(error => { ready = undefined; throw error; });
  await ready;
  const renderer = new VoiceSurface(canvas);
  renderer.soft_edges(true);
  return renderer;
}
