// Platform bridge only: decode the immutable painting and depth map and
// construct the Rust renderer.
import init, { LighthouseHero } from './pkg/watcher_lighthouse_hero.js';
let resources;
async function image(name) {
  const node = new Image();
  node.src = new URL(`./assets/${name}.webp`, import.meta.url).href;
  await node.decode();
  return node;
}
export async function mount(canvas) {
  resources ??= Promise.all([init(), image('painting'), image('depth')])
    .catch(error => { resources = undefined; throw error; });
  const [, painting, depth] = await resources;
  const renderer = new LighthouseHero(canvas, painting, depth);
  renderer.soft_edges(true);
  return renderer;
}
