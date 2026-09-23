$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$backendPath = Join-Path $projectRoot "src\backend"
$templateRoot = Join-Path $backendPath "android-template"
$androidRoot = Join-Path $backendPath "gen\android"
$adb = Get-Command adb -ErrorAction Stop

function Sync-AndroidNative {
    if (-not (Test-Path -LiteralPath $androidRoot -PathType Container)) {
        Push-Location $backendPath
        try { cargo tauri android init --ci --skip-targets-install }
        finally { Pop-Location }
    }

    # Evita que un MainActivity de un identificador anterior se compile junto
    # al de com.persobuilder.app cuando se reutiliza el proyecto generado.
    $legacyJavaDirectory = Join-Path $androidRoot "app\src\main\java\com\draftlab"
    if (Test-Path -LiteralPath $legacyJavaDirectory -PathType Container) {
        Remove-Item -LiteralPath $legacyJavaDirectory -Recurse -Force
    }

    $files = @(
        @{ Source = "AndroidManifest.xml"; Destination = "app\src\main\AndroidManifest.xml" },
        @{ Source = "MainActivity.kt"; Destination = "app\src\main\java\com\persobuilder\app\MainActivity.kt" },
        @{ Source = "strings.xml"; Destination = "app\src\main\res\values\strings.xml" },
        @{ Source = "themes.xml"; Destination = "app\src\main\res\values\themes.xml" },
        @{ Source = "themes-night.xml"; Destination = "app\src\main\res\values-night\themes.xml" }
    )

    foreach ($file in $files) {
        $source = Join-Path $templateRoot $file.Source
        $destination = Join-Path $androidRoot $file.Destination
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
            throw "No se encontro la plantilla Android: $source"
        }
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
        Copy-Item -LiteralPath $source -Destination $destination -Force
    }

    $iconSource = Join-Path $backendPath "icons\android"
    $iconDestination = Join-Path $androidRoot "app\src\main\res"
    if (-not (Test-Path -LiteralPath $iconSource -PathType Container)) {
        throw "No se encontro el conjunto de iconos Android: $iconSource"
    }
    Get-ChildItem -LiteralPath $iconSource -Force | Copy-Item -Destination $iconDestination -Recurse -Force

    $assetDirectory = Join-Path $androidRoot "app\src\main\assets"
    New-Item -ItemType Directory -Force -Path $assetDirectory | Out-Null
    Copy-Item -LiteralPath (Join-Path $backendPath "tauri.conf.json") -Destination (Join-Path $assetDirectory "tauri.conf.json") -Force
}

Sync-AndroidNative

& $adb.Source get-state | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "No hay ningun dispositivo Android autorizado por ADB. Conecta el movil por USB, desbloquealo y acepta la depuracion USB."
}

# El movil accede a Vite y HMR mediante USB, sin necesitar una IP de la LAN.
& $adb.Source reverse tcp:1420 tcp:1420
if ($LASTEXITCODE -ne 0) { throw "No se pudo crear el tunel ADB para el puerto 1420." }
& $adb.Source reverse tcp:1421 tcp:1421
if ($LASTEXITCODE -ne 0) { throw "No se pudo crear el tunel ADB para el puerto 1421." }

$env:TAURI_DEV_HOST = "127.0.0.1"

Push-Location $backendPath
try {
    cargo tauri android dev --host=127.0.0.1
}
finally {
    Pop-Location
}
