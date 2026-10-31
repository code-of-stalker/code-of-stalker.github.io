// Platform bridge only: start the WASM module and construct the Rust renderer.
import init, { SphereVoice } from './pkg/watcher_sphere_voice.js';
let ready;
export async function mount(canvas) {
  ready ??= init().catch(error => { ready = undefined; throw error; });
  await ready;
  const renderer = new SphereVoice(canvas);
  renderer.soft_edges(true);
  return renderer;
}
