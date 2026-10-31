// Platform bridge only: decode the immutable painting and depth map and construct the Rust renderer.
import init, { SphereRoom } from './pkg/watcher_sphere_room.js';
let resources;
async function image(name) {
  const node = new Image();
  node.src = new URL(`./assets/${name}.webp`, import.meta.url).href;
  await node.decode();
  return node;
}
export async function mount(canvas) {
  resources ??= Promise.all([init(), image('room'), image('depth')]).catch(error => { resources = undefined; throw error; });
  const [, room, depth] = await resources;
  const renderer = new SphereRoom(canvas, room, depth);
  renderer.soft_edges(true);
  return renderer;
}
