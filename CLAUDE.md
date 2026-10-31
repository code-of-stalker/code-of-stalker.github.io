@AGENTS.md

# Code Of Stalker: notes for Claude

Apps with practices that train observation (attention, noticing). This repo is the
app "Code Of Stalker" (Expo / React Native, web first), live at
https://code-of-stalker.github.io/ via GitHub Pages: **every push to `main` deploys**.
Owner and only user: Art (GitHub `code-of-stalker`).

## Talking to Art
- Reply in Russian, short and plain. Code, comments, commits, docs and subagent
  prompts stay in English (cheaper).
- «Ок», «Пушим», «пуш» means approval of what was just shown, and only that.
- Take his words literally. If a phrase can be read two ways, ask: «на высоте»
  once meant "at mouth height", not "above the head".

## Hard rules
1. `main` is production. Never push or merge to `main` without Art's explicit OK
   in this conversation for this exact change. Work on a branch, then `/ship-to-main`.
2. All graphics and animation are Rust (see AGENTS.md). JS/TS only bridges.
3. Rust: look up crate APIs in Context7 first (wgpu, wasm-bindgen, web-sys, js-sys…)
   for the versions pinned in `Cargo.toml`, never from memory.
4. Themes: Дюна `light`, Мираж `mirage`, Рассвет `dawn` are light; Матрица `matrix`
   (default), Тишина `neutral`, Искра `dark`, Астрал `violet` are dark. Mark this
   in code only, never in the UI. Settings list them in that order: dark first, then light.
5. Light themes: a scene's background is exactly the page color. No paler frame,
   no white, no haze; light is inked in the theme's lamp color. Check: 0 pixels
   lighter than the page.
6. Tablet/PC (width ≥ 600): every illustration and scene spans exactly the width
   of the plate below it, height = width × phone ratio. Phone (< 600) is unchanged.
7. A new animation gets its own central image, manner and camera. Do not reuse the
   look of the previous scene. Offer Art 2–3 truly different directions first.
8. Show animations as a live prototype: one self-contained HTML file Art opens from
   disk. No video renders. Sharing a prototype needs no OK; `main` does.
9. Show Тишина first. Adapt and check the other 6 themes only after Art's OK.
10. When Art says to ship several things together, ship them in one push.

## Commands (repo root; Windows PowerShell on Art's PC «Blade»)
- Typecheck and lint, before calling anything done: `npx tsc --noEmit`, `npx expo lint`
- Web cache/security tests: `npm run test:web-cache`. Unit tests: `node --test <file>`.
  Some node test files already fail on `main` (strip-only TS: diary,
  product-storage, backup-storage.web). Compare with `main` before blaming a change.
- Rust scene: `./graphics/<scene>/build.ps1` (`build.sh` on Linux/macOS): fmt,
  tests, clippy native+wasm, release build, wasm-bindgen 0.2.129, then packages into
  `public/graphics/<scene>/`. Built output is committed (Pages has no Rust).
- Product engine (wgpu, Steps 1–3 art): `./graphics/product-engine/build.ps1 [-RefreshAssets]`
- Production web build: `npm run export:web` (to `.expo-rust-web-export/`). Dev: `npx expo start --web`
- Prototype file: `node graphics/<scene>/prototype/build.mjs output/prototypes/<scene>/index.html`
  (`output/` is git-ignored). In a cloud project thread use
  `/mnt/project-files/prototypes/<scene>/index.html` and attach it to the reply.
- Install: `npm ci --ignore-scripts` (the postinstall only fetches Matrix Android binaries).

## Where things are
- Routes `src/app/`; product code `src/features/product/`: `stepFourContent.ts`
  (Step 4 text and page-to-scene map), `motion/*.web.tsx` (scene bridges),
  `theme.ts`, `layout.ts` (`productLayout`), `skeleton/`, `screens/`.
- Rust crates `graphics/<scene>/`, each with a Russian `README.txt` (concept, beats,
  build). Shared recolor `graphics/scene-palette`; main engine `graphics/product-engine`.
- CSP: `scripts/web-cache/shell-security.mjs`. Everything loads from this origin;
  a new inline script or host means updating `contentSecurityPolicy()`.

## State and memory
- Start a task with `docs/claude/state.md` (what's shipped, scene map, open items).
- Before any visual work, read `docs/claude/art-feedback.md` (Art's taste, past rejections).
- QA recipes: `docs/claude/qa.md`. Graphics details load from `.claude/rules/graphics.md`.
- After a task, or before Art runs `/clear`, run `/handoff` so the state survives.
