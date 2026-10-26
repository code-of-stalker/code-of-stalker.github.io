// Platform bridge only: decode immutable artwork and construct the Rust renderer.
import init, { WorldInGlasses } from './pkg/watcher_world_in_glasses.js';
let resources;
async function image(name) {
  const node = new Image();
  node.src = new URL(`./assets/${name}.webp`, import.meta.url).href;
  await node.decode();
  return node;
}
export async function mount(canvas) {
  resources ??= Promise.all([init(), ...['original', 'background', 'figure', 'mouths', 'world'].map(image)])
    .catch(error => { resources = undefined; throw error; });
  const [, original, background, figure, mouths, world] = await resources;
  const renderer = new WorldInGlasses(canvas, original, background, figure, mouths, world);
  renderer.soft_edges(true);
  return renderer;
}
