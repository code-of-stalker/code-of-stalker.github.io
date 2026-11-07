// Platform bridge only: start the WASM module, load the callouts' atlas and
// construct the Rust renderer.
import init, { InnerFrame } from './pkg/watcher_inner_frame.js';
let resources;
// Wait for load, not decode(): decode() never settles in a hidden tab.
function image(name) {
  return new Promise((done, failed) => {
    const node = new Image();
    node.onload = () => done(node);
    node.onerror = () => failed(new Error(`inner-frame: ${name}.webp did not load`));
    node.src = new URL(`./assets/${name}.webp`, import.meta.url).href;
  });
}
export async function mount(canvas) {
  resources ??= Promise.all([init(), image('labels')]).catch(error => { resources = undefined; throw error; });
  const [, labels] = await resources;
  const renderer = new InnerFrame(canvas, labels);
  renderer.soft_edges(true);
  return renderer;
}
