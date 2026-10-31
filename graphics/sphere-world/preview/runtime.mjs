// Platform bridge only: decode the immutable panorama and construct the Rust renderer.
import init, { SphereWorld } from './pkg/watcher_sphere_world.js';
let resources;
async function image() {
  const node = new Image();
  node.src = new URL('./assets/panorama.webp', import.meta.url).href;
  await node.decode();
  return node;
}
export async function mount(canvas) {
  resources ??= Promise.all([init(), image()]).catch(error => { resources = undefined; throw error; });
  const [, world] = await resources;
  const renderer = new SphereWorld(canvas, world);
  renderer.soft_edges(true);
  return renderer;
}
