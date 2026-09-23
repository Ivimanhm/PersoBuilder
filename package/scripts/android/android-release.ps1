param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$TauriArgs
)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$backendPath = Join-Path $projectRoot "src\backend"
$templateRoot = Join-Path $backendPath "android-template"
$androidRoot = Join-Path $backendPath "gen\android"
$signingProperties = Join-Path $PSScriptRoot "signing.properties"
$keystoreFile = Join-Path $PSScriptRoot "perso-builder.keystore"

function Sync-AndroidNative {
    if (-not (Test-Path -LiteralPath $androidRoot -PathType Container)) {
        Push-Location $backendPath
        try { cargo tauri android init --ci --skip-targets-install }
        finally { Pop-Location }
    }

    # El identificador Android actual es com.persobuilder.app. El proyecto
    # generado puede conservar archivos de un identificador anterior, que
    # Gradle compilaría junto al MainActivity actual.
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

function Set-ReleaseArtifactNames {
    $buildFile = Join-Path $androidRoot "app\build.gradle.kts"
    if (-not (Test-Path -LiteralPath $buildFile -PathType Leaf)) {
        throw "No se encontro la configuracion Gradle de Android: $buildFile"
    }

    $marker = "// perso-builder Android output names v1"
    $contents = Get-Content -LiteralPath $buildFile -Raw
    if ($contents.Contains($marker)) {
        # El proyecto Android generado se conserva entre builds. Actualiza los
        # nombres inyectados previamente cuando cambia la versión de la app.
        $contents = [regex]::Replace(
            $contents,
            'outputFileName = "Perso-Builder-[^"]+\.apk"',
            "outputFileName = `"Perso-Builder-$appVersion.apk`""
        )
        $contents = [regex]::Replace(
            $contents,
            'resolve\("Perso-Builder-[^"]+\.aab"\)',
            "resolve(`"Perso-Builder-$appVersion.aab`")"
        )
        [System.IO.File]::WriteAllText($buildFile, $contents, [System.Text.UTF8Encoding]::new($false))
        return
    }

    $configuration = @"

$marker
android.applicationVariants.all {
    if (buildType.name == "release") {
        outputs.all {
            (this as com.android.build.gradle.internal.api.BaseVariantOutputImpl).outputFileName = "Perso-Builder-$appVersion.apk"
        }
    }
}

tasks.configureEach {
    if (name == "bundleUniversalRelease") {
        doLast {
            val outputDirectory = layout.buildDirectory.dir("outputs/bundle/universalRelease").get().asFile
            val generatedBundle = outputDirectory.resolve("app-universal-release.aab")
            val namedBundle = outputDirectory.resolve("Perso-Builder-$appVersion.aab")
            if (generatedBundle.isFile && generatedBundle != namedBundle) {
                generatedBundle.copyTo(namedBundle, overwrite = true)
            }
        }
    }
}
"@
    [System.IO.File]::AppendAllText($buildFile, $configuration, [System.Text.UTF8Encoding]::new($false))
}

function Set-ReleaseSigning {
    if (-not (Test-Path -LiteralPath $signingProperties -PathType Leaf)) {
        throw "No se encontro la configuracion de firma: $signingProperties. Copia signing.properties.example como signing.properties en esta misma carpeta y rellena las contrasenas."
    }
    if (-not (Test-Path -LiteralPath $keystoreFile -PathType Leaf)) {
        throw "No se encontro el certificado: $keystoreFile. Coloca el archivo .keystore junto a android-release.ps1."
    }

    # El archivo de propiedades real permanece junto al script, pero Gradle necesita
    # una copia temporal dentro del proyecto Android generado.
    $generatedProperties = Get-Content -LiteralPath $signingProperties -Raw
    $normalizedKeystorePath = $keystoreFile.Replace("\", "/")
    $generatedProperties = [regex]::Replace(
        $generatedProperties,
        "(?m)^storeFile=.*$",
        "storeFile=$normalizedKeystorePath"
    )
    [System.IO.File]::WriteAllText(
        (Join-Path $androidRoot "keystore.properties"),
        $generatedProperties,
        [System.Text.UTF8Encoding]::new($false)
    )

    $buildFile = Join-Path $androidRoot "app\build.gradle.kts"
    $marker = "// perso-builder Android release signing"
    $contents = Get-Content -LiteralPath $buildFile -Raw
    if ($contents.Contains($marker)) { return }

    $configuration = @"

$marker
val persoBuilderReleaseProperties = Properties().apply {
    val persoBuilderReleasePropertiesFile = rootProject.file("keystore.properties")
    persoBuilderReleasePropertiesFile.inputStream().use { load(it) }
}

android {
    signingConfigs {
        create("persoBuilderRelease") {
            storeFile = file(persoBuilderReleaseProperties.getProperty("storeFile"))
            storePassword = persoBuilderReleaseProperties.getProperty("storePassword")
            keyAlias = persoBuilderReleaseProperties.getProperty("keyAlias")
            keyPassword = persoBuilderReleaseProperties.getProperty("keyPassword")
        }
    }
    buildTypes {
        getByName("release") {
            signingConfig = signingConfigs.getByName("persoBuilderRelease")
        }
    }
}
"@
    [System.IO.File]::AppendAllText($buildFile, $configuration, [System.Text.UTF8Encoding]::new($false))
}

$versionMatch = Select-String -LiteralPath (Join-Path $backendPath "Cargo.toml") -Pattern '^version = "([^"]+)"' | Select-Object -First 1
if ($null -eq $versionMatch) {
    throw "No se pudo obtener la version de la app desde Cargo.toml."
}
$appVersion = $versionMatch.Matches[0].Groups[1].Value
$artifactName = "Perso-Builder-$appVersion"

Sync-AndroidNative
Set-ReleaseArtifactNames
Set-ReleaseSigning
$os = Get-CimInstance Win32_OperatingSystem
$systemName = "$($os.Caption) (build $($os.BuildNumber), $env:PROCESSOR_ARCHITECTURE)"
$outputPath = Join-Path $androidRoot "app\build\outputs\apk\universal\release"
$namedApk = Join-Path $outputPath "$artifactName.apk"
$namedAab = Join-Path $androidRoot "app\build\outputs\bundle\universalRelease\$artifactName.aab"

Push-Location $backendPath
try {
    cargo tauri android build --apk --aab @TauriArgs
    $buildExitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}

$apk = Get-Item -LiteralPath $namedApk -ErrorAction SilentlyContinue
$aab = Get-Item -LiteralPath $namedAab -ErrorAction SilentlyContinue

Write-Host "`n==================== Perso Builder $appVersion ====================`n"
Write-Host "Sistema de compilacion:"
Write-Host "$systemName`n"
Write-Host "Carpeta de salida:"
Write-Host "$outputPath`n"
Write-Host "----------------------- Paquetes -----------------------`n"

if ($null -ne $apk) {
    Write-Host "[GENERADO]" -ForegroundColor Green -NoNewline
    Write-Host " APK universal release"
    Write-Host "Android 7.0 o superior (ARM64, ARMv7, x86 y x86_64)"
    Write-Host $apk.FullName
}
else {
    Write-Host "[NO GENERADO]" -ForegroundColor Red -NoNewline
    Write-Host " APK universal release"
    Write-Host "Android 7.0 o superior (ARM64, ARMv7, x86 y x86_64)"
}

Write-Host ""
if ($null -ne $aab) {
    Write-Host "[GENERADO]" -ForegroundColor Green -NoNewline
    Write-Host " AAB release"
    Write-Host "Google Play (Android 7.0 o superior)"
    Write-Host $aab.FullName
}
else {
    Write-Host "[NO GENERADO]" -ForegroundColor Red -NoNewline
    Write-Host " AAB release"
    Write-Host "Google Play (Android 7.0 o superior)"
}

Write-Host "`n========================================================"

if ($buildExitCode -ne 0) {
    throw "La compilacion release de Android ha fallado (codigo $buildExitCode)."
}
if ($null -eq $apk -or $null -eq $aab) {
    throw "La compilacion termino, pero no se encontraron todos los paquetes esperados (APK y AAB)."
}
