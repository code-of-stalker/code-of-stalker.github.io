# QA recipes

## Reach Step 4 in the app
`/settings` → «Оставить настройки по умолчанию» → toggle «Всё открыто» → «ОТКРЫТЬ ЧЕТВЁРТЫЙ ШАГ».
The practice page reopens at the last page visited, so start from `/settings` in a fresh profile.
Text is upper-cased by CSS: search `innerText` case-insensitively.
Step 5: `/settings` → «ОТКРЫТЬ ПЯТЫЙ ШАГ» opens it at the last page. In the desktop app's hidden
browser pane, page on by dispatching `WheelEvent`s (deltaY 120, 140 ms apart) on the element at
the viewport center; a reload there can take ~10 s before the page renders.

## Build and serve
- Check the production build, not the dev server: `npm run export:web`, then serve
  `.expo-rust-web-export/` with an SPA fallback (unknown paths → `index.html`), e.g.
  `npx serve -s .expo-rust-web-export -l 8081`. The dev server shows an old
  "Unexpected text node" toast that is not a bug of yours.
- In a worktree (no own `node_modules`) the Metro cache is shared with the main checkout and
  can bundle the other checkout's `src/app`. If anyone exported elsewhere since, export with
  `npx expo export --platform web --output-dir .expo-rust-web-export --clear`, then
  `node scripts/prepare-web-cache.mjs .expo-rust-web-export`, and grep the entry bundle for
  your scene's `rust-<scene>` id.
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

## Intensive chat, end to end (never on the real Supabase)
- Local server: Docker Desktop + `npx supabase@3.0.0 init` in a scratch folder, set
  `[auth.mfa.totp] enroll_enabled = verify_enabled = true` in its `supabase/config.toml`, copy
  `supabase/intensive-schema.sql` into `supabase/migrations/<timestamp>_intensive.sql`,
  `npx supabase@3.0.0 start`. Docker may be missing from PATH in an old shell: add
  `C:\Program Files\Docker\Docker\resources\bin`.
- Dev builds read `EXPO_PUBLIC_INTENSIVE_URL` / `EXPO_PUBLIC_INTENSIVE_KEY` from a git-ignored
  `.env.local` (`http://127.0.0.1:54321` and the CLI's fixed local publishable key); without them
  dev uses the in-memory demo. Main admin: `insert into public.main_admins (user_id) values (...)` via psql on 54322.
- Separate "devices" on one PC are separate origins: `localhost`, `127.0.0.1`, `<name>.localhost`
  (each has its own localStorage). TOTP codes: RFC 6238 from the manual key (Node `crypto` HMAC-SHA1).
- Phone over USB: `adb reverse tcp:8093 tcp:8093` and `tcp:54321 tcp:54321` (the phone then uses
  the same `localhost` URLs); `adb forward tcp:9222 localabstract:chrome_devtools_remote` gives CDP.
  RN-web Pressables ignore synthetic CDP touches: tap with `adb shell input tap`
  (physical = CSS × dpr, plus `(screen.height − innerHeight) × dpr` for Chrome's toolbar), type
  with `Input.insertText`. Screenshots: `cmd /c "adb exec-out screencap -p > file.png"`
  (a PowerShell `>` corrupts binary output).
- Fast Refresh of `IntensiveFlow.tsx` runs its unmount cleanup and locks the open session:
  reload the tab after editing it, or crypto calls fail with «Не удалось открыть переписку».
- RLS spot checks: `begin; set local role authenticated; select set_config('request.jwt.claims',
  '{"sub":"<uuid>","role":"authenticated","aal":"aal1"}', true); select count(*) from public.messages; rollback;`

## Deploy
Push to `main` → GitHub Actions "Deploy web build to GitHub Pages" (`.github/workflows/pages.yml`).
The build runs `npm ci --ignore-scripts` and `npm run export:web`; there is no Rust toolchain
there, so committed `public/graphics/**` must be fresh.
