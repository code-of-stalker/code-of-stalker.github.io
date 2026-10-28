---
name: new-scene
description: Make a new Rust WebGL2 animation for a page of the app, from concept through live prototype to Art's approval. Use when Art asks for an animation or scene for a page (for example Step 4 block 2 pages 04–08).
argument-hint: "[page title or page id]"
---

Page: $ARGUMENTS

1. **Read first.** The page's full text in `src/features/product/stepFourContent.ts`,
   `docs/claude/art-feedback.md`, and the scene map in `docs/claude/state.md`.
2. **Concept.** Write Art (in Russian) 2–3 truly different directions. Each one names the
   central image, the visual manner (material, typography, ink, abstraction…), the camera
   language and the beat for every phrase of the text. None may repeat an existing page's
   look. Recommend one, then wait for his choice. Still key frames to agree the look are
   fine; no videos.
3. **Build** a new crate `graphics/<id>/`. Copy only the plumbing from the newest crate
   (`graphics/persona-belief`: Cargo.toml pins, `browser.rs` runtime, build scripts,
   `package.mjs`, `preview/runtime.mjs`, `prototype/`), not its look. Query Context7 for
   every crate API you touch. `look()` covers all 7 palette codes; the loop is seamless;
   reduced motion shows one meaningful still frame. Write the Russian `README.txt`
   (meaning, beats, themes, build) like the other crates.
4. **Wire** it as `.claude/rules/graphics.md` describes (bridge, `WebScene`, `Art.web.tsx`,
   `webScene` on the page).
5. **Check.** `./graphics/<id>/build.ps1` (or `build.sh`), `npx tsc --noEmit`, `npx expo lint`,
   then the exported app at phone and wide sizes (`docs/claude/qa.md`): the scene mounts,
   calls `onReady`, spans the plate width on tablet/PC.
6. **Prototype in Тишина.** `node graphics/<id>/prototype/build.mjs output/prototypes/<id>/index.html`
   (cloud thread: `/mnt/project-files/prototypes/<id>/index.html`, attached to the reply).
   Open it via `file://` once, also at narrow width. Give Art the path. It has play/pause,
   a scrubber, the beats and theme chips (`?theme=neutral|dark|light|violet|matrix|mirage|dawn`).
7. **Iterate** on his notes; rebuild the prototype each round.
8. **Other themes** only after his OK on Тишина: check all 7. On light themes 0 px lighter
   than the page over the whole loop, light inked in the lamp color.
9. **Commit** on the work branch. `main` only through `/ship-to-main` after his explicit OK.
   Finish with `/handoff`.
