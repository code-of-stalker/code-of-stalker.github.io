// Platform bridge only: decode the immutable layers and construct the Rust renderer.
// Light themes draw the light paintings (assets-light); dark themes the originals.
import init, { SphereHero } from './pkg/watcher_sphere_hero.js';
const LAYERS = ['parallax-base', 'reflection', 'figure', 'foreground'];
const resources = {};
async function image(folder, name) {
  const node = new Image();
  node.src = new URL(`./${folder}/${name}.webp`, import.meta.url).href;
  await node.decode();
  return node;
}
export async function mount(canvas, { light = false } = {}) {
  const folder = light ? 'assets-light' : 'assets';
  resources[folder] ??= Promise.all([init(), ...LAYERS.map(name => image(folder, name))])
    .catch(error => { resources[folder] = undefined; throw error; });
  const [, world, reflection, figure, front] = await resources[folder];
  const renderer = new SphereHero(canvas, world, reflection, figure, front, light);
  renderer.soft_edges(true);
  return renderer;
}
