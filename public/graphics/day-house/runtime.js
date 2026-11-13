// Platform bridge only: start the WASM module and construct the Rust renderer.
import init, { DayHouse } from './pkg/watcher_day_house.js';
let ready;
export async function mount(canvas) {
  ready ??= init().catch(error => { ready = undefined; throw error; });
  await ready;
  const renderer = new DayHouse(canvas);
  renderer.soft_edges(true);
  return renderer;
}
