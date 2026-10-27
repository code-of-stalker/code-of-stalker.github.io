// Platform bridge only: decode immutable artwork and construct the Rust renderer.
// Light themes draw the light paintings (assets-light, WebP); dark themes the originals.
import init, { Marionette } from './pkg/watcher_theatre_marionette.js';
const resources = {};
async function image(folder, name) {
  const node = new Image();
  node.src = new URL(`./${folder}/${name}.webp`, import.meta.url).href;
  await node.decode();
  return node;
}
export async function mount(canvas, { light = false } = {}) {
  const folder = light ? 'assets-light' : 'assets';
  resources[folder] ??= Promise.all([init(), ...['original', 'background', 'heroine'].map(name => image(folder, name))])
    .catch(error => { resources[folder] = undefined; throw error; });
  const [, source, background, heroine] = await resources[folder];
  const renderer = new Marionette(canvas, source, background, heroine);
  renderer.soft_edges(true);
  renderer.light_paintings(light);
  return renderer;
}
