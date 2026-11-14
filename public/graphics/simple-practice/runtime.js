// Platform bridge only: decode the immutable figure and construct the Rust renderer.
import init, { SimplePractice, warm } from './pkg/watcher_simple_practice.js';
let resources;
async function image(name) {
  const node = new Image();
  node.src = new URL(`./assets/${name}.webp`, import.meta.url).href;
  await node.decode();
  return node;
}
export async function mount(canvas) {
  resources ??= Promise.all([init(), image('figure')])
    .catch(error => { resources = undefined; throw error; });
  const [, figure] = await resources;
  // Rust links the shaders in the background first; the renderer's own links
  // then come from the browser's program cache instead of freezing the page.
  let programs = warm(canvas);
  while (!programs.done()) await new Promise(resolve => setTimeout(resolve, 50));
  const renderer = new SimplePractice(canvas, figure);
  const dispose = renderer.dispose.bind(renderer);
  renderer.dispose = () => { programs?.free(); programs = undefined; dispose(); };
  renderer.soft_edges(true);
  return renderer;
}
