WITNESSING / STEP 4 / 06 OF 08 / ЖИВОЕ ОСОЗНАВАНИЕ

A 32-second narrative: a seductive architectural world lives in the water.
A graphic-noir black/gold hand approaches from above. Its touch sends a local
clearing wave through the city: towers stretch into refracted ribbons, then
only the actual hand and water remain. A clinging drop follows the rising
finger, falls and launches a smaller final disturbance.

The authored hand-v2.png and world.png are immutable dark RGBA source artwork.
Light themes use dedicated hand-light.png and world-light.png illustrations
with cream planes and sepia linework in the same geometry. Palette::is_light
alone selects them for Дюна, Мираж and Рассвет. The other four themes retain
the approved dark source pair and its unchanged material interpretation.
The source fingertip [570,920] maps to CONTACT [790,570] at scale .78.
All transforms, local clearing, water, drop and lighting belong to Rust/GLSL.
The renderer retains two GPU textures and one fullscreen pass, no offscreen
targets. Four decoded source images are held on the CPU. Only switching between
light and dark material classes reuploads the corresponding pair into the two
existing textures. Light source luminance maps to the theme's paper, highlight
and ink; reflections and unravelling strands use the same light interpretation.

Typed narrative phases:
0–4: InReflection — architectural illusion in the pool;
4–8: Approach — the hand travels about 200 authored pixels;
8–15: Unravel — the outward front locally clears buildings into light strands;
15–20: Presence — clear water and the real reflected hand;
20–24: Release — finger lifts, drop detaches at 21.8 and impacts at 23;
24–27: Settle — final wave; hidden reset of the world deformation;
27–32: Return — illusion gradually reappears while the hand is already raised.
Reduced motion holds 17 seconds. Palette/resize redraw without ongoing jobs.

The original simple touch version remains backed up at output/witnessing-touch-v1.
No existing scene has been replaced or changed by this crate.

Build: build.ps1 or build.sh (wasm-bindgen 0.2.129, pins match Awakening).
Preview: node graphics/witnessing/preview/serve.mjs
http://127.0.0.1:9015/ — theme, timeline, phase buttons, pause and reduced motion.
The phase captions and buttons exist only in the review preview.

Seven core tests cover phase order, local clearing, invisible reset,
contact/reflection registration, inverse transforms, drop continuity/impact,
finite clocks, loop continuity, palette classification and asset-set selection. Browser rendering,
real-device performance and publication must be verified separately.
