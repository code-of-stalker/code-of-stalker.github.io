// Platform bridge only: start the WASM module and construct the Rust renderer.
import init, { SphereOrbit } from './pkg/watcher_sphere_orbit.js';
let ready;
export async function mount(canvas) {
  ready ??= init().catch(error => { ready = undefined; throw error; });
  await ready;
  const renderer = new SphereOrbit(canvas);
  renderer.soft_edges(true);
  return renderer;
}
