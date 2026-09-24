param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$TauriArgs
)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$backendPath = Join-Path $projectRoot "src\backend"
$tauriConfigPath = Join-Path $backendPath "tauri.conf.json"

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    throw "No se encontro Cargo. Instala Rust y Cargo antes de iniciar PersoBuilder."
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw "No se encontro npm.cmd. Instala Node.js antes de iniciar PersoBuilder."
}
if (-not (Test-Path -LiteralPath $tauriConfigPath -PathType Leaf)) {
    throw "No se encontro la configuracion Tauri: $tauriConfigPath"
}

$tauriConfig = Get-Content -LiteralPath $tauriConfigPath -Raw | ConvertFrom-Json
if ($tauriConfig.productName -ne "Perso-Builder" -or
    $tauriConfig.mainBinaryName -ne $tauriConfig.productName) {
    throw "La configuracion Tauri debe usar Perso-Builder como nombre de producto y ejecutable."
}

$cargoManifest = Get-Content -LiteralPath (Join-Path $backendPath "Cargo.toml") -Raw
$cargoBinBlock = [regex]::Match($cargoManifest, '(?ms)^\[\[bin\]\]\s*(.*?)(?=^\[|\z)')
$cargoBinName = [regex]::Match($cargoBinBlock.Groups[1].Value, '(?m)^name\s*=\s*"([^"]+)"\s*$')
if (-not $cargoBinName.Success -or $cargoBinName.Groups[1].Value -ne $tauriConfig.mainBinaryName) {
    throw "El target bin de Cargo debe llamarse $($tauriConfig.mainBinaryName)."
}

$buildExitCode = 1
Push-Location $backendPath
try {
    cargo tauri dev @TauriArgs
    $buildExitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}

if ($buildExitCode -ne 0) {
    throw "El modo desarrollo de Windows terminó con el código $buildExitCode."
}
