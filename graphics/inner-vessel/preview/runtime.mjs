// Platform bridge only: start the WASM module and construct the Rust renderer.
import init, { InnerVessel } from './pkg/watcher_inner_vessel.js';
let ready;
export async function mount(canvas) {
  ready ??= init().catch(error => { ready = undefined; throw error; });
  await ready;
  const renderer = new InnerVessel(canvas);
  renderer.soft_edges(true);
  return renderer;
}
