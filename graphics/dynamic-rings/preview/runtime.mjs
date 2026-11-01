// Platform bridge only: start the WASM module and construct the Rust renderer.
import init, { DynamicRings } from './pkg/watcher_dynamic_rings.js';
let ready;
export async function mount(canvas) {
  ready ??= init().catch(error => { ready = undefined; throw error; });
  await ready;
  const renderer = new DynamicRings(canvas);
  renderer.soft_edges(true);
  return renderer;
}
