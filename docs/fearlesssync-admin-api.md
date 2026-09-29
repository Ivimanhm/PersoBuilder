# Contrato de integración con FearlessSync

PersoBuilder usa las rutas existentes de FearlessSync para crear series y partidas sin token, y su ruta `PUT /winner` para guardar ganadores. Las acciones administrativas usan únicamente `FEARLESS_ADMIN_TOKEN`, configurado en FearlessSync. La instancia remota no fue accesible durante esta implementación.

## Autorización

- `GET /api/admin/validate` con `Authorization: Bearer <Admin Token>`. Respuesta `200 { "valid": true }` solo si el token es válido; `401` en caso contrario. No devolver el token.
- `POST /api/series` y `POST /api/series/{seriesId}/games` no requieren token.
- Las dos rutas de escritura siguientes deben verificar el mismo token en **cada petición**. Sin token, token inválido o revocado: `401` o `403`, sin mutar datos.
- Respuestas de error sin secretos y sin eco de la cabecera `Authorization`.

## Ganador

- `PUT /api/series/{seriesId}/games/{gameNumber}/winner` con JSON `{ "winner": "blue" | "red" }`.
- Debe actualizar de forma duradera la partida identificada por serie y número. `404` si no existe. La respuesta puede devolver la partida actualizada; PersoBuilder comprueba el resultado con `GET /api/series/{seriesId}`.
- Cada juego de `GET /api/series/{seriesId}` debe incluir `winner` cuando exista, para que el historial y la web muestren el mismo dato.

## Borrado y pool

- `DELETE /api/series/{seriesId}/games/{gameNumber}`. `404` si no existe; éxito solo después de confirmar el borrado duradero.
- En la misma operación se debe recalcular el conjunto de campeones usados a partir de las partidas restantes. `GET /api/series/{seriesId}` ya no debe incluir la partida y `GET /api/series/{seriesId}/used-champions` debe devolver exactamente los campeones de las partidas restantes.
- La numeración de nuevas partidas debe mantenerse coherente después del borrado. Si se conservan huecos, el siguiente número debe ser `max(gameNumber) + 1`; si se renumeran partidas, el servidor debe devolver los nuevos números de forma consistente en todas las lecturas y aceptar el siguiente número que envía el cliente. La primera opción preserva identidades y es preferible.

PersoBuilder no elimina ni cambia la copia local de una partida sincronizada cuando la petición remota falla. Comprueba las lecturas posteriores antes de considerar completada la operación. Si el borrado remoto tuvo éxito pero una lectura de verificación falla, el historial se puede recargar para reconciliar el estado.
