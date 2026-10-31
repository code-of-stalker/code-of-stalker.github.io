// Platform bridge only: decode the immutable panorama and its depth map and construct the Rust renderer.
import init, { SphereWorld } from './pkg/watcher_sphere_world.js';
let resources;
async function image(name) {
  const node = new Image();
  node.src = new URL(`./assets/${name}.webp`, import.meta.url).href;
  await node.decode();
  return node;
}
export async function mount(canvas) {
  resources ??= Promise.all([init(), image('panorama'), image('depth')]).catch(error => { resources = undefined; throw error; });
  const [, world, depth] = await resources;
  const renderer = new SphereWorld(canvas, world, depth);
  renderer.soft_edges(true);
  return renderer;
}
