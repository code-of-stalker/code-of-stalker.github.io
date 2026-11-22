// Platform bridge only: start the WASM module, load the places and him and
// construct the Rust renderer.
import init, { InnerAnywhere, warm } from './pkg/watcher_inner_anywhere.js';
// The places' plates and him, in the renderer's order.
const LAYERS = ['places-a', 'places-b', 'places-c', 'hero'];
let resources;
// Wait for load, not decode(): decode() never settles in a hidden tab.
function image(name) {
  return new Promise((done, failed) => {
    const node = new Image();
    node.onload = () => done(node);
    node.onerror = () => failed(new Error(`inner-anywhere: ${name}.webp did not load`));
    node.src = new URL(`./assets/${name}.webp`, import.meta.url).href;
  });
}
export async function mount(canvas) {
  resources ??= Promise.all([init(), ...LAYERS.map(image)]).catch(error => { resources = undefined; throw error; });
  const [, ...layers] = await resources;
  // Rust links the shaders in the background first; the renderer's own links
  // then come from the browser's program cache instead of freezing the page.
  let programs = warm(canvas);
  while (!programs.done()) await new Promise(resolve => setTimeout(resolve, 50));
  const renderer = new InnerAnywhere(canvas, ...layers);
  const dispose = renderer.dispose.bind(renderer);
  renderer.dispose = () => { programs?.free(); programs = undefined; dispose(); };
  renderer.soft_edges(true);
  return renderer;
}
