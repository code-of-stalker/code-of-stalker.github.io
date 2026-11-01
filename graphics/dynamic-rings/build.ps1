$ErrorActionPreference = 'Stop'
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Set-Location -LiteralPath $project
# A worktree has no toolchain of its own: use the main checkout's.
$rust = Join-Path $project '.local-rust'
if (-not (Test-Path -LiteralPath $rust)) {
    $common = [IO.Path]::GetFullPath([IO.Path]::Combine($project, (git rev-parse --git-common-dir)))
    $rust = Join-Path (Split-Path -Parent $common) '.local-rust'
}
$env:CARGO_HOME = Join-Path $rust 'cargo'
$env:RUSTUP_HOME = Join-Path $rust 'rustup'
$cargo = Join-Path $env:CARGO_HOME 'bin/cargo.exe'
$manifest = Join-Path $PSScriptRoot 'Cargo.toml'
function Run-Checked([string]$Program, [string[]]$Arguments) {
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed ($LASTEXITCODE)" }
}
Run-Checked $cargo @('fmt', '--manifest-path', $manifest)
Run-Checked $cargo @('test', '--manifest-path', $manifest)
Run-Checked $cargo @('clippy', '--manifest-path', $manifest, '--all-targets', '--', '-D', 'warnings')
Run-Checked $cargo @('clippy', '--manifest-path', $manifest, '--target', 'wasm32-unknown-unknown', '--', '-D', 'warnings')
Run-Checked $cargo @('build', '--manifest-path', $manifest, '--target', 'wasm32-unknown-unknown', '--release')
$output = Join-Path $project 'output/motion/dynamic-rings'
New-Item -ItemType Directory -Path (Join-Path $output 'pkg') -Force | Out-Null
$bindgen = Join-Path $rust 'wasm-bindgen-0.2.129/wasm-bindgen-0.2.129-x86_64-pc-windows-msvc/wasm-bindgen.exe'
Run-Checked $bindgen @((Join-Path $PSScriptRoot 'target/wasm32-unknown-unknown/release/watcher_dynamic_rings.wasm'), '--target', 'web', '--out-dir', (Join-Path $output 'pkg'))
Run-Checked 'node' @((Join-Path $PSScriptRoot 'package.mjs'))
