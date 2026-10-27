param([switch]$RefreshAssets, [switch]$ExportWeb, [switch]$Offline)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Set-Location -LiteralPath $projectRoot
$localCargo = Join-Path $projectRoot '.local-rust/cargo/bin/cargo.exe'
if (Test-Path -LiteralPath $localCargo) {
  $env:CARGO_HOME = Join-Path $projectRoot '.local-rust/cargo'
  $env:RUSTUP_HOME = Join-Path $projectRoot '.local-rust/rustup'
  $cargo = $localCargo
} else { $cargo = (Get-Command cargo -ErrorAction Stop).Source }
function Invoke-Checked([string]$Program, [string[]]$Arguments) {
  & $Program @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Command failed: $Program (exit $LASTEXITCODE)" }
}
if ($RefreshAssets) {
  Invoke-Checked -Program 'node' -Arguments @('graphics/product-engine/prepare-assets.mjs')
  Invoke-Checked -Program 'node' -Arguments @('graphics/product-engine/prepare-shaders.mjs')
  $python = 'C:/Users/qtas5/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
  if (!(Test-Path -LiteralPath $python)) { $python = (Get-Command python -ErrorAction Stop).Source }
  Invoke-Checked -Program $python -Arguments @('graphics/product-engine/prepare-raster-assets.py')
}
$network = if ($Offline) { @('--offline') } else { @() }
$manifest = @('--manifest-path', 'graphics/product-engine/Cargo.toml')
# Paintings, long tracks and reading curves are published beside the engine (engine/assets/external.txt).
Invoke-Checked -Program $cargo -Arguments (@('run') + $network + $manifest + @('-p', 'watcher-graphics', '--example', 'publish_assets', '--', 'public/graphics/pkg/assets'))
Invoke-Checked -Program $cargo -Arguments (@('test') + $network + $manifest + @('-p', 'watcher-graphics'))
Invoke-Checked -Program $cargo -Arguments (@('run') + $network + $manifest + @('-p', 'watcher-shader-compiler', '--', 'graphics/product-engine/engine/shaders'))
Invoke-Checked -Program $cargo -Arguments (@('build') + $network + $manifest + @('-p', 'watcher-graphics', '--target', 'wasm32-unknown-unknown', '--release'))
$localBindgen = Join-Path $projectRoot '.local-rust/wasm-bindgen-0.2.129/wasm-bindgen-0.2.129-x86_64-pc-windows-msvc/wasm-bindgen.exe'
$bindgen = if (Test-Path -LiteralPath $localBindgen) { $localBindgen } else { (Get-Command wasm-bindgen -ErrorAction Stop).Source }
Invoke-Checked -Program $bindgen -Arguments @('graphics/product-engine/target/wasm32-unknown-unknown/release/watcher_graphics.wasm', '--target', 'web', '--out-dir', 'public/graphics/pkg')
Invoke-Checked -Program $cargo -Arguments (@('test') + $network + $manifest + @('-p', 'watcher-native-bridge'))
Invoke-Checked -Program $cargo -Arguments (@('build') + $network + $manifest + @('-p', 'watcher-native-bridge', '--target', 'wasm32-unknown-unknown', '--release'))
Invoke-Checked -Program $bindgen -Arguments @('graphics/product-engine/target/wasm32-unknown-unknown/release/watcher_native_bridge.wasm', '--target', 'web', '--out-dir', 'public/graphics/native-kernel')
Invoke-Checked -Program 'node' -Arguments @('graphics/product-engine/prepare-native.mjs')
Invoke-Checked -Program 'npx.cmd' -Arguments @('tsc', '--noEmit')
Invoke-Checked -Program 'npx.cmd' -Arguments @('expo', 'lint')
if ($ExportWeb) { Invoke-Checked -Program 'npx.cmd' -Arguments @('expo', 'export', '--platform', 'web', '--output-dir', '.expo-rust-web-export') }
