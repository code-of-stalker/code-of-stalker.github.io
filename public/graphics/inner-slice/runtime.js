// Platform bridge only: start the WASM module and construct the Rust renderer.
import init, { InnerSlice } from './pkg/watcher_inner_slice.js';
let ready;
export async function mount(canvas) {
  ready ??= init().catch(error => { ready = undefined; throw error; });
  await ready;
  const renderer = new InnerSlice(canvas);
  renderer.soft_edges(true);
  return renderer;
}
