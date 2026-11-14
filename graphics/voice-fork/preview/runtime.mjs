// Platform bridge only: decode the immutable figure and construct the Rust
// renderer.
import init, { VoiceFork } from './pkg/watcher_voice_fork.js';
let resources;
async function image(name) {
  const node = new Image();
  node.src = new URL(`./assets/${name}.webp`, import.meta.url).href;
  await node.decode();
  return node;
}
export async function mount(canvas) {
  resources ??= Promise.all([init(), image('figure')])
    .catch(error => { resources = undefined; throw error; });
  const [, figure] = await resources;
  const renderer = new VoiceFork(canvas, figure);
  renderer.soft_edges(true);
  return renderer;
}
