AWAKENING / STEP 4 / 05 OF 08

A 36-second close-up, replacing the seated-figure concept.
An engraved three-quarter portrait stays alive: restrained respiration,
small eye movement, changing raking light and a slow camera approach.
A detailed opaque illustrated mask covers the facial skin and closed eyelids.
Its upper edge lifts first; a deformable mesh peels it away from top to bottom,
then the complete shell separates into the negative space at the right.
The bonds loosen, the mask fades, the living face remains.
Reduced motion holds the clear composed moment at 21 seconds.

Two preserved variants:
- Peel: the original opaque shell peeling away, unchanged; retained for comparison.
- CrackThenPeel: complete mask (0-2.5 s), growing fractures (2.5-8.5 s),
  a still cracked face until 10 s, then top-to-bottom peeling to 21 s.
  The fractures persist until the shell fades, resetting only while invisible.
  Preview selector: «Трещины и отслаивание»; URL ?variant=cracks.
  The approved application screen explicitly selects CrackThenPeel.
Authored fissures have a shaded recess and one lit lip, clipped to mask alpha.
Their UVs and mesh share the same Rust source-to-face projection as the raster.
The comparison uses the same images and adds one lightweight draw pass.

Implementation
All choreography, projection, mask deformation, particles,
lighting and texture articulation belong to the Rust/WebGL2 renderer.
JS bridges decoded assets, theme, dimensions and visibility to the existing
shared frame scheduler. Hidden scenes and the still frame stop animation jobs.

The monochrome immutable portrait was created with the built-in image_gen tool.
Source and exact prompts: assets/portrait.png and assets/portrait.prompt.txt.
The renderer uses assets/portrait-cutout.png, the imagegen RGBA cutout, unchanged.
The separate opaque shell is assets/mask.png; its exact prompt is mask.prompt.txt.
Rust supplies each theme's color and lighting; the alpha preserves dark hair on paper.
This is a new illustrated face; no old body, chair or figure asset is sampled.
The previous implementation has a local backup under output/awakening-v1.

Only the website's grounding-awakening page selects this renderer. Native
and WebGL2-unavailable fallback retain the existing Rust vector illustration.

Build: build.ps1 or build.sh, pinned wasm-bindgen0.2.129.
Preview: node graphics/awakening/preview/serve.mjs
http://127.0.0.1:9014/
Themes, timeline and reduced motion can be reviewed independently.
Compilation and browser checks do not establish real-device validation.
No GitHub Pages publication has been performed for this revision.
