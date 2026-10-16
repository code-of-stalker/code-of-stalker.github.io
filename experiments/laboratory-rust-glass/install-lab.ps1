param([string]$LaboratoryPath = 'C:\Code Of Stalker\Liquid_Prnc_Glass-main')
$ErrorActionPreference = 'Stop'
$labRoot = (Resolve-Path -LiteralPath $LaboratoryPath).Path
$appPath = Join-Path $labRoot 'src/App.tsx'
$app = [IO.File]::ReadAllText($appPath)
$anchor = '<button type="button" aria-pressed={engine === ''webgpu''} onClick={() => setEngine(''webgpu'')}>WebGPU</button>'
$button = '<button type="button" data-rust-experiment onClick={() => window.open(''/rust-glass/index.html'', ''_blank'', ''noopener,noreferrer'')}>{language === ''ru'' ? ''Rust · сравнение ↗'' : ''Rust · comparison ↗''}</button>'
$oldButton = $button.Replace('/rust-glass/index.html','/rust-glass/')
if (!$app.Contains('data-rust-experiment') -and ([regex]::Matches($app,[regex]::Escape($anchor))).Count -ne 1) {
  throw 'Laboratory navigation changed. Inspect src/App.tsx before installing.'
}
$dist = Join-Path $PSScriptRoot 'dist'
if (!(Test-Path -LiteralPath (Join-Path $dist 'pkg/laboratory_glass_bg.wasm'))) { throw 'Build the experiment first.' }
$webTarget = Join-Path $labRoot 'public/rust-glass'
$sourceTarget = Join-Path $labRoot 'experiments/rust-glass'
foreach ($target in @($webTarget,$sourceTarget)) {
  if ((Test-Path -LiteralPath $target) -and !(Test-Path -LiteralPath (Join-Path $target '.laboratory-rust-experiment'))) {
    throw "Refusing to overwrite an unrelated directory: $target"
  }
}
foreach ($target in @($webTarget,$sourceTarget)) {
  New-Item -ItemType Directory -Path $target -Force | Out-Null
  [IO.File]::WriteAllText((Join-Path $target '.laboratory-rust-experiment'),'Laboratory Rust glass experiment 01')
}
# Copy only our experiment. Never delete existing Laboratory files or replace its settings.
Get-ChildItem -LiteralPath $dist -Force | Copy-Item -Destination $webTarget -Recurse -Force
$sourceItems = @('engine','shader-compiler','src','reference','Cargo.toml','Cargo.lock','prepare.mjs','web.mjs','serve.mjs','build.ps1','install-lab.ps1','test.mjs','tsconfig.json','eslint.config.cjs','index.html','README.txt','.gitignore')
foreach ($item in $sourceItems) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $item) -Destination $sourceTarget -Recurse -Force }
New-Item -ItemType Directory -Path (Join-Path $sourceTarget 'public') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'public/THIRD_PARTY_NOTICES.txt') -Destination (Join-Path $sourceTarget 'public') -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'public/fonts') -Destination (Join-Path $sourceTarget 'public') -Recurse -Force
$updatedApp = $app.Replace($oldButton,$button)
if (!$app.Contains('data-rust-experiment')) {
  $newline = if ($app.Contains("`r`n")) { "`r`n" } else { "`n" }
  $updatedApp = $app.Replace($anchor,$anchor+$newline+'          '+$button)
}
if ($updatedApp -cne $app) {
  if ([IO.File]::ReadAllText($appPath) -cne $app) { throw 'App.tsx changed during installation. Run the installer again.' }
  [IO.File]::WriteAllText($appPath,$updatedApp,[Text.UTF8Encoding]::new($false))
}
Write-Output "Installed /rust-glass/ and Rust comparison button in $labRoot"
