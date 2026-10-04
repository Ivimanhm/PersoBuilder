# PersoBuilder

**Última actualización:** 4 de octubre de 2026.

**Versión de la aplicación:** `1.0.2`.

PersoBuilder ayuda a crear equipos de League of Legends, simular drafts Fearless y elegir campeones con una ruleta. Incluye el catálogo local, así que las funciones principales no necesitan conexión. El modo Online añade la consulta y sincronización de partidas Fearless con una API configurable.

## Funciones de la aplicación

- Generar uno o dos equipos con cinco posiciones por equipo o con campeones completamente aleatorios.
- Seleccionar manualmente cinco campeones para el Equipo Azul y cinco para el Equipo Rojo en un draft Fearless.
- Excluir del draft campeones elegidos antes en la serie Fearless conocida por el dispositivo y, en Online, por la API.
- Girar una ruleta filtrada por TOP, Jungla, MID, ADC o Support.
- Consultar y filtrar el historial, registrar ganadores y borrar partidas; las operaciones sobre partidas Fearless remotas requieren un Admin Token válido.
- Detectar actualizaciones de Android en GitHub Releases y abrir la descarga del APK desde la campana de notificaciones.

La barra inferior contiene **Inicio**, **Equipos**, **Draft**, **Ruleta** y **Ajustes**. El **Historial** se abre desde Inicio. Para instrucciones paso a paso, consulta la [Guía de usuario](docs/guia-de-usuario.md).

### Modo Local y modo Online

El control **MODO** de la cabecera cambia entre ambos modos. Local usa el catálogo distribuido y no consulta la serie Fearless ni sincroniza partidas. Online consulta el servicio Fearless para leer campeones usados e historial y sincronizar partidas nuevas. La app puede hacer una comprobación de salud al iniciar o al guardar una URL para conocer el estado de conexión; esto no envía una partida.

El guardado de un draft escribe primero en el dispositivo. Si falla una sincronización Online, la partida se conserva localmente y queda pendiente para un reintento posterior. Los drafts creados en Local y la generación de equipos se guardan únicamente en el historial local. No se necesita una cuenta.

En Online, cada partida se prepara con `GET /api/fearless` y se confirma con `POST /api/fearless`, conservando el ID de serie y el número recibidos. La app no crea series ni calcula el ID siguiente. Un conflicto de serie bloquea el reenvío automático de esa partida a otra serie. El contrato completo está en [Integración con FearlessSync](docs/fearlesssync-admin-api.md).

### Actualizaciones de Android

La campana consulta las releases públicas de `Ivimanhm/PersoBuilder`, independientemente del modo Local/Online de Fearless. Si encuentra una versión estable superior con APK universal, muestra un punto de aviso. El panel presenta el icono, el nombre con la versión y **Descargar APK**; se puede cerrar con la **X**, con la campana, pulsando fuera o arrastrándolo a un lado.

La descarga abre el navegador de Android. El usuario descarga el APK y confirma la actualización en el sistema. La app nativa de escritorio no ofrece estos APKs. Consulta [Actualizaciones de Android](docs/android-updates.md) para preparar y publicar una release.

## Datos locales

En la aplicación nativa, el catálogo de campeones se importa a `draftlab.db`, dentro del directorio de datos de Tauri. El modo web carga el archivo JSON incluido con el frontend. El historial, la URL de API y el estado reciente de conexión se guardan en el almacenamiento local del WebView o navegador; no forman parte de esa base SQLite. Limpiar los datos locales del perfil puede borrar el historial y las preferencias.

Para conocer el detalle de modelos y flujos, consulta [Arquitectura](docs/arquitectura.md).

## Tecnologías

| Tecnología | Uso |
| --- | --- |
| Tauri 2 | Host nativo, WebView y comunicación IPC. |
| Rust | Comandos nativos, acceso SQLite y generación de equipos. |
| SQLite / rusqlite | Migraciones y catálogo de campeones nativo. |
| Preact / TypeScript | Interfaz, estado de pantalla y fallback web. |
| Vite | Servidor de desarrollo y build del frontend. |
| Data Dragon / CommunityDragon | Fuentes de datos e imágenes del catálogo. |

## Requisitos

- Node.js y npm para el frontend web.
- Rust estable y Cargo para ejecutar o compilar el host Tauri.
- Dependencias nativas de Tauri 2 para el sistema operativo de destino. Consulta la [guía oficial de prerrequisitos de Tauri](https://v2.tauri.app/start/prerequisites/).
- Para Android: Android Studio, Android SDK, NDK y un dispositivo autorizado por ADB.

## Desarrollo

Desde PowerShell, instala las dependencias frontend una vez:

```powershell
cd .\src\frontend
npm.cmd install
```

### Ejecutar como web

```powershell
cd .\src\frontend
npm.cmd run dev
```

Vite sirve la interfaz en el navegador. Esta opción no compila ni ejecuta el backend Rust: el catálogo se lee de `public/champions.json` y la generación de equipos usa el fallback TypeScript. Las llamadas a Fearless desde un navegador dependen de que la API permita CORS para el origen local de Vite.

### Ejecutar con Tauri

```powershell
cd .\src\backend
cargo tauri dev
```

Ejecuta el comando desde `src/backend`, donde está `tauri.conf.json`. Tauri inicia la interfaz de Vite dentro del WebView, conecta las llamadas IPC con Rust y abre la base SQLite en el directorio de datos de la aplicación. Los cambios frontend se sirven con Vite; los cambios Rust necesitan compilar el backend.

## Compilación

Build del frontend web:

```powershell
cd .\src\frontend
npm.cmd run build
```

TypeScript comprueba los tipos y Vite genera los archivos en `src/frontend/dist`. Esa carpeta es salida generada; edita las fuentes en `src/frontend/src` y `src/frontend/public`.

Build de la aplicación Tauri:

```powershell
cd .\src\backend
cargo tauri build
```

Los instaladores y formatos producidos dependen de la plataforma y configuración Tauri local. El nombre visible `Perso-Builder` y el identificador `com.persobuilder.app` se definen en `src/backend/tauri.conf.json`.

## Windows

Los scripts de Windows se ejecutan desde PowerShell; puedes lanzarlos desde la raíz del repositorio o desde otra carpeta.

Para abrir la app con Vite y Tauri en modo desarrollo:

```powershell
.\package\scripts\windows\windows-dev.ps1
```

Para compilar el ejecutable de la app y los instaladores MSI y NSIS:

```powershell
.\package\scripts\windows\windows-release.ps1
```

La configuración común `tauri.conf.json` fija el producto y el binario como `Perso-Builder` para Windows y Android; `Cargo.toml` declara ese nombre para el target ejecutable. El script de release comprueba que las versiones de Tauri y Cargo coinciden y deja estas salidas:

- Desarrollo: `src/backend/target/debug/Perso-Builder.exe`
- Build: `src/backend/target/release/Perso-Builder.exe` (ejecutable de la app, no instalador)
- Instalador MSI: `src/backend/target/release/bundle/msi/Perso-Builder-1.0.2.msi`
- Instalador NSIS: `src/backend/target/release/bundle/nsis/Perso-Builder-1.0.2-setup.exe`

Los dos nombres de instalador usan la versión declarada en Tauri y Cargo. El script estandariza automáticamente los nombres que genera Tauri, incluyendo la arquitectura en el nombre original.

Se compila para la arquitectura Windows del equipo. El `.exe` directo ejecuta la app, pero no es un instalador y requiere que WebView2 Runtime esté disponible en Windows. Los archivos `.msi` y `-setup.exe` sí instalan la app. Los instaladores generados por este script no tienen firma Authenticode; firmarlos para distribución requiere un certificado de firma de código. Para compilar, instala los [prerrequisitos de Tauri para Windows](https://v2.tauri.app/start/prerequisites/). Si falla solo la generación MSI con un error `light.exe`, comprueba que la característica opcional VBScript de Windows esté habilitada; Tauri la necesita para empaquetar MSI.

## Android en Windows

Para ejecutar en un dispositivo conectado por USB:

```powershell
cd .\package\scripts\android
.\android-dev-usb.ps1
```

El script sincroniza la plantilla y los iconos Android, valida que ADB vea un dispositivo autorizado, crea túneles USB para Vite/HMR y ejecuta `cargo tauri android dev`. Mantén el dispositivo desbloqueado y acepta la autorización de depuración USB cuando la solicite.

Para compilar un release firmado se usa `android-release.ps1`. Prepara `signing.properties` a partir de `signing.properties.example` y coloca el keystore esperado junto al script. La configuración, el certificado y las contraseñas de firma son secretos: mantenlos fuera del repositorio y de los artefactos compartidos.

```powershell
.\package\scripts\android\android-release.ps1
```

El script genera el APK universal `Perso-Builder-<versión>.apk` y el AAB en `src/backend/gen/android/app/build/outputs`. Para distribución mediante GitHub Releases se adjunta el APK firmado. Mantén el identificador y el keystore de distribución y aumenta la versión antes de publicar una actualización.

## Actualizar el catálogo de campeones

Desde la raíz del repositorio:

```powershell
node .\package\scripts\update-champions.mjs
```

El script puede recibir una versión concreta de Data Dragon:

```powershell
node .\package\scripts\update-champions.mjs 16.18.1
```

La actualización requiere conexión a Data Dragon y CommunityDragon. Actualiza copias fuente del backend y frontend y retratos; revisa los cambios antes de incluirlos en una versión. Consulta [Recursos del backend](src/backend/resources/README.md) para conocer el formato, las fuentes y las reglas del dataset.

## Comprobaciones disponibles

Comprobaciones del backend:

```powershell
cargo fmt --manifest-path .\src\backend\Cargo.toml --check
cargo clippy --manifest-path .\src\backend\Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path .\src\backend\Cargo.toml
```

Build frontend y pruebas de catálogo, Fearless y actualizaciones:

```powershell
cd .\src\frontend
npm.cmd run build
npm.cmd test
```

`npm.cmd test` valida el catálogo y ejecuta las pruebas de sincronización Fearless y actualizaciones Android. Las llamadas remotas se simulan: estas pruebas no envían partidas ni publican releases. El workflow `.github/workflows/backend.yml` comprueba tanto frontend como backend.

## Estructura principal

| Ruta | Qué contiene |
| --- | --- |
| `src/frontend/src/app` | Composición de la app, navegación y hooks de aplicación. |
| `src/frontend/src/pages` | Bienvenida, inicio, equipos, draft, ruleta, historial y ajustes. |
| `src/frontend/src/services` | Catálogo/generador, almacenamiento local, conexión, API Fearless y actualizaciones Android. |
| `src/frontend/public` | Catálogo e imágenes usados por el modo web. |
| `src/backend/src` | Comandos Tauri, modelos, persistencia SQLite y lógica Rust. |
| `src/backend/resources` | Catálogo y metadatos importados en la app nativa. |
| `src/backend/migrations` | Migraciones versionadas de SQLite. |
| `package/scripts` | Actualización del catálogo, pruebas y automatización Android/Windows. |
| `docs` | Guías de usuario, arquitectura e índice documental. |

Consulta [el índice de documentación](docs/README.md) para las guías específicas y la política de mantenimiento documental.

Las carpetas `node_modules`, `dist`, `target` y `src/backend/gen` son salidas locales o dependencias y están excluidas de Git. Las copias de Sites y las capturas temporales no forman parte de las fuentes de PersoBuilder. El servicio FearlessSync se mantiene en su propio proyecto.
