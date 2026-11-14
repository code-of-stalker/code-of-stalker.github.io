// Platform bridge only: start the WASM module and construct the Rust renderer,
// then hand it page 08's phone screens once they load (it draws without them).
import init, { NightCity } from './pkg/watcher_night_city.js';
let ready;
let screens;
// Wait for load, not decode(): decode() never settles in a hidden tab.
function phoneScreens() {
  return new Promise((done, failed) => {
    const node = new Image();
    node.onload = () => done(node);
    node.onerror = () => failed(new Error('night-city: phone.webp did not load'));
    node.src = new URL('./assets/phone.webp', import.meta.url).href;
  });
}
export async function mount(canvas) {
  ready ??= init().catch(error => { ready = undefined; throw error; });
  await ready;
  const renderer = new NightCity(canvas);
  renderer.soft_edges(true);
  screens ??= phoneScreens().catch(error => { screens = undefined; throw error; });
  screens.then(image => {
    try { renderer.phone_screens(image); } catch { /* disposed meanwhile */ }
  }, () => {});
  return renderer;
}
