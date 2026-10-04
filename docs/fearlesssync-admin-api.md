# Contrato de integración con FearlessSync

**Última actualización:** 4 de octubre de 2026.

PersoBuilder prepara y confirma las partidas con `/api/fearless`, sin token de administrador. El historial y las acciones administrativas conservan las rutas por ID.

## Autorización

- `GET /api/admin/validate` con `Authorization: Bearer <Admin Token>`. Respuesta `200 { "valid": true }` solo si el token es válido; `401` en caso contrario. No devolver el token.
- `GET /api/fearless` y `POST /api/fearless` no requieren token.
- Las rutas administrativas `PUT /api/series/{seriesId}/games/{gameNumber}/winner` y `DELETE /api/series/{seriesId}/games/{gameNumber}` deben verificar el mismo token en **cada petición**. Sin token, token inválido o revocado: `401` o `403`, sin mutar datos.
- Respuestas de error sin secretos y sin eco de la cabecera `Authorization`.

## Serie activa y partidas

Antes de cada partida, `GET /api/fearless` devuelve `seriesId`, `availableChampions`, `usedChampions`, `nextGameNumber`, `catalogVersion` y `totalChampions`. La app usa los IDs disponibles del servidor y conserva la identidad de esta respuesta en el registro local.

| Campo | Uso en PersoBuilder |
| --- | --- |
| `seriesId` | Identidad exacta de la serie que debe recibir esa partida. |
| `availableChampions` | Pool permitido para las selecciones. |
| `usedChampions` | Campeones ya usados en la serie activa. |
| `nextGameNumber` | Número que se conserva y envía al confirmar. |
| `catalogVersion` | Identidad o versión del catálogo usado por el servidor. |
| `totalChampions` | Total del catálogo; los conjuntos disponibles y usados deben ser coherentes. |

Al confirmar, `POST /api/fearless` recibe exclusivamente:

```json
{
  "seriesId": "ID recibido al preparar",
  "gameNumber": 1,
  "blueTeam": [1, 2, 3, 4, 5],
  "redTeam": [6, 7, 8, 9, 10]
}
```

Los IDs y el número de partida son ilustrativos; en una petición real se usa el número recibido al preparar. Los equipos contienen cinco IDs positivos cada uno, sin repetidos entre los diez, en orden TOP, JG, MID, ADC, SUP. El POST devuelve la partida guardada, `seriesId`, `seriesArchived` y `activeSeriesId`. El servidor mantiene la serie con 10 o más campeones disponibles; con menos de 10 la archiva y abre otra. La siguiente partida empieza con un GET nuevo, sin caché. El cliente no crea series, elige IDs nuevos ni llama a `/prepare`.

- `409 fearless_series_changed`: informar del conflicto, consultar Fearless de nuevo y conservar la partida antigua como fallida y bloqueada para reenvío automático. Nunca reasignarla a la serie nueva.
- `503 catalog_unavailable`: mostrar el fallo y ofrecer reintentar; no sustituir el estado por una lista vacía.
- Guardar localmente antes del POST y marcar sincronizada solo tras confirmar el guardado. Las confirmaciones simultáneas comparten una petición; antes de reintentar un POST fallido se consulta el historial por serie y número para reconocer una respuesta perdida sin duplicar partidas.
- Los registros antiguos sin identidad de preparación no reciben un número calculado desde el historial para enviarlos.
- Las rutas por ID siguen disponibles para consultar series anteriores y administrar partidas. El historial elige el ID desde el selector abierto por el botón **Fearless**, sin un campo de texto permanente.

## Consultas y disponibilidad

| Método | Ruta | Uso |
| --- | --- | --- |
| `GET` | `/api/health` | Comprobación Local/Online; respuesta correcta con `status: "ok"` y `api: "online"`. |
| `GET` | `/api/series` | Series recientes; devuelve `series` con `seriesId` y `gamesCount` para el selector. |
| `GET` | `/api/series/{seriesId}` | Historial de una serie y reconciliación de respuestas de guardado perdidas. |
| `GET` | `/api/series/{seriesId}/used-champions` | Comprobar los campeones usados después de un borrado. |

La URL base se mantiene en Ajustes. No se reemplaza por otra URL para cada serie. La lectura de historial por ID tiene una caché breve; la preparación de una partida con `/api/fearless` siempre solicita el estado actual.

## Ganador

- `PUT /api/series/{seriesId}/games/{gameNumber}/winner` con JSON `{ "winner": "blue" | "red" }`.
- Debe actualizar de forma duradera la partida identificada por serie y número. `404` si no existe. La respuesta puede devolver la partida actualizada; PersoBuilder comprueba el resultado con `GET /api/series/{seriesId}`.
- Cada juego de `GET /api/series/{seriesId}` debe incluir `winner` cuando exista, para que el historial y la web muestren el mismo dato.

## Borrado y pool

- `DELETE /api/series/{seriesId}/games/{gameNumber}`. `404` si no existe; éxito solo después de confirmar el borrado duradero.
- En la misma operación se debe recalcular el conjunto de campeones usados a partir de las partidas restantes. `GET /api/series/{seriesId}` ya no debe incluir la partida y `GET /api/series/{seriesId}/used-champions` debe devolver exactamente los campeones de las partidas restantes.
- La numeración de nuevas partidas debe mantenerse coherente después del borrado. Si se conservan huecos, el siguiente número debe ser `max(gameNumber) + 1`; si se renumeran partidas, el servidor debe devolver los nuevos números de forma consistente en todas las lecturas y aceptar el siguiente número que envía el cliente. La primera opción preserva identidades y es preferible.

PersoBuilder no elimina ni cambia la copia local de una partida sincronizada cuando la petición remota falla. Comprueba las lecturas posteriores antes de considerar completada la operación. Si el borrado remoto tuvo éxito pero una lectura de verificación falla, el historial se puede recargar para reconciliar el estado.

## Alcance

Este documento describe el contrato consumido por la app. El servidor FearlessSync se mantiene y publica en su propio proyecto; sus copias temporales de trabajo no forman parte de este repositorio. La consulta de actualizaciones Android usa GitHub Releases y es independiente de esta API.
