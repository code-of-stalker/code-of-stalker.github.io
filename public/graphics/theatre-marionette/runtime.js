// Platform bridge only: decode immutable artwork and construct the Rust renderer.
import init, { Marionette } from './pkg/watcher_theatre_marionette.js';
let resources;
async function image(name) {
  const node = new Image();
  node.src = new URL(`./assets/${name}.png`, import.meta.url).href;
  await node.decode();
  return node;
}
export async function mount(canvas) {
  resources ??= Promise.all([init(), image('original'), image('background'), image('heroine')])
    .catch(error => { resources = undefined; throw error; });
  const [, source, background, heroine] = await resources;
  return new Marionette(canvas, source, background, heroine);
}
