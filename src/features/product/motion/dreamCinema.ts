import { insertPerson } from './stepTwoInserts.generated';
import { dreamCinemaRuntime, heroPoses } from './dreamCinema.generated';
import { bookProjectionPalette } from './bookProjection';
import { colors } from '../theme';
import { artLabels } from './types';

type CinemaKind = 'dream-world' | 'dream-wake';

// The same places reappear in the waking scene: recollection has a visual history.
const person = `<g class="solid-person" transform="translate(-27.65 2.9) scale(.054)"><use href="#insert-man-shape" fill="var(--book-cover)" stroke="var(--book-ink)" stroke-width="7"/><use href="#insert-man-lines" fill="var(--book-ink)" opacity=".52"/></g>`;
const moon = `<g class="scene-moon" transform="translate(195 70)"><circle r="14" fill="var(--book-cover)"/><circle r="14" fill="url(#cinema-moon)" stroke="var(--book-ink)" stroke-width=".55" stroke-opacity=".65"/><path d="M-8-9A12 12 0 0 0 7 10" stroke="var(--book-light)" stroke-width=".35" opacity=".3"/></g>`;

function platform(cx: number, cy: number, width: number, landing = false) {
  const back = landing ? 24 : width - 3, shift = landing ? 0 : 3;
  const depth = landing ? 6 : 5, rearY = cy - depth, frontY = cy + depth, thickness = landing ? 3.5 : 2.5;
  return `<g class="bridge-platform" fill="var(--book-cover)" stroke="var(--book-ink)" stroke-width=".5" stroke-linejoin="round">
    <path class="platform-right" d="M${cx+shift+back} ${rearY}L${cx+width} ${frontY}V${frontY+thickness}L${cx+shift+back} ${rearY+thickness}Z" fill="var(--book-edge)" stroke-opacity=".42"/>
    <path class="platform-front" d="M${cx-width} ${frontY}H${cx+width}V${frontY+thickness}H${cx-width}Z" fill="var(--book-paper)" stroke-opacity=".56"/>
    <path class="platform-top" d="M${cx+shift-back} ${rearY}H${cx+shift+back}L${cx+width} ${frontY}H${cx-width}Z" stroke-opacity=".75"/>
  </g>`;
}
function building(x: number, width: number, roof: number, rows: number) {
  return `<g class="city-building" fill="var(--book-cover)" stroke="var(--book-ink)" stroke-width=".45" stroke-opacity=".55">
    <path d="M${x+width} ${roof}L${x+width+7} ${roof-5}V123L${x+width} 128Z" fill="var(--book-edge)" stroke-opacity=".38"/>
    <path d="M${x} ${roof}L${x+7} ${roof-5}H${x+width+7}L${x+width} ${roof}Z" fill="var(--book-paper)"/>
    <path d="M${x} 128V${roof}H${x+width}V128Z"/>
    <path d="M${x+3} ${roof+3}H${x+width-3}M${x+width/2-3} 128V119H${x+width/2+3}V128" fill="none" stroke-opacity=".28"/>
    <g fill="var(--book-ink)" stroke="none" opacity=".32">${Array.from({length:rows},(_,r)=>[0,1,2].map(c=>`<rect x="${x+5+c*(width-13)/2}" y="${roof+10+r*11}" width="3" height="4"/>`).join('')).join('')}</g>
  </g>`;
}
function carriage(x: number, cab = false) {
  return `<g class="train-carriage" transform="translate(${x} 0)" stroke="var(--book-ink)" stroke-width=".55" stroke-linejoin="round">
    <g fill="var(--book-cover)"><circle class="train-wheel" cx="8" cy="-2" r="2"/><circle class="train-wheel" cx="31" cy="-2" r="2"/></g>
    <path d="${cab?'M1-3V-15Q1-19 5-19H29Q33-19 36-14L42-5V-3Z':'M1-3V-15Q1-19 5-19H35Q39-19 39-15V-3Z'}" fill="var(--book-paper)"/>
    <path d="M3-7H${cab?38:37}M4-21H29" fill="none" stroke-width=".35" stroke-opacity=".5"/>
    <g fill="var(--book-light)" stroke="none" opacity=".62">${[7,16,25].map(cx=>`<rect x="${cx}" y="-15" width="5" height="4" rx=".4"/>`).join('')}</g>
    <path d="M13-17V-5M22-17V-5" stroke-width=".3" stroke-opacity=".32"/>
    ${cab?'<path d="M32-15L36-9H32Z" fill="var(--book-light)" stroke="none" opacity=".6"/><circle cx="40" cy="-6" r="5" fill="url(#cinema-light)" stroke="none"/><circle cx="40" cy="-6" r=".5" fill="var(--book-light)" stroke="none"/>':''}
  </g>`;
}
const city = `
  <ellipse cx="158" cy="103" rx="122" ry="84" fill="url(#cinema-atmosphere)"/>
  ${moon}
  <path class="city-ground" d="M12 122H276V177H12Z" fill="var(--book-cover)"/>
  ${building(28,32,64,5)}${building(68,36,39,7)}${building(113,31,72,4)}${building(226,34,83,3)}
  <path d="M78 39V32H94V39M86 32V23" fill="none" stroke="var(--book-ink)" stroke-width=".45" stroke-opacity=".5"/>
  <g class="city-lights" fill="var(--book-light)" opacity=".65"><path d="M73 71h3v4h-3ZM96 104h3v4h-3ZM118 93h3v4h-3ZM241.5 104h3v4h-3Z"/></g>
  <g class="city-sidewalk" stroke="var(--book-ink)" stroke-width=".45">
    <path d="M12 128H276V142H12Z" fill="var(--book-paper)" stroke-opacity=".4"/>
    <path d="M12 142H276V145H12Z" fill="var(--book-edge)" stroke-opacity=".55"/>
    <path d="${[36,78,120,162,204,246].map(x=>`M${x} 129v12`).join('')}" stroke-width=".3" stroke-opacity=".18"/>
  </g>
  <g class="city-traveler" transform="translate(122 107.8) scale(.4)">${person}</g>
  <g class="city-passer" transform="translate(185 112.44) scale(.32)" stroke-opacity=".6">${person}</g>
  <g class="rail-bed" stroke="var(--book-ink)" fill="var(--book-paper)">
    <path d="M12 158H276V174H12Z" stroke="none"/>
    <path d="${Array.from({length:18},(_,i)=>`M${20+i*15} 160v10`).join('')}" stroke-width="1.1" stroke-opacity=".2"/>
    <path class="train-track" d="M12 161H276M12 168H276" fill="none" stroke-width=".6" stroke-opacity=".65"/>
  </g>
  <g class="city-train" transform="translate(20 168)">
    <path class="train-couplings" d="${Array.from({length:9},(_,i)=>`M${-44*(i+1)+39}-7h6`).join('')}" stroke="var(--book-ink)" stroke-width=".8" stroke-opacity=".6"/>
    ${Array.from({length:10},(_,i)=>carriage(-44*(9-i),i===9)).join('')}
  </g>
  <ellipse cx="144" cy="181" rx="112" ry="16" fill="url(#cinema-ground)"/>`;

const lake = `
  <ellipse cx="147" cy="99" rx="127" ry="82" fill="url(#cinema-atmosphere)"/>
  ${moon}
  <g fill="var(--book-cover)" stroke="var(--book-ink)" stroke-linejoin="round">
    <path d="M16 119L55 72L78 93L112 42L145 95L171 88L208 116L233 90L275 122Z" stroke-width=".45" stroke-opacity=".52"/>
    <path d="M62 116L112 42L136 79L127 71L119 77L111 65L103 73L97 65M112 42L115 93L136 115M171 88L173 109L187 121M233 90L227 115" fill="none" stroke-width=".5" stroke-opacity=".46"/>
  </g>
  <path d="M21 129C79 121 207 122 272 129M30 139C91 132 195 133 258 139M49 152C95 145 198 145 243 152M74 168C111 164 170 164 214 168" stroke="var(--book-ink)" stroke-width=".4" stroke-opacity=".27"/>
  <path d="M191 130H210M188 136H216M185 143H218M181 152H221M185 162H213" stroke="var(--book-light)" stroke-width=".6" stroke-opacity=".28"/>
  <g class="foreground-shore" fill="var(--book-cover)">
    <path class="foreground-mountain" d="M15 128L40 104L59 115L80 108L108 126V131H15Z"/>
    <path class="foreground-mountain" d="M187 126L218 110L238 117L269 108L280 127V131H187Z"/>
    <path d="M15 128L40 104L59 115L80 108L108 126M187 126L218 110L238 117L269 108L280 127" fill="none" stroke="var(--book-ink)" stroke-width=".55" stroke-opacity=".65"/>
  </g>
  <g class="lake-ripples" fill="none" stroke="var(--book-ink)" stroke-width=".4"><ellipse cx="139" cy="145" rx="30" ry="5" opacity=".35"/><ellipse cx="139" cy="145" rx="44" ry="7.5" opacity=".17"/></g>
  <g class="lake-boat">
    <path d="M104 140Q121 145 146 139L138 147Q119 151 110 145Z" fill="var(--book-cover)" stroke="var(--book-ink)" stroke-width=".7"/>
    <path d="M107 141Q128 145 143 140M122 125Q117 127 121 133L125 139M122 132L135 135L144 147" stroke="var(--book-ink)" stroke-width=".65" stroke-linecap="round"/>
    <path d="M141 146l6 4" stroke="var(--book-ink)" stroke-width="1.6" stroke-linecap="round"/>
    <ellipse cx="122" cy="122" rx="2" ry="2.6" fill="var(--book-cover)" stroke="var(--book-ink)" stroke-width=".55"/>
    <path d="M111 155Q128 159 144 153" stroke="var(--book-ink)" stroke-width=".4" opacity=".25"/>
  </g>
  <g class="lake-birds" stroke="var(--book-ink)" stroke-width=".55" stroke-linecap="round" opacity=".65"><path d="M54 53q4-4 8 0q4-4 8 0M74 64q3-3 6 0q3-3 6 0"/></g>
  <ellipse cx="144" cy="176" rx="111" ry="20" fill="url(#cinema-ground)"/>`;

const bridge = `
  <ellipse cx="164" cy="87" rx="119" ry="82" fill="url(#cinema-atmosphere)"/>
  <g class="threshold-space" fill="none" stroke="var(--book-ink)" stroke-width=".4">
    <path d="M18 140C67 133 75 72 127 89S221 169 279 135M36 156C88 135 91 95 127 105S225 178 269 150" opacity=".2"/>
    <path d="M42 33C72 9 122 16 136 42M37 44C72 19 112 29 123 48M68 20V38M95 21V36" opacity=".14"/>
    <path d="M91 98V58a16 16 0 0 1 32 0v30M97 93V59a10 10 0 0 1 20 0v23" opacity=".19"/>
    <g class="threshold-orbit orbit-a"><ellipse cx="195" cy="70" rx="72" ry="28" transform="rotate(-38 195 70)" opacity=".32"/><path d="M133 103l-4 3M256 31l5-3" opacity=".45"/><circle cx="136" cy="101" r="2.2" fill="var(--book-cover)" stroke-opacity=".65"/></g>
    <g class="threshold-orbit orbit-b"><path d="M133 41C161 19 233 38 260 72S244 124 207 115" opacity=".22"/><circle cx="255" cy="66" r="1.2" fill="var(--book-light)" stroke="none" opacity=".6"/></g>
    <g class="threshold-fragment fragment-a" fill="var(--book-cover)"><path d="M44 80l17-9 22 7-17 10Z" stroke-opacity=".6"/><path d="M44 80v5l22 8 17-10v-5M66 88v5" stroke-opacity=".32"/><path d="M57 66l10-5 12 4-10 6Z" stroke-opacity=".24"/></g>
    <g class="threshold-fragment fragment-b" fill="var(--book-cover)"><path d="M239 134l17-10 17 5-16 11Z" stroke-opacity=".58"/><path d="M239 134v5l18 7 16-12v-5M257 140v6" stroke-opacity=".3"/><path d="M251 113l9-5 10 3-9 6Z" stroke-opacity=".24"/></g>
    <path d="M32 107l4-2 4 2-4 2ZM146 26l2-4 2 4-2 4ZM246 170l3-2 3 2-3 2Z" stroke-opacity=".35"/>
    <path d="M57 109v12M51 115h12M267 97v8M263 101h8" stroke-opacity=".17"/>
  </g>
  <g class="bridge-door-light"><ellipse cx="195" cy="70" rx="30" ry="59" fill="url(#cinema-light)"/><path d="M176 114V50a19 19 0 0 1 38 0v64Z" fill="url(#cinema-door)"/></g>
  <path class="door-outer" d="M171 114V50a24 24 0 0 1 48 0v64Z" stroke="var(--book-ink)" stroke-width=".65" stroke-linejoin="round"/>
  <path d="M176 114V50a19 19 0 0 1 38 0v64" stroke="var(--book-ink)" stroke-width=".55"/>
  <path d="M183 52a12 12 0 0 1 24 0" stroke="var(--book-light)" stroke-width=".5" opacity=".56"/>
  <g class="threshold-depth" fill="none" stroke="var(--book-ink)" stroke-width=".35">
    <path d="M181 105V57a14 14 0 0 1 28 0v48M185 96V62a10 10 0 0 1 20 0v34M189 87V66a6 6 0 0 1 12 0v21" stroke-opacity=".26"/>
    <path d="M176 114L195 74L214 114M182 102h26M187 91h16" stroke-opacity=".17"/>
  </g>
  ${[[47,180,28],[83,166,26],[119,152,24],[155,138,22]].map(([x,y,w]) => platform(x,y,w)).join('')}
  ${platform(195,120,34,true)}
  <g class="bridge-traveler" transform="translate(99 92) scale(.6)">${person}</g>
  <g class="bridge-spark"><circle cx="195" cy="70" r="12" fill="url(#cinema-light)"/><circle cx="195" cy="70" r=".7" fill="var(--book-light)"/></g>
  <ellipse cx="144" cy="180" rx="111" ry="20" fill="url(#cinema-ground)"/>`;

function sleeper(kind: CinemaKind) {
  const pose = kind === 'dream-world' ? 'sleeping' : 'seated';
  return `<g class="approved-hero" data-pose="${pose}" transform="translate(18 6) scale(.25)">${heroPoses[pose]}</g>
    <g class="head-light"><circle r="17" fill="url(#cinema-light)"/><circle r=".65" fill="var(--book-light)" opacity=".65"/></g>`;
}

export const dreamWorlds = [city, lake, bridge];

export function dreamCinemaDefs() {
  return `<defs>${insertPerson}
    <radialGradient id="cinema-light"><stop stop-color="var(--book-light)" stop-opacity=".8"/><stop offset=".07" stop-color="var(--book-light)" stop-opacity=".5"/><stop offset=".23" stop-color="var(--book-ink)" stop-opacity=".17"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient>
    <radialGradient id="cinema-moon"><stop stop-color="var(--book-light)" stop-opacity=".27"/><stop offset=".7" stop-color="var(--book-ink)" stop-opacity=".08"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity=".015"/></radialGradient>
    <radialGradient id="cinema-atmosphere"><stop stop-color="var(--book-ink)" stop-opacity=".12"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient>
    <radialGradient id="cinema-ground"><stop stop-color="var(--book-ink)" stop-opacity=".14"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient>
    <linearGradient id="cinema-door" x2="0" y2="1"><stop stop-color="var(--book-light)" stop-opacity=".08"/><stop offset=".6" stop-color="var(--book-light)" stop-opacity=".26"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity=".03"/></linearGradient>
    <radialGradient id="cinema-feather"><stop offset=".68" stop-color="white"/><stop offset="1" stop-color="black"/></radialGradient>
    <mask id="cinema-edges"><rect width="288" height="206" fill="url(#cinema-feather)"/></mask>
    <path id="memory-shape" d="M24 28Q144 6 264 28V169Q144 195 24 169Z"/>
    <clipPath id="memory-clip"><use href="#memory-shape"/></clipPath>
    <mask id="memory-thread-occlusion" maskUnits="userSpaceOnUse" x="0" y="0" width="288" height="206"><rect width="288" height="206" fill="white"/><g fill="black">${[0,1,2].map(()=>'<use class="memory-thread-blocker" href="#memory-shape" opacity="0"/>').join('')}</g></mask>
  </defs>`;
}

export function dreamCinemaHtml(kind: CinemaKind, reducedMotion: boolean) {
  const palette = bookProjectionPalette(colors);
  const variables = Object.entries(palette.colors).map(([key, value]) => `--book-${key}:${value}`).join(';');
  const worlds = dreamWorlds;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';script-src 'unsafe-inline';style-src 'unsafe-inline'"><style>:root{${variables}}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}svg{display:block;width:100%;height:100%;pointer-events:none}.dream-cinema[data-kind="dream-world"]:not([data-still="true"]) .scene-moon,.dream-cinema[data-kind="dream-world"]:not([data-still="true"]) .door-outer{display:none}</style></head><body>
    <svg class="dream-insert dream-cinema" data-kind="${kind}" viewBox="0 0 288 206" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${artLabels[kind]}">
      ${dreamCinemaDefs()}
      <g class="cinema-stage" mask="url(#cinema-edges)">
        ${kind === 'dream-world' ? `<g class="sleep-camera"><g class="sleep-room">${sleeper(kind)}</g></g>` : ''}
        ${kind === 'dream-world' ? `
          <g class="dream-focus" opacity="0" transform="translate(195 70)">
            <circle class="focus-halo" r="36" fill="url(#cinema-light)"/>
            <path class="focus-solid" fill="var(--book-cover)"/>
            <path class="focus-surface" fill="url(#cinema-moon)"/>
            <path class="focus-contour" fill="none" stroke="var(--book-ink)" stroke-width=".55" stroke-opacity=".75"/>
            <path class="focus-crater" d="M-8-9A12 12 0 0 0 7 10" stroke="var(--book-light)" stroke-width=".35" opacity=".3"/>
          </g>
          ${worlds.map((world, i) => `<g class="cinema-world world-${i}" opacity="0"><g class="world-camera">${world}</g></g>`).join('')}` : `
          <g class="memory-threads" mask="url(#memory-thread-occlusion)" fill="none" stroke="var(--book-ink)" stroke-width=".4" stroke-opacity=".3"><path/><path/><path/></g>
          ${worlds.map((world, i) => `<g class="memory memory-${i}" opacity="0"><g clip-path="url(#memory-clip)"><use href="#memory-shape" fill="var(--book-cover)"/>${world}</g><path d="M24 61V28Q144 6 264 28V61M24 143V169Q144 195 264 169V143" stroke="var(--book-ink)" stroke-width=".65" stroke-opacity=".27"/></g>`).join('')}
          <g class="sleep-camera"><g class="sleep-room">${sleeper(kind)}</g></g>
          <g class="recollection-light" opacity="0"><circle r="17" fill="url(#cinema-light)"/><circle r=".7" fill="var(--book-light)"/></g>`}
      </g>
    </svg><script>${dreamCinemaRuntime}</script><script>window.WatcherArt.update({reducedMotion:${JSON.stringify(reducedMotion)}});</script></body></html>`;
}
