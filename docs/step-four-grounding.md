# Step 4: grounding and direct recognition

Implemented in the isolated `codex/step-four-grounding` worktree, based on
`64c6c6cede3a9f567dcf42ce4285b1393998cbc8`. Step 3 scene sources were not edited.

## Reading and access

- The supplied Russian text is preserved in `stepFourContent.ts`, with normalized
  typography, across 15 pages: direct recognition (1–3), practice (4–7), persona
  (8–11), awakening (12–15).
- Every quality mode uses one scene per page. The first panel expands before its
  contents scroll; later pages use the existing Rust-backed content transition.
- Step selection enters the step directly; its sections button opens the full
  list of destinations. A destination starts expanded at the selected page.
- `stepFourReading` stores page and offset independently of `stepThreeReading`.
  Navigation generation prevents an outgoing screen overwriting a new destination.
- “Everything open” exposes step 4 in both the step menu and Settings, without
  recording completion. Normal access follows the last existing Step 3 practice
  page (chapter 1, page 6); first earned entry keeps `fourthStepUnlocked` so that
  revisiting Step 3 does not close Step 4.
- Home shows the grounding illustration when the saved step is 4.

## Rust graphics

`graphics/product-engine/engine/src/grounding.rs` owns eight studies: a seated
person at a window, thought drift, the origin of a conclusion, contact with the
floor, hearing one's voice, persona programs, the call, and presence.

The seated and standing contours reuse approved declarative artwork. Bodies have
opaque covers. A shared perspective camera constructs the floor and architecture;
matrix rain, light, text outlines, timing and motion stay in Rust. There is no
second JS scene implementation. The same WASM is packaged for web and the native
WebView adapter. Reduced-motion frames are deterministic; normal motion loops.

## Validation, 2026-10-26

- TypeScript check and Expo lint passed after the last UI change.
- Full Rust suite: 196 unit tests and 3 integration tests passed; 1 pre-existing
  test ignored. The two grounding regressions passed again after visual fixes.
- Clippy passed with existing warnings outside the new module. Rust formatting
  applied to the new module; the WASM release build passed.
- Existing application/state suite: 40 tests passed. The affected storage/access
  subset (34 tests) passed again after the final access-marker change.
- Native and web storage tests cover independent bookmarks, reopening, malformed
  values, and test access without earned completion.
- Production web export passed. Browser checks covered first-panel expansion,
  direct section entry, page 4→5 scrolling, saved page/offset after reload, final
  page 15, Settings entry, matrix/neutral appearance, and a 375px scene preview.
- Final WASM SHA-256:
  `5a373907fc005c0979a5551e0ef5990845cd5d3ac1534c7fd183db0dfeaa7d3c`.
  Web export and native embedded compressed WASM correspond to this binary.

Physical iOS/Android device validation and human visual acceptance remain separate.
This branch has not been deployed to the live site. When integrating alongside
the other agent's Step 3 work, preserve both Rust module changes and rebuild the
generated WASM/native assets from the merged source instead of choosing one side's
generated binary during conflict resolution.

## Opening illustration and backward entry, 2026-10-26

- Backward scrolling from Step 4 now writes the final Step 3 practice bookmark
  (chapter 1, the last page from `stepThreePractice`) in the same progress update
  as the step change. Step 3 consumes the end-entry flag and scrolls to the bottom.
  An earlier Step 3 bookmark no longer redirects this boundary crossing.
- The opening screen uses a separate `grounding-hero` raster asset. It depicts
  a seated holographic figure, two grounded feet and a layered matrix floor.
  The Rust GPU path owns proportional fitting, palette adaptation, edge masking
  and subtle local light. The source image and full prompt are preserved under
  `graphics/product-engine/engine/assets/grounding-hero.*`.
- `grounding.rs` and its eight inline scenes were not changed; the original
  seated window animation remains available and its existing uses are retained.
- Typecheck, Expo lint, all WGSL validation and the release WASM build passed.
  WASM Clippy completed with pre-existing warnings. Rust tests: 199 passed,
  1 previously ignored; storage and reading-input tests: 31 passed. The Node
  storage tests require `--experimental-transform-types` for parameter properties.
- Browser QA confirmed Step 4 backward scroll -> Step 3 page 07/07, with scroll
  offset 167.2px at the 167px rounded maximum, and the same last page after reload.
  The opening image was inspected in the application and at 375px in neutral
  and light palettes, including economy mode. No preview console warnings/errors.
- Production web export cache version: `ad32fcff2d377be42cb903d1`.
  WASM SHA-256: `3d22a907f15a88f60abc53a24bf8480c0cdb711f932d2a9d3a46922f5ae2eff5`.
  Web export and native embedded payload match and pass `WebAssembly.validate`.
  Native-device appearance remains untested. This revision is local, not deployed.

## Opening illustration motion, 2026-10-26

- Replaced the faint light variation with a 9.6-second breathing cycle. The upper
  body expands and settles; the knees, feet and chair seat stay grounded. Light
  travels down the figure, reaches both feet, then sends two waves across the
  perspective floor. Two depths of the project's matrix glyphs move behind it.
- `grounding_hero.rs` owns the timeline and registered body/chair coverage.
  `grounding-hero.wgsl` renders the immutable source art with those parameters;
  foreground coverage prevents the rain or floor waves crossing the figure.
  The PNG hash remains
  `63379a73ce750032b0ba3ef86be996feb4fe82bfc8a141cd558aa658a096b01a`.
- Economy mode keeps the full choreography and drops the farther rain layer.
  Visibility pause uses the shared render clock without catching up on resume;
  reduced motion returns the original static artwork. No JS scene was added.
- Four new Rust regressions cover the sequence, loop seam, suspended time and
  body/chair occlusion. Full suite: 200 unit and 3 integration tests passed, with
  1 pre-existing ignored test. Typecheck, Expo lint, WGSL validation, WASM build
  and production export passed. WASM Clippy finished with the existing 33 warnings
  and no warnings in the new module.
- Browser QA used the production renderer at
  `http://127.0.0.1:8964/grounding-hero-preview.html`: automatic playback after
  reload, changing consecutive frames, phone-size and neutral/economy rendering,
  plus byte-identical screenshots over time with reduced motion enabled.
  The separate-frame controls explicitly pause; the deliverable opens playing.
- Web export version: `04317060193367635a963c9a`. WASM SHA-256:
  `0783958fa65ea9eac678ec1a79cfe31b03d681f64345d892b6629c3291cf6e81`.
  The web export and compressed native payload match this validated binary.
  Real-device validation and publication have not been performed.

## Theme matching, live rain and release integration, 2026-10-26

- Removed the stationary glyph bands embedded in the source from a cached Rust
  intermediate. All rain is now rendered by the moving project glyph atlas.
  The source PNG remains unchanged; a regression checks every covered foreground
  pixel and every pixel below the background against the original.
- Grounding has a separate presentation role: Matrix uses the application's
  `#F5DD07` instead of gold source pigment. Neutral, light and violet continue
  through their existing palette mapping, including breathing and floor waves.
- Merged `origin/main` at `dc3419c` before release, retaining the other agent's
  Step 3 films, section menu changes and signatures. Rebuilt graphics and native
  kernels from the merged Rust sources; no generated binary was chosen over the
  other branch's implementation.
- 207 Rust unit tests, 3 integration tests and 22 native bridge tests passed;
  1 pre-existing Rust test remains ignored. Typecheck, lint, shader validation,
  release builds and export passed. Clippy completed with 33 existing warnings.
  The storage/reading regression subset passed all 35 tests.
- Browser QA checked Matrix and neutral palettes, and compared only the rain
  region over time in economy mode to confirm it changes independently of the
  figure. WASM and the native embedded payload match SHA-256
  `d7dc7770f633c317c69d21f8a9340f06ecc6ae213e9ef104840eb4081c895484`.
  The split Sites engine reconstructs those exact bytes and validates.
  Deployment cache: `b4682d9b366efc155dc07057`.

## Forward crossing and themed web scenes, 2026-10-26

- Scrolling past the Step 3 signature (practice page 07/07) enters the start of
  Step 4, mirroring the backward crossing. The cue reads «ПРОКРУТИ К ШАГУ 4».
  The crossing writes `stepFourReading` page 0 and, outside “Everything open”,
  `fourthStepUnlocked`.
- The three standalone web scenes of Step 4 (world in glasses, cloud drift,
  theatre marionette) follow the app theme. `graphics/scene-palette` renders
  each finished frame offscreen and recolors it with the product engine's
  grounding mapping: Matrix yellow luminance in Искра, cool luminance ink in
  Тишина and Астрал. The page edges melt in after the recolor. Each scene exposes `palette(code)` with the `graphicsPalette` codes;
  other codes keep the original colors for previews and video export.
- The full-color posters are shown only if WebGL2 fails.

## Art's light paintings for Дюна, 2026-10-26

- Дюна is a light theme: its scenes draw Art's hand-painted light versions
  (`graphics/*/assets-light`, WebP) as painted, with no recolor pass. Dark
  themes keep recoloring only the dark originals. `Palette::is_light` in
  `graphics/scene-palette` and `isLightPalette` in `graphicsPalette.ts` mark
  this; the bridges swap the renderer when a theme crosses between the two.
- The light paintings follow the dark compositions, so the existing lens mask,
  figure matte, contours and rigs apply. Two layers needed new cut-outs:
  the cloud's floating visions sit on painted sky, so `light-matte.py` stores
  their matte (the dark original's own coverage) in `objects.webp`; the pack's
  separate marionette heroine stands in another pose, so `light-heroine.py`
  cuts her from the light full scene against its plate.
- Effects that add light to black air ink the pale page instead
  (`light_paintings`): code rain and dust become amber ink, holes and falling
  stones umber and pale marble, the scanner a thin accent-ink line, the stage
  beams a warm veil. Vignettes and pulses are gentler so nothing washes out.

- The product engine draws Art's light paintings of the Step 3 voice scene and
  the Step 4 grounding hero in Дюна (`*-sand.png`, `Palette::is_light`). The
  grounding painting reuses the measured glyph columns and coverage. For the
  voice scene, `prepare-sand-rasters.py` maps the user-edited portrait into
  the light palette (alpha unchanged) and derives a quiet light frame without
  code, rings, voice or figure. Rings, waves, code rain and contact light are
  drawn as amber ink; the light scenes fade into the page instead of black.
- Glasses scene, Art's notes 2026-10-26: in Дюна the ruins behind her sit on
  the page's own yellow. The background layer is multiplied by page over the
  painting's pale sky (`PAPER`), weighted toward the light tones and divided by
  the bloom that adds light on top, so the sky lands on the page color; she
  keeps her painted colors and there is no dark vignette. The edge fade into
  the page is half as wide in every theme (`EDGES`).
