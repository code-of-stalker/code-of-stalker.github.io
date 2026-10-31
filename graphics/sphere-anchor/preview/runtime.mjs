// Platform bridge only: decode the immutable figure and construct the Rust renderer.
import init, { SphereAnchor } from './pkg/watcher_sphere_anchor.js';
let resources;
async function image() {
  const node = new Image();
  node.src = new URL('./assets/avatar.webp', import.meta.url).href;
  await node.decode();
  return node;
}
export async function mount(canvas) {
  resources ??= Promise.all([init(), image()]).catch(error => { resources = undefined; throw error; });
  const [, figure] = await resources;
  const renderer = new SphereAnchor(canvas, figure);
  renderer.soft_edges(true);
  return renderer;
}
