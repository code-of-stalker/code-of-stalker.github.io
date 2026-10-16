param(
  [string]$LaboratoryPath = 'C:\Code Of Stalker\Liquid_Prnc_Glass-main',
  [string]$ToolingProject = (Join-Path $PSScriptRoot '../..'),
  [string]$RustTools = (Join-Path $ToolingProject '.local-rust')
)
$ErrorActionPreference = 'Stop'
$env:LABORATORY_SOURCE = (Resolve-Path -LiteralPath $LaboratoryPath).Path
$env:LABORATORY_TOOLING = (Resolve-Path -LiteralPath $ToolingProject).Path
if (Test-Path -LiteralPath (Join-Path $RustTools 'cargo/bin/cargo.exe')) {
  $env:CARGO_HOME = (Resolve-Path -LiteralPath (Join-Path $RustTools 'cargo')).Path
  $env:RUSTUP_HOME = (Resolve-Path -LiteralPath (Join-Path $RustTools 'rustup')).Path
  $env:PATH = (Join-Path $env:CARGO_HOME 'bin') + ';' + $env:PATH
}
$bindgen = Get-Command wasm-bindgen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1
if (!$bindgen -and (Test-Path -LiteralPath $RustTools)) {
  $bindgen = Get-ChildItem -LiteralPath $RustTools -Filter wasm-bindgen.exe -Recurse | Select-Object -ExpandProperty FullName -First 1
}
if (!$bindgen) { throw 'Install official wasm-bindgen-cli 0.2.129 or pass -RustTools with that executable.' }
if ((& $bindgen --version) -ne 'wasm-bindgen 0.2.129') { throw 'Cargo.lock requires wasm-bindgen-cli 0.2.129.' }
$tsc = Join-Path $env:LABORATORY_TOOLING 'node_modules/typescript/bin/tsc'
$eslint = Join-Path $env:LABORATORY_TOOLING 'node_modules/eslint/bin/eslint.js'
if (!(Test-Path -LiteralPath $tsc) -or !(Test-Path -LiteralPath $eslint)) { throw 'Pass -ToolingProject pointing to watcher-matrix-check with its installed dependencies.' }
function Invoke-Checked {
  param([string]$Program, [string[]]$Arguments)
  & $Program @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Program failed with exit code $LASTEXITCODE" }
}
Push-Location $PSScriptRoot
try {
  Invoke-Checked node @('prepare.mjs')
  Invoke-Checked cargo @('run','--offline','--locked','-p','laboratory-shader-compiler','--','engine/shaders')
  Invoke-Checked cargo @('test','--offline','--locked','-p','laboratory-glass')
  Invoke-Checked cargo @('build','--offline','--locked','-p','laboratory-glass','--target','wasm32-unknown-unknown','--release')
  Invoke-Checked $bindgen @('--target','web','--out-dir','public/pkg','--out-name','laboratory_glass','target/wasm32-unknown-unknown/release/laboratory_glass.wasm')
  Invoke-Checked node @($tsc,'--project','tsconfig.json','--noEmit')
  Invoke-Checked node @($eslint,'src')
  Invoke-Checked node @('test.mjs')
  Invoke-Checked node @('web.mjs')
  Write-Output 'Ready: dist. Run node serve.mjs or install-lab.ps1.'
} finally { Pop-Location }
