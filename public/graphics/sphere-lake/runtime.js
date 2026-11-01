// Platform bridge only: decode the immutable lake painting and construct the Rust renderer.
import init, { SphereLake } from './pkg/watcher_sphere_lake.js';
let resources;
async function image(name) {
  const node = new Image();
  node.src = new URL(`./assets/${name}.webp`, import.meta.url).href;
  await node.decode();
  return node;
}
export async function mount(canvas) {
  resources ??= Promise.all([init(), image('lake')]).catch(error => { resources = undefined; throw error; });
  const [, lake] = await resources;
  const renderer = new SphereLake(canvas, lake);
  renderer.soft_edges(true);
  return renderer;
}
