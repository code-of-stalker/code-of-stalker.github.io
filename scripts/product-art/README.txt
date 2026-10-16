Watcher local artwork bundle

This snapshot contains only the artwork, geometry, animation math and styles from
Prince Laboratory. The Laboratory MIT notice is in LABORATORY-LICENSE.txt.
React and React DOM are bundled under their MIT licenses. The three license notices
are kept in this directory and embedded into the generated HTML.

Rebuild:
  cd scripts/product-art
  npm install
  npm run build

Gesture regression check (from the app root):
  node scripts/product-art/check-gestures.cjs

Alternatively, the existing Laboratory Vite toolchain can be used without installing
a second copy. Set LABORATORY_SOURCE to its folder; default is the original local
path C:/Code Of Stalker/Liquid_Prnc_Glass-main. That path is build-time only.
Runtime artifacts are embedded and work offline. No local server is required.

Rebuilding does not recopy Laboratory sources. The source snapshot and UI-exported
presets are intentional: updating them should be a reviewed design change.
The helper derive-voice.mjs documents how the visual-only voice markup was extracted.

The native host owns sound and controls. The voice artwork receives a normalized
amplitude, not raw audio, credentials, recovery keys or Matrix session data.
Gallery and mirror keep their approved canvas/WebGL algorithms and raster sources.
The web iframe is a visual preview; this does not implement the browser Matrix SDK.

Generated HTML previews are written to preview/ for visual review and are not
part of the app. Native rendering and performance must be checked in a new APK.

Second-step book projection:
  From the app root, run node scripts/product-art/build-book-projection.mjs.
  The approved source is assets/product/motion/book-projection-approved.html.
  Its SVG geometry is extracted into bookProjection.generated.ts together with
  src/book-projection-runtime.js. The preview panel, copy, fonts and controls are
  excluded. Product palettes and reading visibility are in motion/bookProjection.ts.
  The same local SVG runtime serves the web iframe and native WebView.

Second-step paragraph inserts:
  Run node scripts/product-art/build-step-two-inserts.mjs from the app root.
  This extracts the same approved person into stepTwoInserts.generated.ts.
  Edit the two compositions in motion/stepTwoInserts.ts and their timing in
  src/step-two-inserts-runtime.js. Reflections follows paragraph 2; Single Hero
  follows paragraph 3. Both use the book palette bridge and measured reading
  visibility, run once, pause offscreen and hold a static reduced-motion state.
