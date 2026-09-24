param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$TauriArgs
)

$ErrorActionPreference = "Stop"

if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    throw "El release de Windows debe compilarse desde Windows."
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$backendPath = Join-Path $projectRoot "src\backend"
$tauriConfigPath = Join-Path $backendPath "tauri.conf.json"

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    throw "No se encontro Cargo. Instala Rust y Cargo antes de compilar PersoBuilder."
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw "No se encontro npm.cmd. Instala Node.js antes de compilar PersoBuilder."
}
if (-not (Test-Path -LiteralPath $tauriConfigPath -PathType Leaf)) {
    throw "No se encontro la configuracion Tauri: $tauriConfigPath"
}
$config = Get-Content -LiteralPath $tauriConfigPath -Raw | ConvertFrom-Json
$appVersion = [string]$config.version
if ([string]::IsNullOrWhiteSpace($appVersion)) {
    throw "No se pudo obtener la version de la app desde tauri.conf.json."
}
if (-not $config.bundle.active -or $config.bundle.targets -ne "all") {
    throw "La configuracion Tauri debe tener bundle.active=true y bundle.targets=all para generar MSI y NSIS."
}

$cargoVersionMatch = Select-String -LiteralPath (Join-Path $backendPath "Cargo.toml") -Pattern '^version\s*=\s*"([^"]+)"' | Select-Object -First 1
if ($null -eq $cargoVersionMatch) {
    throw "No se pudo obtener la version del paquete Rust desde Cargo.toml."
}
$cargoVersion = $cargoVersionMatch.Matches[0].Groups[1].Value
if ($cargoVersion -ne $appVersion) {
    throw "Las versiones no coinciden: tauri.conf.json declara $appVersion y Cargo.toml declara $cargoVersion. Actualiza ambas antes de crear un release."
}

if (-not (Get-Command cargo-tauri -ErrorAction SilentlyContinue)) {
    throw "No se encontro cargo-tauri. Instala el CLI de Tauri antes de compilar."
}

$artifactName = [string]$config.productName
$binaryName = [string]$config.mainBinaryName
if ($artifactName -ne "Perso-Builder" -or $binaryName -ne $artifactName) {
    throw "La configuracion Tauri debe usar Perso-Builder como nombre de producto y ejecutable."
}
$cargoManifest = Get-Content -LiteralPath (Join-Path $backendPath "Cargo.toml") -Raw
$cargoBinBlock = [regex]::Match($cargoManifest, '(?ms)^\[\[bin\]\]\s*(.*?)(?=^\[|\z)')
$cargoBinName = [regex]::Match($cargoBinBlock.Groups[1].Value, '(?m)^name\s*=\s*"([^"]+)"\s*$')
if (-not $cargoBinName.Success -or $cargoBinName.Groups[1].Value -ne $binaryName) {
    throw "El target bin de Cargo debe llamarse $binaryName para el escritorio de Windows."
}
$releaseDirectory = Join-Path $backendPath "target\release"
$bundleRoot = Join-Path $releaseDirectory "bundle"
$msiDirectory = Join-Path $bundleRoot "msi"
$nsisDirectory = Join-Path $bundleRoot "nsis"
$installerBaseName = "$artifactName-$appVersion"
$namedApp = Join-Path $releaseDirectory "$binaryName.exe"
$namedMsi = Join-Path $msiDirectory "$installerBaseName.msi"
$namedNsis = Join-Path $nsisDirectory "$installerBaseName-setup.exe"
try {
    $system = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
    $systemName = "$($system.Caption) (build $($system.BuildNumber), $env:PROCESSOR_ARCHITECTURE)"
}
catch {
    $systemVersion = [Environment]::OSVersion.Version
    $systemName = "Windows (build $($systemVersion.Build), $env:PROCESSOR_ARCHITECTURE)"
}
$buildStartedAt = Get-Date

$buildExitCode = 1
Push-Location $backendPath
try {
    cargo tauri build @TauriArgs
    $buildExitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}

$app = $null
$appFile = Get-Item -LiteralPath $namedApp -ErrorAction SilentlyContinue
if ($null -ne $appFile -and $appFile.LastWriteTime -ge $buildStartedAt.AddSeconds(-2)) {
    $app = $appFile
}

function Get-BuiltInstaller {
    param(
        [string]$Directory,
        [string]$Filter,
        [string]$OutputPath
    )

    if (-not (Test-Path -LiteralPath $Directory -PathType Container)) {
        return $null
    }

    $candidate = Get-ChildItem -LiteralPath $Directory -File -Filter $Filter -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -ne $OutputPath -and $_.LastWriteTime -ge $buildStartedAt.AddSeconds(-2) } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if ($null -eq $candidate) {
        return $null
    }

    Move-Item -LiteralPath $candidate.FullName -Destination $OutputPath -Force
    return Get-Item -LiteralPath $OutputPath
}

if ($buildExitCode -eq 0) {
    $msi = Get-BuiltInstaller -Directory $msiDirectory -Filter "*_$appVersion_*.msi" -OutputPath $namedMsi
    $nsis = Get-BuiltInstaller -Directory $nsisDirectory -Filter "*_$appVersion_*-setup.exe" -OutputPath $namedNsis
}
else {
    $msi = $null
    $nsis = $null
}

function Write-PackageResult {
    param(
        [string]$Format,
        [string]$Platform,
        [object[]]$Artifacts
    )

    $files = @($Artifacts | Where-Object { $null -ne $_ })
    if ($files.Count -eq 0) {
        Write-Host "[NO GENERADO]" -ForegroundColor Red -NoNewline
        Write-Host " $Format"
        Write-Host $Platform
        return
    }

    Write-Host "[GENERADO]" -ForegroundColor Green -NoNewline
    Write-Host " $Format"
    Write-Host $Platform
    $files | ForEach-Object { Write-Host $_.FullName }
}

Write-Host "`n==================== $installerBaseName ====================`n"
Write-Host "Sistema de compilacion:"
Write-Host "$systemName`n"
Write-Host "Carpeta de salida:"
Write-Host "$releaseDirectory`n"
Write-Host "----------------------- Paquetes -----------------------`n"
Write-PackageResult -Format "Aplicacion (.exe)" -Platform "Windows $env:PROCESSOR_ARCHITECTURE (ejecutable sin instalador)" -Artifacts @($app)
Write-Host ""
Write-PackageResult -Format "MSI" -Platform "Windows 10/11 y despliegues corporativos" -Artifacts @($msi)
Write-Host ""
Write-PackageResult -Format "NSIS" -Platform "Windows 10/11 (instalador .exe)" -Artifacts @($nsis)
Write-Host "`n========================================================"

if ($buildExitCode -ne 0) {
    throw "La compilacion release de Windows ha fallado (codigo $buildExitCode). Verifica los prerrequisitos de Tauri y el soporte MSI/NSIS de Windows."
}
if ($null -eq $app -or $null -eq $msi -or $null -eq $nsis) {
    throw "La compilacion termino, pero no se encontraron todos los archivos esperados (EXE de la app, MSI y NSIS)."
}
