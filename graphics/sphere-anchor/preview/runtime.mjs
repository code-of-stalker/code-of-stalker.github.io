// Platform bridge only: decode the immutable figure and construct the Rust renderer.
import init, { SphereAnchor, warm } from './pkg/watcher_sphere_anchor.js';
let resources;
async function image() {
  const node = new Image();
  node.src = new URL('./assets/avatar.webp', import.meta.url).href;
  await node.decode();
  return node;
}
export async function mount(canvas) {
  resources ??= Promise.all([init(), image()]).catch(error => { resources = undefined; throw error; });
  const [, figure] = await resources;
  // Rust links the shaders in the background first; the renderer's own links
  // then come from the browser's program cache instead of freezing the page.
  let programs = warm(canvas);
  while (!programs.done()) await new Promise(resolve => setTimeout(resolve, 50));
  const renderer = new SphereAnchor(canvas, figure);
  const dispose = renderer.dispose.bind(renderer);
  renderer.dispose = () => { programs?.free(); programs = undefined; dispose(); };
  renderer.soft_edges(true);
  return renderer;
}
