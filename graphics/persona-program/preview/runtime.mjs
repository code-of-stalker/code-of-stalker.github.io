// Platform bridge only: decode the immutable inputs and construct the Rust renderer.
import init, { PersonaProgram } from './pkg/watcher_persona_program.js';
let resources;
async function image(name) {
  const node = new Image();
  node.src = new URL(`./assets/${name}.webp`, import.meta.url).href;
  await node.decode();
  return node;
}
export async function mount(canvas) {
  resources ??= Promise.all([init(), image('figure'), image('labels')])
    .catch(error => { resources = undefined; throw error; });
  const [, figure, labels] = await resources;
  const renderer = new PersonaProgram(canvas, figure, labels);
  renderer.soft_edges(true);
  return renderer;
}
