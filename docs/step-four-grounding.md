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
