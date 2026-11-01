// Platform bridge only: decode the immutable strip painting and construct the Rust renderer.
import init, { SphereEverywhere } from './pkg/watcher_sphere_everywhere.js';
let resources;
async function image(name) {
  const node = new Image();
  node.src = new URL(`./assets/${name}.webp`, import.meta.url).href;
  await node.decode();
  return node;
}
export async function mount(canvas) {
  resources ??= Promise.all([init(), image('strip')]).catch(error => { resources = undefined; throw error; });
  const [, strip] = await resources;
  const renderer = new SphereEverywhere(canvas, strip);
  renderer.soft_edges(true);
  return renderer;
}
