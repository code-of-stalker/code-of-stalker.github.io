---
paths:
  - "graphics/**"
  - "src/features/product/motion/**"
  - "public/graphics/**"
---

# Rust scenes and graphics

## Scene crate anatomy (newest reference: `graphics/persona-belief`)
- Own `[workspace]`, edition 2021, pins `wasm-bindgen =0.2.129`, `js-sys`/`web-sys =0.3.106`,
  depends on `graphics/scene-palette`. Release profile: lto, opt 3, panic abort, strip.
- `src/lib.rs`: timeline/choreography, `look()` per palette code, tests.
  `src/browser.rs`: WebGL2 renderer exported to JS (`mount`, `frame(at)`, `seek`,
  `palette(code)`, `backdrop(r,g,b)`, `reduced(bool)`, `resize`, `suspend`, `dispose`,
  `gpu_error`, `frame_count`, `elapsed`). Shaders in `src/shaders/`.
- `tools/prepare-assets.mjs` (Playwright) bakes the label atlas in Disket Mono and
  writes `src/generated.rs`. In the cloud run it with `NODE_PATH=/opt/node22/lib/node_modules`.
- `package.mjs` copies the wasm-bindgen output and assets into `public/graphics/<scene>/`;
  `preview/runtime.mjs` becomes `runtime.js`; `prototype/` builds the single-file prototype.
- Images: author PNG, publish lossless WebP with `python graphics/lossless-webp.py [--check]`.

## Wiring a new web scene
- `motion/<Name>.web.tsx`: copy the newest bridge (`PersonaBelief.web.tsx`). It must call
  `props.onReady` on success and on failure, or the skeleton never clears. Pause when not
  visible (`observeMotionVisibility`) or not focused; `reducedMotion` shows the still frame.
- Add the id to `WebScene` in `motion/types.ts`, dispatch it in `motion/Art.web.tsx`, set
  `webScene: '<id>'` on the page in `stepFourContent.ts`. The native app keeps its old art.

## Palette and themes
- Palette codes (`graphicsPalette`, `Palette::from_code`): 0 Искра `dark`, 1 Дюна `light`,
  2 Тишина `neutral`, 3 Астрал `violet`, 4 Матрица `matrix`, 5 Мираж `mirage`, 6 Рассвет `dawn`.
  Light test: `Palette::is_light`, `isLightTheme` (`src/features/product/theme.ts`).
- Dark themes recolor only from the dark source material.
- Light composite branch: start from `u_backdrop` (page color from the bridge). No haze,
  beam brightening, paler body/card fill or grain. Glow inks the page in `Look.lamp`:
  E8912E for Дюна, accent for Мираж, detail for Рассвет. Never white.
- Дюна: no saturated orange floods (Art: «вырвеглазно»). Soft sepia, ink #BE4C00.
- Painted scenes (world-in-glasses, cloud-drift, theatre-marionette) use Art's light
  pack (`assets-light/*.webp`; engine `*-sand.png`) on light themes. Мираж/Рассвет map that
  pack so Дюна's page level and anything lighter lands exactly on their page color
  (`scene-palette` `recolor.frag`, engine `presentation.wgsl`).
- Label/card panels over defocused text must be nearly opaque (alpha ≈ 0.88).

## Product engine
- Big inputs are external assets listed in `graphics/product-engine/engine/assets/external.txt`,
  published by `cargo run --example publish_assets -- public/graphics/pkg/assets`
  (`build.ps1` does it; a Rust test fails when they are stale).
- After merging Rust changes from two branches, rebuild generated WASM/native assets from
  the merged source; never keep one side's binary.
