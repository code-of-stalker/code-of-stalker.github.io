// Platform bridge only: decode the immutable input and construct the Rust renderer.
import init, { TrueSight } from './pkg/watcher_true_sight.js';
let resources;
async function image(name) {
  const node = new Image();
  node.src = new URL(`./assets/${name}.webp`, import.meta.url).href;
  await node.decode();
  return node;
}
export async function mount(canvas) {
  resources ??= Promise.all([init(), image('labels')])
    .catch(error => { resources = undefined; throw error; });
  const [, labels] = await resources;
  const renderer = new TrueSight(canvas, labels);
  renderer.soft_edges(true);
  return renderer;
}
