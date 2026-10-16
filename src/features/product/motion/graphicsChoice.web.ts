/** Pick once for this app instance: navigation does not change the renderer.
 * The SVG motion adapter is a migration preview, explicitly distinct from wgpu. */
const choice = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('graphics');
export const graphicsChoice = choice === 'legacy' ? 'legacy' : choice === 'rust-motion' ? 'rust-motion' : choice === 'rust-gpu' ? 'rust-gpu' : 'rust';
