#!/usr/bin/env sh
# Rust with wasm32-unknown-unknown and wasm-bindgen-cli 0.2.129 on PATH.
set -eu
scene=$(cd "$(dirname "$0")" && pwd)
project=$(cd "$scene/../.." && pwd)
manifest="$scene/Cargo.toml"
cargo fmt --manifest-path "$manifest"
cargo test --manifest-path "$manifest"
cargo clippy --manifest-path "$manifest" --all-targets -- -D warnings
cargo clippy --manifest-path "$manifest" --target wasm32-unknown-unknown -- -D warnings
cargo build --manifest-path "$manifest" --target wasm32-unknown-unknown --release
mkdir -p "$project/output/motion/witnessing/pkg"
wasm-bindgen "$scene/target/wasm32-unknown-unknown/release/watcher_witnessing.wasm" \
  --target web --out-dir "$project/output/motion/witnessing/pkg"
node "$scene/package.mjs"
