// Decode four immutable sources. Rust selects the material pair and owns its
// two GPU textures; no theme selection or recoloring takes place in JavaScript.
import init, { Witnessing } from './pkg/watcher_witnessing.js';
let resources;
async function image(name) {
  const image = new Image();
  image.src = new URL(`./assets/${name}.png`, import.meta.url).href;
  await image.decode();
  return image;
}
export async function mount(canvas) {
  resources ??= Promise.all([
    init(), image('hand-v2'), image('world'), image('hand-light'), image('world-light'),
  ]).catch(error => {
    resources = undefined;
    throw error;
  });
  const [, darkHand, darkWorld, lightHand, lightWorld] = await resources;
  const renderer = new Witnessing(canvas, darkHand, darkWorld, lightHand, lightWorld);
  renderer.soft_edges(true);
  return renderer;
}
