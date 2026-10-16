import { insertPerson } from './stepTwoInserts.generated';
import { inwardPeople, inwardRuntime } from './dreamInserts.generated';
import { bookProjectionPalette } from './bookProjection';
import { colors } from '../theme';

const projections = [
  { person: '05-woman-bob', x: 42, y: 43, scale: .78, start: 3.65 },
  { person: '02-man-crop', x: 91, y: 27, scale: .78, start: 3 },
  { person: '10-woman-pixie', x: 197, y: 27, scale: .78, start: 3.3 },
  { person: '07-man-parted', x: 246, y: 43, scale: .78, start: 3.95 },
];

const normalize = 'translate(-27.65 2.9) scale(.054)';

export function inwardProjectionHtml(reducedMotion: boolean) {
  const palette = bookProjectionPalette(colors);
  const variables = Object.entries(palette.colors).map(([key, value]) => `--book-${key}:${value}`).join(';');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';script-src 'unsafe-inline';style-src 'unsafe-inline'"><style>:root{${variables}}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}svg{display:block;width:100%;height:100%;pointer-events:none;color:var(--book-ink)}</style></head><body>
  <svg class="dream-insert inward-projection" data-kind="dream-inward" viewBox="0 0 288 136" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="На театральной сцене человеческие проекции растворяются в свет и вновь собираются из света главного героя">
    <defs>${insertPerson}${inwardPeople}
      <radialGradient id="inward-light"><stop stop-color="var(--book-light)" stop-opacity=".8"/><stop offset=".08" stop-color="var(--book-light)" stop-opacity=".4"/><stop offset=".3" stop-color="var(--book-ink)" stop-opacity=".12"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient>
      <radialGradient id="inward-ground"><stop stop-color="var(--book-ink)" stop-opacity=".16"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient>
      <linearGradient id="inward-body" x2="0" y2="1"><stop stop-color="var(--book-light)" stop-opacity=".015"/><stop offset=".32" stop-color="var(--book-ink)" stop-opacity=".11"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity=".015"/></linearGradient>
      <linearGradient id="inward-edge" x2="0" y2="1"><stop stop-color="var(--book-light)" stop-opacity="0"/><stop offset=".45" stop-color="var(--book-light)" stop-opacity=".8"/><stop offset="1" stop-color="var(--book-light)" stop-opacity="0"/></linearGradient>
      <path id="inward-stage-floor" d="M55 78H233L281 116H7Z"/>
      <clipPath id="inward-stage-floor-clip"><use href="#inward-stage-floor"/></clipPath>
      <linearGradient id="inward-stage-surface" x1="0" y1="78" x2="0" y2="116" gradientUnits="userSpaceOnUse"><stop stop-color="var(--book-cover)"/><stop offset="1" stop-color="var(--book-paper)"/></linearGradient>
      <linearGradient id="inward-stage-apron" x1="0" y1="116" x2="0" y2="124" gradientUnits="userSpaceOnUse"><stop stop-color="var(--book-edge)"/><stop offset="1" stop-color="var(--book-cover)"/></linearGradient>
      <linearGradient id="inward-curtain-fabric"><stop stop-color="var(--book-cover)"/><stop offset=".2" stop-color="var(--book-edge)"/><stop offset=".4" stop-color="var(--book-cover)"/><stop offset=".64" stop-color="var(--book-paper)"/><stop offset=".83" stop-color="var(--book-cover)"/><stop offset="1" stop-color="var(--book-edge)"/></linearGradient>
      <g id="inward-curtain-wing">
        <path d="M18 12H94C87 30 74 48 47 57C42 63 44 74 50 82L18 88Z" fill="url(#inward-curtain-fabric)" stroke="var(--book-ink)" stroke-width=".35" stroke-opacity=".3"/>
        <path d="M32 15C33 33 35 47 42 58C33 65 30 76 31 85M48 15C47 33 46 48 46 57C41 65 40 74 41 84M65 15C61 34 54 49 48 57M82 15C73 37 61 49 49 58" stroke="var(--book-ink)" stroke-width=".3" stroke-opacity=".2"/>
        <path d="M35 18C36 34 39 48 44 55M68 18C63 33 55 47 51 53" stroke="var(--book-light)" stroke-width=".25" stroke-opacity=".13"/>
        <path d="M36 57Q45 60 51 56L52 59Q44 63 36 60Z" fill="var(--book-paper)" stroke="var(--book-ink)" stroke-width=".3" stroke-opacity=".38"/>
      </g>
      ${projections.map(({person}, i) => `
      <linearGradient id="inward-erode-${i}" class="erode-gradient" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="-14" y2="-6"><stop stop-color="black"/><stop offset="1" stop-color="white"/></linearGradient>
      <mask id="inward-mask-${i}" maskUnits="userSpaceOnUse" x="-35" y="-12" width="70" height="112"><rect x="-35" y="-12" width="70" height="112" fill="url(#inward-erode-${i})"/></mask>
      <clipPath id="inward-person-${i}"><use href="#inward-shape-${person}" transform="${normalize}"/></clipPath>`).join('')}
    </defs>
    <g class="inward-stage">
      <g class="theatre-curtains">
        <path d="M18 10H270" stroke="var(--book-ink)" stroke-width=".35" stroke-opacity=".25"/>
        <path class="theatre-valance" d="M18 12H270V17C245 28 214 29 194 19C177 30 157 30 144 21C131 30 111 30 94 19C74 29 43 28 18 17Z" fill="var(--book-cover)" stroke="var(--book-ink)" stroke-width=".3" stroke-opacity=".23"/>
        <path d="M94 17Q119 32 144 19Q169 32 194 17" stroke="var(--book-ink)" stroke-width=".25" stroke-opacity=".12"/>
        <g class="theatre-curtain-left"><use href="#inward-curtain-wing"/></g>
        <g class="theatre-curtain-right"><use href="#inward-curtain-wing" transform="translate(288 0) scale(-1 1)"/></g>
      </g>
      <g class="inward-space" stroke="var(--book-ink)" stroke-linejoin="round">
        <path class="theatre-apron" d="M7 116H281V124H7Z" fill="url(#inward-stage-apron)" stroke-width=".35" stroke-opacity=".32"/>
        <use class="theatre-floor" href="#inward-stage-floor" fill="url(#inward-stage-surface)" stroke-width=".4" stroke-opacity=".32"/>
        <path class="theatre-floorboards" d="M77.25 78L41.25 116M99.5 78L75.5 116M121.75 78L109.75 116M144 78V116M166.25 78L178.25 116M188.5 78L212.5 116M210.75 78L246.75 116" stroke-width=".25" stroke-opacity=".13"/>
        <path d="M7 116H281" stroke="var(--book-light)" stroke-width=".45" stroke-opacity=".36"/>
        <path d="M7 119H281" stroke-width=".25" stroke-opacity=".12"/>
        <ellipse class="gather-ground" cx="144" cy="111" rx="45" ry="5" fill="url(#inward-ground)" stroke="none" clip-path="url(#inward-stage-floor-clip)"/>
      </g>
      <g class="return-ribbons" fill="none" stroke-linecap="round">
        ${projections.map(() => '<path class="return-ribbon" stroke="var(--book-ink)" stroke-width=".3"/><path class="return-highlight" stroke="var(--book-light)" stroke-width=".45"/>').join('')}
      </g>
      ${projections.map(({person,x,y,scale,start},i) => `
      <g class="human-projection" data-person="${person}" data-x="${x}" data-y="${y}" data-scale="${scale}" data-start="${start}" transform="translate(${x} ${y}) scale(${scale})" opacity="0">
        <ellipse class="projection-footing" cy="85" rx="15" ry="3" fill="url(#inward-ground)"/>
        <g class="projection-body" mask="url(#inward-mask-${i})">
          <g transform="${normalize}"><use class="projection-silhouette" href="#inward-shape-${person}" fill="var(--book-cover)" stroke="var(--book-ink)" stroke-width="6" stroke-opacity=".75" stroke-linejoin="round"/><use class="projection-drawing" href="#inward-drawing-${person}" fill="var(--book-ink)" opacity=".75"/></g>
        </g>
        <g class="projection-rim" clip-path="url(#inward-person-${i})" opacity="0"><rect x="-30" y="-12" width="60" height="9" fill="url(#inward-edge)"/></g>
      </g>`).join('')}
      <g class="inward-hero" transform="translate(144 28)">
        <g transform="${normalize}"><use href="#insert-man-shape" fill="var(--book-cover)" stroke="var(--book-ink)" stroke-width="7.5" stroke-linejoin="round"/><use href="#insert-man-shape" fill="url(#inward-body)"/><use href="#insert-man-lines" fill="var(--book-ink)" opacity=".62"/><use class="hero-infusion" href="#insert-man-shape" fill="var(--book-light)" opacity="0"/></g>
      </g>
      <g class="return-particles">
        ${projections.map((_,i) => `<g data-stream="${i}">${Array.from({length:26},(_,j) => `<g class="return-particle" data-n="${j}" opacity="0"><path class="particle-tail" d="M-4 0Q-1-.55 0 0Q-1 .55-4 0Z" fill="var(--book-ink)" opacity=".35"/><circle class="particle-halo" r="3" fill="url(#inward-light)"/><circle class="particle-core" r=".35" fill="var(--book-light)"/></g>`).join('')}</g>`).join('')}
      </g>
      <g class="inward-source" transform="translate(144 50.4)">
        <circle class="source-aura" r="16" fill="url(#inward-light)" opacity=".3"/>
        <circle class="source-inner" r="5" fill="url(#inward-light)"/>
        <path class="source-axis" d="M-5 0H5M0-6V6" stroke="var(--book-light)" stroke-width=".25" opacity=".15"/>
        <circle class="source-core" r=".7" fill="var(--book-light)"/>
      </g>
      <ellipse class="settle-ring" cx="144" cy="111" rx="18" ry="3.2" stroke="var(--book-ink)" stroke-width=".3" opacity="0" clip-path="url(#inward-stage-floor-clip)"/>
    </g>
  </svg><script>${inwardRuntime}</script><script>window.WatcherArt.update({reducedMotion:${JSON.stringify(reducedMotion)}});</script></body></html>`;
}
