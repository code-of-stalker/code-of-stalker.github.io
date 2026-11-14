// Decode four immutable sources. Rust selects the material pair and owns its
// two GPU textures; no theme selection or recoloring takes place in JavaScript.
import init, { Witnessing, warm } from './pkg/watcher_witnessing.js';
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
  // Rust links the shaders in the background first; the renderer's own links
  // then come from the browser's program cache instead of freezing the page.
  let programs = warm(canvas);
  while (!programs.done()) await new Promise(resolve => setTimeout(resolve, 50));
  const renderer = new Witnessing(canvas, darkHand, darkWorld, lightHand, lightWorld);
  const dispose = renderer.dispose.bind(renderer);
  renderer.dispose = () => { programs?.free(); programs = undefined; dispose(); };
  renderer.soft_edges(true);
  return renderer;
}
