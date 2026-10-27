$ErrorActionPreference = 'Stop'
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Set-Location -LiteralPath $project
$env:CARGO_HOME = Join-Path $project '.local-rust/cargo'
$env:RUSTUP_HOME = Join-Path $project '.local-rust/rustup'
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
$output = Join-Path $project 'output/motion/persona-dream'
New-Item -ItemType Directory -Path (Join-Path $output 'pkg') -Force | Out-Null
$bindgen = Join-Path $project '.local-rust/wasm-bindgen-0.2.129/wasm-bindgen-0.2.129-x86_64-pc-windows-msvc/wasm-bindgen.exe'
Run-Checked $bindgen @((Join-Path $PSScriptRoot 'target/wasm32-unknown-unknown/release/watcher_persona_dream.wasm'), '--target', 'web', '--out-dir', (Join-Path $output 'pkg'))
Run-Checked 'node' @((Join-Path $PSScriptRoot 'package.mjs'))
