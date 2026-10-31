# Project state

Updated 2026-11-01. `main` = the merges of `fix/home-shade-band` (the vector engine honors
`preserveAspectRatio="none"`, so the home card shade spans the card instead of a centred strip),
`scene/call-bell` («Колокол» on «Сила Зова»), `scene/essence-flame` («Пламя» on
«Сущностные ощущения») and `scene/true-sight` («Глаз» on «Истинное распознавание»),
all 7 themes, all shipped 2026-10-31. Every Step 4 page now has its own scene.
Art's rule (2026-10-31): small fixes are pushed at once via `/ship-to-main`; big changes such
as animations stay local until he says to ship them. Unsure which it is: ask.
Keep this file short: replace stale lines instead of appending history (`/handoff`).

## Step 4 «Практика заземления и прямого узнавания»: page → scene
Text and page ids live in `src/features/product/stepFourContent.ts`. Two reading blocks
(6 + 8 pages) with four answerable questions between them; each block counts from 01.
Scenes are web only (Rust WebGL2); the native app keeps the engine art.

| Block/page | Page id, title | Scene crate | Image |
|---|---|---|---|
| 1 / 01 | grounding-default «Практика заземления и прямого узнавания» | world-in-glasses | girl in glasses among ruins, gold gum pops, the world cracks in the lenses (Art's lens mask) |
| 1 / 02 | grounding-absent «Где ты сейчас?» | cloud-drift (inline) | Art's painting with drifting clouds |
| 1 / 03 | grounding-automatic «Откуда берётся вывод?» | theatre-marionette | marionette theatre painting |
| 1 / 04 | grounding-contact «Простая практика» | simple-practice | seated figure, contact with the floor, presence light soles→crown; also the step 4 home card |
| 1 / 05 | grounding-speaking «Услышь своё состояние» | hear-state | one card per word, calm body scan, voice fronts |
| 1 / 06 | grounding-questions-origin «Вопросы настройки» | tuning-questions | conclusion as a waveform at lip height, sights over body points |
| questions | «Наблюдение или мысль?» as 4 questions | none (ObservationFlow) | voice answers like steps 1–2; hint = pages 04–06 |
| 2 / 01 | grounding-character «Персонаж: сон, в который поверил Абсолют» | persona-dream | plates lock into a mosaic shell over the person, matrix frame, «Я…» tags |
| 2 / 02 | grounding-program «Механизм обусловленности» | persona-program | the shell as a circuit, the same impulse path, six verbs on the card |
| 2 / 03 | grounding-belief «Я это действительно знаю?» | persona-belief «Оттиск» | macro of sand under a raking lamp, seals and imprints; no room, no person |
| 2 / 04 | grounding-call «Сила Зова» | call-bell «Колокол» | bell in a stone tower held by threads; threads snap, clapper strikes, sound floods the tower |
| 2 / 05 | grounding-awakening «Пробуждение» | awakening | portrait with a cracking, peeling mask |
| 2 / 06 | grounding-witnessing «Живое Осознавание» | witnessing | witnessing story, own light-theme artwork |
| 2 / 07 | grounding-recognition «Сущностные ощущения» | essence-flame «Пламя» | the candle is a wax figure of a person, flame in its crown; it melts into a plain candle, camera closes on the flame |
| 2 / 08 | grounding-real «Истинное распознавание» | true-sight «Глаз» | macro eye: dreams through the closed lid melt into each other; it opens, the world on the cornea becomes a grid that runs over the face; the lens goes through the pupil to a person of light |

Block 1 pages 04–06 and block 2 pages 01–02 share one look (dark room, seated person in
profile, card bottom-right, focus pulls). Do not make a sixth one like them.
Next: nothing queued; wait for Art.

## Step 5 «Внешнее кольцо» (branch `claude/step-5-sphere-fcddf0`)
Shipped to `main` 2026-10-31: hero, home card, forward scroll and page 01 (Art: «как сделаешь
первую анимацию запуш»), then page 01's head sway and page 02 «Якорь» (Art: «Пушим»), then page 03 «Скан комнаты» (Art: «Пушим»). 7 reading pages (text in `stepFiveContent.ts`), access via
step 4 page 14 or settings «ОТКРЫТЬ ПЯТЫЙ ШАГ». Art's illustration packs in `graphics/sphere-*/`,
briefs in `docs/step-five-illustrations-ru.md`. Page scenes go through `StepFiveScene.web.tsx`
(`webScene` on the page); pages without one keep their placeholder.
- Hero «Скан в глубине» (`graphics/sphere-hero`): drifting parallax camera, a wave of light from
  the feet every 10 s, the bird sings. All 7 themes (light: a muted two-ink print). Native and
  the web fallback keep Art's still (`StepFiveStill.tsx`). The home card from step 5 on plays it
  in card mode (Rust `cover(true)`).
- Step 4's last page (block 2, 08/08) scrolls on into Step 5 page 01.
- 01 «Мир вокруг» (`graphics/sphere-world`): we stand inside the sphere, the view turns once
  through Art's dark panorama in 90 s; beats at 2/20/38/56/74 s (gust, ripple, bird, ring with
  meridians, stars and a falling star). Light themes print the panorama as a sepia engraving
  (Art chose A). Prototype: 0 px lighter over the whole loop in Дюна/Мираж/Рассвет.
  Art asked for depth and a living head: a Depth Anything V2 depth map (`assets/depth.webp`,
  tools in `tools/`) gives parallax; the head sways, leans in and zooms a little at each beat;
  the pitch keeps the bird painted in the sky out of the 3:2 frame (Art: a still raster bird
  «выглядит тупо»).
- 02 «Якорь» (`graphics/sphere-anchor`): Art's glowing figure on a floor grid in a 48 s loop;
  the world stops, a band grounds the body, support points light, the form's outline draws up
  from the floor at 27 s, an axis and anchor sink in. After Art's notes: an even outline from a
  distance field (Rust `form_field`), Matrix-like dot rain in three depths behind, breathing,
  a soft floor reflection.
- 03 «Скан комнаты» (`graphics/sphere-room`, shipped to `main` 2026-10-31): Art's
  night room as a cloud of points placed by a depth map made here (`assets/depth.webp`); a plane
  of light sweeps the room once per list line and wakes one layer (sound waves, trees and
  curtain, floor draft, moonbeam motes, cup wisp and breathing, sphere and lattice); 60 s loop.
  Wired to page `sphere-scan`. Art OK'd Тишина («Ок, делай темы»); all 7 themes checked in the
  prototype (`output/prototypes/sphere-room/index.html`, sheets `kadry.jpg`, `temy.jpg`): light
  themes engrave in their inks, 0 px lighter than the page over the loop (120 frames each).
- Art chose direction A for every page (2026-10-31): 02 the figure on a floor grid, everything
  freezes, a wave down from the feet lights the support points; 03 the room as a point cloud
  with a scanner plane, one layer per list line; 04 a point → orbit ring → meridians → sphere,
  camera orbits 360°; 05 a dome of sound, each phrase «Я Здесь»…«Я Есть» adds a wave and a
  pattern belt; 06 stilling: the ripple weakens with each «Не…», the last leaves a mirror;
  07 the camera travels the strip (room, street, crowd, field), the sphere goes along.
- 04 «Ты не точка» (`graphics/sphere-orbit`, on the branch, not shipped): no images, all 3D.
  A point opens into a ticked ring with a runner, the ring rises into meridians and parallels
  (glints at the crossings), one wave crosses the sphere from each named side (30–46 s), all
  sides on «вокруг» (50 s); the camera orbits once per 60 s loop; near motes soft, far ones
  sharp like stars. Wired to page `sphere-expand`; the exported app mounts it at phone and
  wide sizes. Тишина prototype `output/prototypes/sphere-orbit/index.html`, sheet `frames.jpg`.
  Waits for Art's OK on Тишина; then the other 6 themes (light: 0 px lighter than the page).
- Next: 05–07, one crate each, Тишина first, prototype per page; ship each when Art says.

## Shipped features (all on main)
- Themes: 7, Матрица default (since 2026-10-31; Тишина before), settings list dark then light. Art's palettes: Мираж sand F1DFB8 / cobalt 2E5BD5 / lilac 9B6FAB /
  navy 263B6B; Рассвет peach F3D8C7 / wine 9C3857 / copper B77A43 / plum 603346; Матрица 00FF41
  on black; Искра F5DD07 on black.
- Adaptive layout (`productLayout` in `layout.ts`): phone < 600 keeps the 480 column; 600+ uses
  a 720 column; two home columns at width ≥ 900 in landscape. Sheets stay 480. Native is portrait only.
- Performance: engine WASM 55 → 8.8 MB via external assets fetched per scene; service worker
  installs after `watcher-graphics-ready`; lossless WebP.
- Skeleton loading (`graphics/skeleton`, `src/features/product/skeleton/`) on every screen.
- Soft wheel scroll in the «Плавность» mode (`graphics/soft-scroll`; opt out with
  `data-soft-scroll="off"`). Touch, keys and native stay native.
- Security: CSP and an address guard in the web shell; Pages build job is read-only;
  `/network`, `/sdk`, `/recovery` redirect to `/launch` on web.
- Scrolling crosses step boundaries both ways: back from the start of Steps 2, 3 and 4 into
  the end of the previous step (Step 2's cover fixed 2026-10-31); Step 3 end scrolls into Step 4.
- Steps 1–3 read page by page like Step 4, one illustration per page (`EconomyReadingPages`,
  pages in `motion/readingPages.ts`); the scrolling article is gone. The step menu groups
  pages by theme (`stepSections.ts`). Shipped 2026-10-31 (`fix/step-sections`).
- Every step ends with the «#Яна Корнилова» signature (`StepSignature`); step 4 got it on
  2026-10-31 at the end of block 2 page 08.

## Open decisions and ideas (nothing promised)
- Security, Art to decide: optional PIN lock for the diary; Expo SDK 58 upgrade later.
- Never enable GitHub Pages on another `code-of-stalker` repo: same origin means full access
  to diaries. (Hence no prototypes site.)
- Perf idea: a streaming XML parser for the long tracks (roxmltree peaks ~32 MB).
- Known limits: card text inside scenes 05/06 is tiny at phone width; `cargo fmt` issues in
  older code left untouched.

## Environment
- Art's PC «Blade»: `C:\Users\qtas5\Documents\Codex\2026-10-02\new-chat\watcher-matrix-check`
  (has `.local-rust` with cargo and wasm-bindgen 0.2.129 for `build.ps1`).
- GitHub and github.io are blocked on Art's work VPN.
- The repo was renamed from `code-of-stalker/watcher`; the old URL redirects.
- Claude project threads in the cloud also work here on `claude/project-thread-*` branches.
