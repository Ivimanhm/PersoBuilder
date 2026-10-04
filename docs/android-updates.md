# Actualizaciones de Android desde GitHub Releases

**Última actualización:** 4 de octubre de 2026.

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

- Consulta al iniciar, al abrir el panel y al volver a primer plano. Reutiliza
  una comprobación correcta durante 15 minutos; el botón de comprobación fuerza
  una consulta nueva cuando no hay actualización disponible. Las consultas
  simultáneas se deduplican. Funciona independientemente del modo Fearless.
- Lee hasta las 100 releases más recientes y selecciona el APK estable con mayor
  versión numérica que la instalada. No depende del orden de publicación ni de
  comparar las versiones como texto.
- En la app nativa usa la versión del paquete instalado. La vista del navegador
  usa la versión de `tauri.conf.json` para permitir previsualizar el panel.
- Muestra el punto solo para una actualización sin leer. Al abrir el aviso guarda
  su tag en el almacenamiento local. El aviso y la descarga siguen disponibles;
  una nueva versión vuelve a activar el punto.
- El aviso muestra solo el icono, el nombre con la versión y **Descargar APK**.
  Las notas de la release no se muestran en el panel. Se cierra con la **X**, la
  campana, una pulsación fuera, Escape o un arrastre horizontal.
- La descarga abre el navegador de Android mediante el complemento oficial
  `tauri-plugin-opener`, limitado a enlaces de APK en este repositorio. Android
  solicita al usuario la confirmación de instalación y los permisos de ese origen.
  No instala en silencio ni considera que descargar equivale a actualizar.
- Los errores y límites de GitHub permiten reintentar. Un fallo no se muestra como
  «No hay actualizaciones» ni descarta una actualización ya detectada en la sesión.
- La app nativa de escritorio no ofrece APKs de Android. Esta integración no
  implementa todavía un actualizador de Windows.

La primera versión con esta funcionalidad debe instalarse por el procedimiento
actual: las versiones anteriores no tienen el comprobador.

## Verificación

`npm.cmd --prefix src/frontend test` incluye las pruebas del servicio:
comparación numérica, APK universal, filtrado de releases, versiones instaladas,
enlaces, lectura persistente, consultas simultáneas, caché, reintentos y descarga
nativa simulada. Para probar la interfaz sin publicar una versión ficticia,
interceptar en un navegador la respuesta de la API de GitHub y devolver una release
superior con un APK del formato esperado.

Antes de distribuir, comprobar en un dispositivo Android que el botón abre el
navegador y que el APK firmado actualiza la instalación anterior conservando sus
datos. Un APK de depuración no sustituye al firmado de distribución.

## Documentos relacionados

- [Guía de usuario](guia-de-usuario.md): comportamiento del panel y de la descarga.
- [Arquitectura](arquitectura.md): servicio, caché, almacenamiento y permisos nativos.
- [README del proyecto](../README.md): requisitos y scripts Android.
