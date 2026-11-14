// Platform bridge only: decode the immutable layers and construct the Rust renderer.
// Light themes draw the light paintings (assets-light); dark themes the originals.
import init, { SphereHero, warm } from './pkg/watcher_sphere_hero.js';
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
  // Rust links the shaders in the background first; the renderer's own links
  // then come from the browser's program cache instead of freezing the page.
  let programs = warm(canvas);
  while (!programs.done()) await new Promise(resolve => setTimeout(resolve, 50));
  const renderer = new SphereHero(canvas, world, reflection, figure, front, light);
  const dispose = renderer.dispose.bind(renderer);
  renderer.dispose = () => { programs?.free(); programs = undefined; dispose(); };
  renderer.soft_edges(true);
  return renderer;
}
