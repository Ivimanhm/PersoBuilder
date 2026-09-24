param(
    [switch]$FrontendOnly
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$libraryPath = Join-Path $projectRoot "..\ck-agent-lib"
$frontendPath = Join-Path $projectRoot "src\frontend"
$backendPath = Join-Path $projectRoot "src\backend"

if (-not (Test-Path -LiteralPath $libraryPath -PathType Container)) {
    throw "Component library not found: $libraryPath"
}

if (-not (Test-Path -LiteralPath (Join-Path $libraryPath "node_modules") -PathType Container)) {
    Push-Location $libraryPath
    try { npm ci }
    finally { Pop-Location }
}

if (-not (Test-Path -LiteralPath (Join-Path $frontendPath "node_modules\.bin\tauri"))) {
    Push-Location $frontendPath
    try { npm ci }
    finally { Pop-Location }
}

Push-Location $libraryPath
try {
    npm run build
}
finally {
    Pop-Location
}

Push-Location $frontendPath
try {
    if ($FrontendOnly) {
        npm run build
    } else {
        # Genera los instaladores Windows con la integracion del sistema incluida.
        npm run tauri -- build
        $buildExitCode = $LASTEXITCODE
    }
}
finally {
    Pop-Location
}

if ($FrontendOnly) {
    exit 0
}

$versionMatch = Select-String -LiteralPath (Join-Path $backendPath "Cargo.toml") -Pattern '^version = "([^"]+)"' | Select-Object -First 1
$appVersion = $versionMatch.Matches[0].Groups[1].Value
$os = Get-CimInstance Win32_OperatingSystem
$systemName = "$($os.Caption) (build $($os.BuildNumber), $env:PROCESSOR_ARCHITECTURE)"
$bundlePath = Join-Path $backendPath "target\release\bundle"

function Write-PackageResult {
    param(
        [string]$Format,
        [string]$Platform,
        [string]$Directory,
        [string]$Filter
    )

    $artifacts = @(Get-ChildItem -LiteralPath $Directory -Filter $Filter -File -ErrorAction SilentlyContinue)
    if ($artifacts.Count -eq 0) {
        Write-Host "[NO GENERADO]" -ForegroundColor Red -NoNewline
        Write-Host " $Format"
        Write-Host $Platform
        return
    }

    Write-Host "[GENERADO]" -ForegroundColor Green -NoNewline
    Write-Host " $Format"
    Write-Host $Platform
    $artifacts | ForEach-Object { Write-Host $_.FullName }
}

Write-Host "`n==================== ck-endurance-btg $appVersion ====================`n"
Write-Host "Sistema de compilacion:"
Write-Host "$systemName`n"
Write-Host "Carpeta de salida:"
Write-Host "$bundlePath`n"
Write-Host "----------------------- Paquetes -----------------------`n"
Write-PackageResult -Format "MSI" -Platform "Windows 10/11 y despliegues corporativos" -Directory (Join-Path $bundlePath "msi") -Filter "*_$appVersion_*.msi"
Write-Host ""
Write-PackageResult -Format "NSIS" -Platform "Windows 10/11 (instalador .exe)" -Directory (Join-Path $bundlePath "nsis") -Filter "*_$appVersion_*-setup.exe"
Write-Host "`n========================================================"

if ($buildExitCode -ne 0) {
    throw "El empaquetado termino con errores (codigo $buildExitCode). Revisa los formatos marcados como NO GENERADO."
}
