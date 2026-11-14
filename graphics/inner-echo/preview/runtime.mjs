// Platform bridge only: start the WASM module, load the words' atlas and
// construct the Rust renderer.
import init, { InnerEcho, warm } from './pkg/watcher_inner_echo.js';
let resources;
// Wait for load, not decode(): decode() never settles in a hidden tab.
function image(name) {
  return new Promise((done, failed) => {
    const node = new Image();
    node.onload = () => done(node);
    node.onerror = () => failed(new Error(`inner-echo: ${name}.webp did not load`));
    node.src = new URL(`./assets/${name}.webp`, import.meta.url).href;
  });
}
export async function mount(canvas) {
  resources ??= Promise.all([init(), image('labels')]).catch(error => { resources = undefined; throw error; });
  const [, labels] = await resources;
  // Rust links the shaders in the background first; the renderer's own links
  // then come from the browser's program cache instead of freezing the page.
  let programs = warm(canvas);
  while (!programs.done()) await new Promise(resolve => setTimeout(resolve, 50));
  const renderer = new InnerEcho(canvas, labels);
  const dispose = renderer.dispose.bind(renderer);
  renderer.dispose = () => { programs?.free(); programs = undefined; dispose(); };
  renderer.soft_edges(true);
  return renderer;
}
