# Iconos de posiciones

## Tabla de contenidos

1. [Visión general](#visión-general)
2. [Contenido](#contenido)
3. [Procedencia](#procedencia)
4. [Uso en la interfaz](#uso-en-la-interfaz)
5. [Mantenimiento y licencia](#mantenimiento-y-licencia)

---

## Visión general

Esta carpeta contiene los iconos SVG de las cinco posiciones de League of Legends que muestra PersoBuilder en equipos, draft y ruleta.

---

## Contenido

| Archivo | Posición de PersoBuilder | Recurso original |
| --- | --- | --- |
| `top.svg` | TOP | `position-top.svg` |
| `jungle.svg` | JUNGLE | `position-jungle.svg` |
| `mid.svg` | MID | `position-middle.svg` |
| `adc.svg` | ADC | `position-bottom.svg` |
| `support.svg` | SUPPORT | `position-utility.svg` |

---

## Procedencia

Los iconos proceden de los recursos públicos del cliente de League of Legends publicados por CommunityDragon:

```text
https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-champ-select/global/default/svg/
```

La última consulta registrada fue el 14 de septiembre de 2026.

---

## Uso en la interfaz

El frontend construye las rutas como recursos públicos:

```text
/icons/roles/<rol>.svg
```

Los nombres de archivo deben coincidir con los roles del catálogo: `top`, `jungle`, `mid`, `adc` y `support`.

---

## Mantenimiento y licencia

Al sustituir un icono, conserva su nombre de archivo y formato SVG para no romper la interfaz.

League of Legends y sus recursos son propiedad de Riot Games. CommunityDragon publica estos recursos bajo la política Legal Jibber Jabber de Riot Games; Riot Games no patrocina ni respalda PersoBuilder.
