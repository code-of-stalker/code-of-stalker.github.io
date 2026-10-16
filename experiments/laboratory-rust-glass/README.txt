LABORATORY — EXPERIMENT 05: COMPLETE RUST SCENE

Three selectable paths
1. Current: Three.js glass, Canvas2D Matrix rain, browser SVG Observer.
2. Rust / glass: wgpu glass with the same Canvas2D and SVG workload.
3. Rust / everything: Rust/WASM controls and wgpu draws every element inside the
   measured scene: background, rain, glass, Observer, glow, occlusion, dash motion,
   camera, feather mask, reveal and touch. No browser SVG/Canvas2D animation and no
   per-frame canvas-to-GPU upload in this path. React owns only controls/results.

This is an optimized rendering implementation, not a language-only benchmark.
WebGPU versus WebGL2 also changes the GPU API. Select forced WebGL2 to compare
on the same API. No native Android integration or full Laboratory UI rewrite.

Assets and rendering
- Exact original SVG path data; Lyon triangulates once at build time (0.025 SVG
  unit tolerance). Figures and eyes remain vector triangles, MSAA 4x.
- Original closed silhouette + 0.5 stroke supply a stencil occlusion mask.
- Only the soft illumination is raster-cached: original paths, Gaussian 3.5/0.8,
  4 texels per SVG unit. This is not a pre-rendered animation or bitmap people.
- Rust implements SVG keyframes and cubic-bezier curves, 11.2-second cycle.
- Rain is one instanced draw into a reusable texture, up to 30 updates/sec.
  Original seed/noise/columns/trails/flicker/brightness, glyph atlas generated in
  Rust. No rain simulation allocations on the JS main thread in full mode.
- Glass keeps the existing translated shader, cached blur and quality ceiling 2.
- Textures, vertex buffers, stencil and pipelines are reused until size changes.
- One selected engine/device and one requestAnimationFrame bridge run at a time.
- No per-frame GPU readback or queue completion wait is used for benchmarking.

Controlled v5 changes apply to all three paths
- Same bundled Disket + Noto Sans JP fonts instead of different OS fallback fonts.
- Rain uses active wall time without the old 100ms delta cap. Slow frames must
  not change the intended animation speed.
- The illustration occupies the same centered 74% x 64% box in all modes. Labels
  have moved out of the measured scene. The static grid has no system-font text.
- Compare v5 runs only. Earlier JSON/screenshot results are preserved in reports.

Measurement
Each press of Measure creates a fresh engine. Setup time is separate. The first
resource snapshot is BEFORE the first render (submittedFrames=0, full-scene
sourceUploads=0). Collect 60 seconds from the first RAF: 15s warmup and 45s
sustained result, with all twelve 5s buckets retained in JSON schema 5.
The scene must be at least 80% visible. Hidden tab, actual size change, settings
change or pause cancels the run. No frame/stall filtering. Repeated identical
ResizeObserver notifications do not cancel. Export keeps the last twelve runs.

CPU timing means synchronous CPU preparation/submission, not total GPU or
browser paint time. Full Rust sourceCpuMs is zero because source generation is
GPU work; its command encoding is part of commandsCpuMs. Do not infer zero rain
cost. Resource counters are application allocations, not total process/GPU memory.
Observer evidence is DOM transforms in reference modes, submitted GPU frames and
Rust camera pose in full mode. It is not a GPU pixel-readback verification.

Visual comparison
Open Compare appearance and enable Same moment. All engines can be inspected at
the same phase; FPS measurements are disabled there. Check 0s close-up/occlusion,
5.6s zoom-out and 7.5s glow. Disable Same moment to measure normally.
Independent native/browser rasterization can differ at fine edges or soft glow;
matching shapes/motion does not establish pixel-identical output across GPUs.

Tecno protocol
Keep density 2 and the default full scene. Confirm all three parts move. Measure
Current and Rust/everything, resting the phone between runs. Repeat in opposite
order. Rust/glass is an optional isolation run. Then force Rust WebGL2 if useful.
Send laboratory-rust-comparison-v5.json. A one-minute run does not establish
thermal/battery behavior over long sessions. No Tecno speedup is claimed yet.

Build and preview
./build.ps1 (PowerShell). Pinned wgpu/Naga 30.0.1 and wasm-bindgen CLI 0.2.129.
The local Rust toolchain is ../../.local-rust. Cargo.lock includes build-only
Lyon, SVG parser, tiny-skia and ttf-parser; they are not runtime WASM dependencies.
Build generates assets in target, validates GLSL/WGSL, runs Rust + JS checks,
TypeScript/ESLint, release WASM and Vite. On clean machines first fetch Cargo deps.
node serve.mjs serves dist on 7488. ./install-lab.ps1 copies only the owned
experiment and the existing Rust-comparison navigation link into Laboratory.
The HTTPS phone preview needs this computer/server/tunnel running.
