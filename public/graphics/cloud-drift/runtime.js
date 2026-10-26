// Application bridge: decoding and construction only; the Rust module draws everything.
import init, { CloudDrift } from './pkg/watcher_cloud_drift.js';
let resources;
async function image(name) {
  const node = new Image();
  node.src = new URL(`./assets/${name}.png`, import.meta.url).href;
  await node.decode();
  return node;
}
export async function mount(canvas) {
  resources ??= Promise.all([init(), image('original'), image('background-clean'), image('hero')])
    .catch(error => { resources = undefined; throw error; });
  const [, source, background, hero] = await resources;
  return new CloudDrift(canvas, source, background, hero);
}
