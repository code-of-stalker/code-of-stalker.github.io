// Platform bridge only: decode the immutable figure and construct the Rust renderer.
import init, { SimplePractice } from './pkg/watcher_simple_practice.js';
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
  const renderer = new SimplePractice(canvas, figure);
  renderer.soft_edges(true);
  return renderer;
}
