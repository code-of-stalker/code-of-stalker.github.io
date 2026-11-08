// Platform bridge only: start the WASM module and construct the Rust renderer.
import init, { NightCity } from './pkg/watcher_night_city.js';
let ready;
export async function mount(canvas) {
  ready ??= init().catch(error => { ready = undefined; throw error; });
  await ready;
  const renderer = new NightCity(canvas);
  renderer.soft_edges(true);
  return renderer;
}
