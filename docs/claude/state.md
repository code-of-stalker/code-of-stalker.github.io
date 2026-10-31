# Project state

Updated 2026-10-31. `main` = the merges of `fix/home-shade-band` (the vector engine honors
`preserveAspectRatio="none"`, so the home card shade spans the card instead of a centred strip)
and `scene/call-bell` («Колокол» on «Сила Зова», all 7 themes), both shipped 2026-10-31.
Art's rule (2026-10-31): small fixes are pushed at once via `/ship-to-main`; big changes such
as animations stay local until he says to ship them. Unsure which it is: ask.
Open work: branch `scene/essence-flame` (not pushed) — «Пламя» for page 2/07, wired on web.
Art approved Тишина; all 7 themes checked (light themes 0 px lighter than the page). Waits
for his «пушим» to go to `main` via `/ship-to-main`.
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
| 2 / 07 | grounding-recognition «Сущностные ощущения» | essence-flame «Пламя» (branch) | the candle is a wax figure of a person, flame in its crown; it melts into a plain candle, camera closes on the flame |
| 2 / 08 | grounding-real «Истинное распознавание» | none yet | engine art |

Block 1 pages 04–06 and block 2 pages 01–02 share one look (dark room, seated person in
profile, card bottom-right, focus pulls). Do not make a sixth one like them.
Next: ship «Пламя» on Art's word, then page 08 (`/new-scene`).

## Shipped features (all on main)
- Themes: 7 (Тишина default). Art's palettes: Мираж sand F1DFB8 / cobalt 2E5BD5 / lilac 9B6FAB /
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
- Step 3 end scrolls straight into Step 4.

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
