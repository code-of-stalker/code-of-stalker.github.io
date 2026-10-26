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
