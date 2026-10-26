This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Theme kinds (developer note only, never labelled in the app): Дюна (`light`), Мираж (`mirage`) and Рассвет (`dawn`) are light themes, and their illustrations must be recolored programmatically in Rust for a light page. Искра (`dark`), Тишина (`neutral`), Астрал (`violet`) and Матрица (`matrix`) are dark themes, recolored only from the authored dark material. Sources of truth: `isLightTheme` in `src/features/product/theme.ts`, `Palette::is_light` in `graphics/product-engine/engine/src/palette.rs` and `graphics/scene-palette/src/lib.rs`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Rust reference and documentation

- All product graphics and visual animation must be implemented in Rust. This includes illustrations, inline scenes, particles, masks, panel geometry, animated text and breathing effects on web and native. JavaScript/TypeScript may bridge platform events, accessibility, layout measurements and application state; it must not contain a parallel graphics or animation implementation. Declarative SVG, image and font assets may be consumed by the Rust engine. A Rust wrapper around JavaScript scene logic does not satisfy this requirement.
- Preserve the approved artwork, motion, themes, visibility suspension and reduced-motion behavior during migration. Keep a separately verified backup before broad graphics migrations, and report code checks, browser validation, native/device validation and publication separately.

- For Rust work in this project, start from the user-supplied reference in `docs/references/rust-2026-4i7.md`. Read the relevant sections before implementation. The original document is preserved verbatim.
- Apply its general principles: typed states and errors, explicit ownership and contracts, a testable computation core separated from adapters and side effects, and behavior comparisons during migration. Its backend, combat arithmetic, Python, Telegram and database recommendations are specific to 4i7; adapt them to this application's graphics architecture and preserve the approved Laboratory motion and design.
- For missing or uncertain language, crate or integration details, use Context7: resolve the library ID, then query documentation for the versions in `Cargo.toml`, `Cargo.lock` and the actual toolchain. If Context7 lacks the required version or detail, consult versioned primary Rust/crate documentation. Never treat an older example as proof of compatibility with an installed version.
- Dates and version numbers in the reference are a research snapshot, not an instruction to upgrade dependencies, the compiler, edition or resolver automatically. Verify compatibility and minimum supported Rust versions before making those changes. Preserve the existing version pins unless the current task requires a justified change.
- Validate Rust changes with appropriate formatting, Clippy, compiler and regression checks, including the affected native/WASM target and shader validation when relevant. Report technical checks separately from visual acceptance and measurements on real devices.
- Later direct user instructions and the application's approved requirements take precedence over recommendations in the reference.

## Resizing product panels

- For every panel, button frame, glass silhouette and mask, change width/height by moving edge anchors in actual layout coordinates. Keep corner cuts, notch dimensions, facet widths and stroke widths fixed in CSS/layout pixels. Width breakpoints may select a different approved source contour; fitting that source must still preserve its corners.
- Use the shared `fitPanelPath` / Rust `panel_geometry` contract and `PanelArtwork` for authored line contours. Stretch only the straight middle spans; never stretch the complete framed SVG with `contentFit="fill"`, `preserveAspectRatio="none"`, `scaleX` or `scaleY`. Gradients, straight progress fills and uniform illustration scaling are separate from framed contours.
- Fill, border, artwork clip, glass distance field and scanner light must follow the same fitted path. Normal outlines stay 0.25px; the selected Architecture level stays 0.75px.
- Use `usePanelSize` for measured contours on web: React Native Web rounds `onLayout` sizes and a half-pixel mismatch can separate the mask from its border. Observe fractional layout dimensions independently of appearance transforms.
- Content determines header height: use an intrinsic row with a minimum height and padding, then translate the notch/lower contour from that measured height. Responsive fonts and wrapped text must fit with their padding; never freeze the header to the source SVG's height.
- During expansion, move lower anchors with the current height, retain upper anchors, and keep corner angles stable at intermediate frames and rapid reversals. Native adapters must use fixed corner caps with stretchable straight spans, or redraw from measured geometry.
- Decorative artwork, including overflowing glow, must not intercept header/button touches. Test each level opening and closing by real click/tap at the title and expand icon, including Guidance after its reveal has completed.
