import { sphereRuntime } from './dreamInserts.generated';
import { dreamCinemaDefs, dreamWorlds } from './dreamCinema';
import { bookProjectionPalette } from './bookProjection';
import { colors } from '../theme';

export function dreamSphereHtml(reducedMotion: boolean) {
  const palette = bookProjectionPalette(colors);
  const variables = Object.entries(palette.colors).map(([key, value]) => `--book-${key}:${value}`).join(';');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';script-src 'unsafe-inline';style-src 'unsafe-inline'"><style>:root{${variables}}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}svg{display:block;width:100%;height:100%;pointer-events:none}</style></head><body>
    <svg class="dream-insert dream-sphere" data-kind="dreamer" viewBox="0 0 288 136" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Один сновидец внутри полной объёмной сферы. Миры сменяются, кольца непрерывно проходят по поверхности">
      ${dreamCinemaDefs()}
      <defs>
        <clipPath id="sphere-clip"><circle cx="144" cy="68" r="59.5"/></clipPath>
        <radialGradient id="sphere-volume" cx=".34" cy=".27" r=".77"><stop stop-color="var(--book-light)" stop-opacity=".07"/><stop offset=".5" stop-color="var(--book-cover)" stop-opacity=".015"/><stop offset=".8" stop-color="var(--book-cover)" stop-opacity=".25"/><stop offset="1" stop-color="var(--book-cover)" stop-opacity=".85"/></radialGradient>
        <linearGradient id="sphere-rim" x1=".15" y1="0" x2=".85" y2="1"><stop stop-color="var(--book-light)" stop-opacity=".8"/><stop offset=".35" stop-color="var(--book-ink)" stop-opacity=".36"/><stop offset=".75" stop-color="var(--book-ink)" stop-opacity=".2"/><stop offset="1" stop-color="var(--book-light)" stop-opacity=".5"/></linearGradient>
        <linearGradient id="sphere-hero-fill" x2="0" y2="1"><stop stop-color="var(--book-light)" stop-opacity=".01"/><stop offset=".32" stop-color="var(--book-ink)" stop-opacity=".11"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity=".02"/></linearGradient>
      </defs>
      <ellipse cx="144" cy="130" rx="49" ry="4.5" fill="url(#cinema-ground)"/>
      <circle class="sphere-surface" cx="144" cy="68" r="60" fill="var(--book-cover)"/>
      ${[0,1].map(i => `<path class="sphere-ring-back" data-ring="${i}" stroke="var(--book-ink)" stroke-width=".35" stroke-opacity=".22" stroke-linecap="round"/>`).join('')}
      <g class="sphere-worlds" clip-path="url(#sphere-clip)">
        ${dreamWorlds.map((world,i) => `<g class="sphere-world" data-world="${i}" opacity="${i===0?1:0}"><g class="sphere-world-camera" transform="translate(144 68) scale(.46) translate(-144 -103)">${world}</g></g>`).join('')}
      </g>
      <circle cx="144" cy="68" r="59.8" fill="url(#sphere-volume)"/>
      <g class="sphere-observer" clip-path="url(#sphere-clip)">
        <ellipse cx="144" cy="114" rx="26" ry="4.5" fill="var(--book-cover)" opacity=".7"/>
        <g transform="translate(144 42) scale(.82) translate(-27.65 2.9) scale(.054)"><use href="#insert-man-shape" fill="var(--book-cover)" stroke="var(--book-ink)" stroke-width="8.5" stroke-linejoin="round"/><use href="#insert-man-shape" fill="url(#sphere-hero-fill)"/><use href="#insert-man-lines" fill="var(--book-ink)" opacity=".62"/></g>
        <g class="sphere-source" transform="translate(144 60.4)"><circle class="sphere-aura" r="16" fill="url(#cinema-light)"/><circle r=".7" fill="var(--book-light)"/></g>
      </g>
      <circle class="sphere-outline" cx="144" cy="68" r="60" stroke="url(#sphere-rim)" stroke-width=".65"/>
      <path d="M102 25A60 60 0 0 1 141 8" stroke="var(--book-light)" stroke-width=".3" stroke-opacity=".35" stroke-linecap="round"/>
      ${[0,1].map(i => `<path class="sphere-ring-front" data-ring="${i}" stroke="var(--book-light)" stroke-width=".5" stroke-opacity=".7" stroke-linecap="round"/>`).join('')}
    </svg><script>${sphereRuntime}</script><script>window.WatcherArt.update({reducedMotion:${JSON.stringify(reducedMotion)}});</script></body></html>`;
}
