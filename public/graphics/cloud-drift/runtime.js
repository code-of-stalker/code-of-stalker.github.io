// Application bridge: decoding and construction only; the Rust module draws everything.
// Light themes draw the light paintings (assets-light, WebP); dark themes the originals.
import init, { CloudDrift, warm } from './pkg/watcher_cloud_drift.js';
const resources = {};
async function image(folder, name) {
  const node = new Image();
  node.src = new URL(`./${folder}/${name}.webp`, import.meta.url).href;
  await node.decode();
  return node;
}
export async function mount(canvas, { light = false } = {}) {
  const folder = light ? 'assets-light' : 'assets';
  // The light paintings add the matte of their floating visions.
  const names = ['original', 'background-clean', 'hero', ...(light ? ['objects'] : [])];
  resources[folder] ??= Promise.all([init(), ...names.map(name => image(folder, name))])
    .catch(error => { resources[folder] = undefined; throw error; });
  const [, source, background, hero, matte] = await resources[folder];
  // Rust links the shaders in the background first; the renderer's own links
  // then come from the browser's program cache instead of freezing the page.
  let programs = warm(canvas);
  while (!programs.done()) await new Promise(resolve => setTimeout(resolve, 50));
  const renderer = new CloudDrift(canvas, source, background, hero, matte);
  const dispose = renderer.dispose.bind(renderer);
  renderer.dispose = () => { programs?.free(); programs = undefined; dispose(); };
  return renderer;
}
