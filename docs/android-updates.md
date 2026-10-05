# Avisos de actualización desde GitHub Releases

**Última actualización:** 5 de octubre de 2026.

La campana consulta las releases públicas de `Ivimanhm/PersoBuilder`. No utiliza
la API de Fearless ni necesita un token de GitHub.

## Publicar una actualización

1. Actualizar la versión en `src/backend/tauri.conf.json`,
   `src/backend/Cargo.toml` y `src/frontend/package.json` (y su lockfile).
   Usar versiones estables `MAJOR.MINOR.PATCH`, por ejemplo `1.0.3`.
2. Compilar el APK universal firmado con
   `package/scripts/android/android-release.ps1`. Conservar el identificador
   `com.persobuilder.app` y el keystore de distribución. Comprobar que el
   `versionCode` generado es superior al de la versión instalada.
3. Crear una release en GitHub con tag `1.0.3` o `v1.0.3`, escribir las novedades
   y adjuntar `Perso-Builder-1.0.3.apk`. El nombre debe coincidir con la versión.
   El APK generado por este script es universal; no renombrar un APK específico
   de una arquitectura como si fuera universal.
4. Publicar la release como estable, con el APK ya cargado. Se ignoran borradores,
   prereleases y releases sin el APK universal. Un AAB no sustituye al APK.

El repositorio y sus releases deben seguir siendo públicos. No introducir un
token privado en el APK para acceder a un repositorio privado.

## Comportamiento de la app

- Consulta automáticamente solo al entrar en la app. Abrir el panel o volver a
  primer plano no dispara nuevas comprobaciones; no hay consultas periódicas. Reutiliza
  una comprobación correcta durante 15 minutos; el botón de comprobación fuerza
  una consulta nueva cuando no hay actualización disponible. Las consultas
  simultáneas se deduplican. Funciona independientemente del modo Fearless.
  La caché se guarda en el almacenamiento local y se reutiliza entre aperturas.
  Se invalida si cambia la versión instalada o la plataforma; si el almacenamiento
  no está disponible, se conserva la caché en memoria.
- Lee hasta las 100 releases más recientes y selecciona el APK estable con mayor
  versión numérica que la instalada. No depende del orden de publicación ni de
  comparar las versiones como texto.
- En la app nativa usa la versión del paquete instalado. La vista del navegador
  usa la versión de `tauri.conf.json` para permitir previsualizar el panel.
- Al detectar una actualización muestra un modal con la versión instalada y la
  nueva y **Descargar actualización** a todo el ancho. Se puede cerrar
  con la **X** o Escape. La misma versión se anuncia una vez por apertura, aunque
  se vuelva a primer plano; una nueva apertura vuelve a avisar si sigue pendiente.
- La campana mantiene el punto mientras haya una versión superior disponible,
  incluso después de cerrar el modal, leer el panel o abrir la descarga.
  El panel muestra ambas versiones y conserva el acceso a la actualización.
  Se cierra con la **X**, la campana, una pulsación fuera, Escape o un arrastre horizontal.
- La descarga abre el navegador de Android mediante el complemento oficial
  `tauri-plugin-opener`, limitado a enlaces de APK en este repositorio. Android
  solicita al usuario la confirmación de instalación y los permisos de ese origen.
  No instala en silencio ni considera que descargar equivale a actualizar.
- Los errores y límites de GitHub permiten reintentar. Un fallo no se muestra como
  «No hay actualizaciones» ni descarta una actualización ya detectada en la sesión.
- En Windows selecciona la mayor release estable con un instalador cargado llamado
  `Perso-Builder-<versión>.msi` o `Perso-Builder-<versión>-setup.exe`.
  **Ver nueva versión** abre su página en GitHub para elegir y descargar el instalador.
  No ofrece APKs en Windows ni instala automáticamente en ninguna plataforma.

La primera versión con esta funcionalidad debe instalarse por el procedimiento
actual: las versiones anteriores no tienen el comprobador.

## Verificación

`npm.cmd --prefix src/frontend test` incluye las pruebas del servicio:
comparación numérica, APK universal, filtrado de releases, versiones instaladas,
enlaces, consultas simultáneas, caché entre aperturas y su caducidad, cambios de versión
y plataforma, almacenamiento inaccesible, reintentos y apertura nativa simulada.
Para probar la interfaz sin publicar una versión ficticia,
interceptar en un navegador la respuesta de la API de GitHub y devolver una release
superior con un APK del formato esperado.

Antes de distribuir, comprobar en un dispositivo Android que el botón abre el
navegador y que el APK firmado actualiza la instalación anterior conservando sus
datos. Un APK de depuración no sustituye al firmado de distribución.

## Documentos relacionados

- [Guía de usuario](guia-de-usuario.md): comportamiento del panel y de la descarga.
- [Arquitectura](arquitectura.md): servicio, caché, almacenamiento y permisos nativos.
- [README del proyecto](../README.md): requisitos y scripts Android.
