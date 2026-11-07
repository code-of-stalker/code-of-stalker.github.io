// Platform bridge only: decode the immutable input and construct the Rust renderer.
import init, { HeroLabyrinth } from './pkg/watcher_hero_labyrinth.js';
let resources;
async function image(name) {
  const node = new Image();
  node.src = new URL(`./assets/${name}.webp`, import.meta.url).href;
  await node.decode();
  return node;
}
export async function mount(canvas) {
  resources ??= Promise.all([init(), image('hero')])
    .catch(error => { resources = undefined; throw error; });
  const [, hero] = await resources;
  const renderer = new HeroLabyrinth(canvas, hero);
  renderer.soft_edges(true);
  return renderer;
}
