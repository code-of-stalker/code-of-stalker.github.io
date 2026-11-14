// Platform bridge only: decode the two immutable illustrations and construct Rust.
import init, { Awakening, warm } from './pkg/watcher_awakening.js';
let resources;
async function image(name) {
  const node = new Image();
  node.src = new URL(`./assets/${name}.png`, import.meta.url).href;
  await node.decode();
  return node;
}
export async function mount(canvas) {
  resources ??= Promise.all([init(), image('portrait-cutout'), image('mask')])
    .catch(error => { resources = undefined; throw error; });
  const [, figure, mask] = await resources;
  // Rust links the shaders in the background first; the renderer's own links
  // then come from the browser's program cache instead of freezing the page.
  let programs = warm(canvas);
  while (!programs.done()) await new Promise(resolve => setTimeout(resolve, 50));
  const renderer = new Awakening(canvas, figure, mask);
  const dispose = renderer.dispose.bind(renderer);
  renderer.dispose = () => { programs?.free(); programs = undefined; dispose(); };
  renderer.soft_edges(true);
  return renderer;
}
