// Platform bridge only: decode the two immutable illustrations and construct Rust.
import init, { Awakening } from './pkg/watcher_awakening.js';
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
  const renderer = new Awakening(canvas, figure, mask);
  renderer.soft_edges(true);
  return renderer;
}
