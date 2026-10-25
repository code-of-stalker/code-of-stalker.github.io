# Local animation editor

Run `node scripts/product-art/editor/server.mjs` from the project root and open
`http://127.0.0.1:4179`. The server binds only to localhost and needs the local
Rust toolchain (or `cargo` on PATH) to generate a faithful scene preview.

Choose an authored `task-*.svg` asset and a step 2 scene. The left view plays
frames calculated by the existing Rust scene code. The right view edits actual
SVG path anchors and curve controls; Shift drag a selected path to move it.
The writing hand is preselected as the first acceptance case. Save writes only
changed `d` attributes into the source SVG. Rust's `include_str!` picks up that
file when the application rebuilds. Reload the app to see the result there.

Undo, Redo, and Reset unsaved affect the current session. Each save also keeps
a timestamped copy in `.local-preview/animation-editor/backups`. The Earlier
save selector restores one of those copies, backing up the current file first.
If the asset changed outside the editor, save reports a conflict and requires
Reload from disk so another person's edits are not silently replaced.

Only SVG path geometry is editable. Scene timelines, colors, layering, and
the Rust hand movement stay in code. If Codex creates another task SVG, it
appears in the asset list automatically; new scene kinds need registration in
`server.mjs` and `animation_editor_preview.rs`.
