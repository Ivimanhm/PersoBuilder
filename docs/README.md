# Documentación de PersoBuilder

**Última actualización:** 4 de octubre de 2026.

## Documentos generales

| Documento | Audiencia y contenido |
| --- | --- |
| [README principal](../README.md) | Entrada al proyecto: tecnologías, desarrollo, compilación y enlaces. |
| [Guía de usuario](guia-de-usuario.md) | Uso de las pantallas, modos Local y Online, historial y ajustes. |
| [Arquitectura](arquitectura.md) | Componentes, flujos, comandos, persistencia y sincronización. |

## Guías específicas

| Documento | Contenido |
| --- | --- |
| [Integración con FearlessSync](fearlesssync-admin-api.md) | Preparación y sincronización con `/api/fearless`, errores e historial/administración por ID. |
| [Actualizaciones de Android](android-updates.md) | Publicación en GitHub Releases, APK firmado, avisos y descarga desde la app. |
| [Recursos del backend](../src/backend/resources/README.md) | Catálogo integrado de campeones y actualización de datos. |
| [Iconos de posiciones](../src/frontend/public/icons/roles/README.md) | Procedencia, correspondencia y mantenimiento de los iconos. |

## Mantenimiento

Mantén cada documento cerca de su audiencia: las instrucciones para usuarios en la guía de usuario; decisiones y flujos técnicos en arquitectura; los comandos habituales de desarrollo en el README principal; y los detalles de un recurso en su propia carpeta.

Al cambiar una función, actualiza la guía de usuario si cambia el comportamiento visible y arquitectura si cambian los componentes, los datos o sus flujos. No incluyas contraseñas, certificados, tokens ni rutas personales.

Conserva el formato de cada documento: títulos jerárquicos, tablas de comparación, listas de pasos, enlaces relativos y bloques de código con su lenguaje. Actualiza la fecha de revisión al cambiar el contenido. Las fechas del catálogo o de descarga de recursos describen hechos anteriores y no deben reemplazarse por la fecha de revisión del documento.
