#!/usr/bin/env sh
# Same steps as build.ps1 for a Linux or macOS shell with rustup and
# wasm-bindgen-cli 0.2.129 on PATH.
set -eu
scene=$(cd "$(dirname "$0")" && pwd)
project=$(cd "$scene/../.." && pwd)
manifest="$scene/Cargo.toml"
cargo fmt --manifest-path "$manifest"
cargo test --manifest-path "$manifest"
cargo clippy --manifest-path "$manifest" --all-targets -- -D warnings
cargo clippy --manifest-path "$manifest" --target wasm32-unknown-unknown -- -D warnings
cargo build --manifest-path "$manifest" --target wasm32-unknown-unknown --release
wasm-bindgen "$scene/target/wasm32-unknown-unknown/release/watcher_persona_belief.wasm" \
  --target web --out-dir "$project/output/motion/persona-belief/pkg"
node "$scene/package.mjs"
