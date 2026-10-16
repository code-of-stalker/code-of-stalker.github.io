import { insertPerson, insertRuntime } from './stepTwoInserts.generated';
import { bookProjectionPalette } from './bookProjection';
import { colors } from '../theme';

export type StepTwoInsert = 'reflections' | 'single-hero';

/** Authored silhouettes, layered light and physical portrait planes; no filters. */
export function stepTwoInsertHtml(kind: StepTwoInsert, reducedMotion: boolean) {
  const reflection = kind === 'reflections';
  const sides = [-2, 2, -1, 1]; // Distant planes are painted first.
  const normalize = 'translate(-27.65 2.9) scale(.054)';
  const palette = bookProjectionPalette(colors);
  const variables = Object.entries(palette.colors).map(([key, value]) => `--book-${key}:${value}`).join(';');
  const portraits = sides.map((side,i) => `<g class="echo" data-side="${side}" data-index="${i}">
    <ellipse class="echo-footing" cy="${reflection ? 99 : 84}" rx="18" ry="2.5" fill="url(#ground-light)" opacity=".3"/>
    <g class="echo-plane">
      ${reflection ? `<path d="M23 4L25 5.5V97.5L23 96Z M-23 96L-21 97.5H25L23 96Z" fill="var(--book-edge)" stroke="var(--book-ink)" stroke-width=".25" stroke-opacity=".3"/>
      <use class="pane" href="#portrait-pane" fill="var(--book-cover)" stroke="var(--book-ink)" stroke-width=".4"/>
      <use href="#portrait-pane" fill="url(#pane-light)"/>
      <path d="M-21 94V6H21" stroke="var(--book-light)" stroke-width=".25" stroke-opacity=".22"/>
      <g clip-path="url(#projection-pane-clip)"><g class="echo-portrait" transform="translate(0 10) scale(.9)">` : '<g class="echo-portrait">'}
        <g class="echo-body" mask="url(#echo-mask-${i})"><use href="#mini-person"/></g>
        <g class="echo-scan" opacity="0" clip-path="url(#person-clip)"><rect x="-25" y="-12" width="50" height="7" fill="url(#scan-light)"/></g>
        ${reflection ? '' : `<g class="echo-flecks">${Array.from({length:12},(_,j)=>`<path class="echo-fleck" data-n="${j}" stroke="var(--book-light)" stroke-width=".3" stroke-linecap="round" opacity="0"/>`).join('')}</g>`}
      ${reflection ? '</g></g><g clip-path="url(#projection-pane-clip)"><path class="pane-sheen" d="M-10-4H3L28 104H15Z" fill="url(#pane-sheen)"/></g><use class="pane-glint" href="#portrait-pane" stroke="var(--book-light)" stroke-width=".65" stroke-dasharray="12 264" stroke-linecap="round"/>' : '</g>'}
    </g>
  </g>`).join('');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';script-src 'unsafe-inline';style-src 'unsafe-inline'"><style>:root{${variables}}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}svg{display:block;width:100%;height:100%;pointer-events:none}</style></head><body>
  <svg class="step-insert" data-kind="${kind}" viewBox="0 0 288 104" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${reflection ? 'Свет героя проявляет отражения в повёрнутых стеклянных портретах. Отражения исчезают, источник остаётся.' : 'Свет проходит через окружающие образы, стирая их контуры. В фокусе остаётся один Главный Герой.'}">
  <defs>${insertPerson}
    <g id="mini-person"><g transform="${normalize}"><use href="#insert-man-shape" fill="var(--book-cover)" stroke="var(--book-ink)" stroke-width="7.5" stroke-linejoin="round"/><use href="#insert-man-shape" fill="url(#body-light)"/><use href="#insert-man-lines" fill="var(--book-ink)" opacity=".62"/></g></g>
    <path id="portrait-pane" d="M-23 4H23V96H-23Z"/>
    <clipPath id="person-clip"><use href="#insert-man-shape" transform="${normalize}"/></clipPath>
    <clipPath id="projection-pane-clip"><path d="M-22 5H22V95H-22Z"/></clipPath>
    <linearGradient id="body-light" x1="0" y1="0" x2=".6" y2="1"><stop stop-color="var(--book-light)" stop-opacity=".015"/><stop offset=".35" stop-color="var(--book-ink)" stop-opacity=".14"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity=".025"/></linearGradient>
    <linearGradient id="pane-light" x2="1" y2="1"><stop stop-color="var(--book-light)" stop-opacity=".025"/><stop offset=".48" stop-color="var(--book-ink)" stop-opacity=".055"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity=".015"/></linearGradient>
    <linearGradient id="pane-sheen"><stop stop-color="var(--book-light)" stop-opacity="0"/><stop offset=".65" stop-color="var(--book-light)" stop-opacity=".16"/><stop offset="1" stop-color="var(--book-light)" stop-opacity="0"/></linearGradient>
    <radialGradient id="heart-light"><stop stop-color="var(--book-light)" stop-opacity=".8"/><stop offset=".1" stop-color="var(--book-light)" stop-opacity=".4"/><stop offset=".36" stop-color="var(--book-ink)" stop-opacity=".1"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient>
    <radialGradient id="ground-light"><stop stop-color="var(--book-ink)" stop-opacity=".2"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient>
    <linearGradient id="scan-light" x2="0" y2="1"><stop stop-color="var(--book-light)" stop-opacity="0"/><stop offset=".5" stop-color="var(--book-light)" stop-opacity=".9"/><stop offset="1" stop-color="var(--book-light)" stop-opacity="0"/></linearGradient>
    <linearGradient id="projection-light" x1="0" y1=".5" x2="1" y2=".5"><stop stop-color="var(--book-ink)" stop-opacity="0"/><stop offset=".5" stop-color="var(--book-light)" stop-opacity=".07"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></linearGradient>
    <linearGradient id="focus-light" x2="0" y2="1"><stop stop-color="var(--book-light)" stop-opacity="0"/><stop offset=".3" stop-color="var(--book-light)" stop-opacity=".045"/><stop offset=".8" stop-color="var(--book-ink)" stop-opacity=".07"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></linearGradient>
    ${sides.map((_,i)=>`<linearGradient id="echo-erode-${i}" class="echo-erode" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="-12" y2="-6"><stop stop-color="black"/><stop offset="1" stop-color="white"/></linearGradient><mask id="echo-mask-${i}" maskUnits="userSpaceOnUse" x="-30" y="-14" width="60" height="118"><rect x="-30" y="-14" width="60" height="118" fill="url(#echo-erode-${i})"/></mask>`).join('')}
  </defs>
  <g class="mini-stage">
    <ellipse class="space-ground" cx="144" cy="85" rx="115" ry="7" fill="url(#ground-light)" opacity=".18"/>
    <path class="focus-column" d="M133 89Q137 38 142 0H146Q151 38 155 89Z" fill="url(#focus-light)" opacity="0"/>
    <g class="projection-rays">${sides.map(()=>'<path class="projection-fan" fill="url(#projection-light)"/><path class="projection-thread" stroke="var(--book-ink)" stroke-width=".25"/><path class="projection-trace" stroke="var(--book-light)" stroke-width=".5" stroke-linecap="round"/>').join('')}</g>
    ${reflection ? '' : '<ellipse class="focus-wave" cx="144" cy="84" rx="1" ry=".2" stroke="var(--book-light)" stroke-width=".35" opacity="0"/><g class="story-thread-back" opacity="0"><path class="story-back-soft" stroke="var(--book-ink)" stroke-width="1.2" stroke-opacity=".08"/><path class="story-back-core" stroke="var(--book-ink)" stroke-width=".3" stroke-opacity=".32"/></g>'}
    ${portraits}
    <g class="hero" transform="translate(144 0)">
      <ellipse class="ground" cy="84" rx="28" ry="4" fill="url(#ground-light)" opacity=".35"/>
      <g class="hero-body"><use href="#mini-person"/><use class="hero-infusion" href="#insert-man-shape" transform="${normalize}" fill="var(--book-light)" opacity="0"/></g>
      <g class="heart" transform="translate(0 22.4)"><circle class="heart-halo" r="16" fill="url(#heart-light)"/><circle class="heart-inner" r="4" fill="url(#heart-light)"/><path class="heart-ray" d="M-6 0H6M0-7V7" stroke="var(--book-light)" stroke-width=".2" opacity=".15"/><circle class="heart-core" r=".7" fill="var(--book-light)"/></g>
    </g>
    ${reflection ? '' : '<g class="story-thread-front" opacity="0"><path class="story-front-soft" stroke="var(--book-light)" stroke-width="1.1" stroke-opacity=".1"/><path class="story-front-core" stroke="var(--book-light)" stroke-width=".4" stroke-opacity=".8"/></g>'}
  </g></svg><script>${insertRuntime}</script><script>window.WatcherArt.update({reducedMotion:${JSON.stringify(reducedMotion)}});</script></body></html>`;
}
