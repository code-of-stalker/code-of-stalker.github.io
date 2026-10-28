# QA recipes

## Reach Step 4 in the app
`/settings` → «Оставить настройки по умолчанию» → toggle «Всё открыто» → «ОТКРЫТЬ ЧЕТВЁРТЫЙ ШАГ».
The practice page reopens at the last page visited, so start from `/settings` in a fresh profile.
Text is upper-cased by CSS: search `innerText` case-insensitively.

## Build and serve
- Check the production build, not the dev server: `npm run export:web`, then serve
  `.expo-rust-web-export/` with an SPA fallback (unknown paths → `index.html`), e.g.
  `npx serve -s .expo-rust-web-export -l 8081`. The dev server shows an old
  "Unexpected text node" toast that is not a bug of yours.
- The service worker caches graphics: after a rebuild a normal profile may run a stale
  `runtime.js`. Use a fresh/incognito profile (or open `/update`).
- Theme is per browser profile; set it in the same page session you check.

## Sizes to check
Phone 390×844, tablet 820×1180 and 1180×820, desktop 1440×900. Run them one after another;
parallel headless runs time out and leave skeleton placeholders on screen.

## Scenes
- A scene is ready when its canvas has `data-ready="true"`; `data-graphics-error` means it failed.
- Light-theme check: render key frames on the page color and count pixels lighter than the
  page. It must be 0 over the whole loop.
- Headless browsers: add `?graphics-backend=webgl2`. Without a GPU (cloud) launch Chromium
  with only `--use-vulkan=swiftshader --use-angle=swiftshader`; `--enable-unsafe-webgpu`
  makes the engine panic on SwiftShader. On Blade a normal browser with the real GPU works.
- Deterministic frames in Playwright: `page.clock.install()`, `pauseAt(now + 100)`, then
  `runFor(1000 / 60)` per shot. Scene renderers also expose `seek(seconds)`.
- Wheel input in tests: 120 px steps ~140 ms apart, and stop on state change, or «Всё открыто»
  lets the wheel run through all four Step 4 questions at once.

## Deploy
Push to `main` → GitHub Actions "Deploy web build to GitHub Pages" (`.github/workflows/pages.yml`).
The build runs `npm ci --ignore-scripts` and `npm run export:web`; there is no Rust toolchain
there, so committed `public/graphics/**` must be fresh.
