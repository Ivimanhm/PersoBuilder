# Recursos del backend

## Tabla de contenidos

1. [Visión general](#visión-general)
2. [Contenido](#contenido)
3. [Uso durante el arranque](#uso-durante-el-arranque)
4. [Actualizar el catálogo](#actualizar-el-catálogo)
5. [Reglas de mantenimiento](#reglas-de-mantenimiento)

---

## Visión general

Esta carpeta contiene los datos incluidos en el backend de PersoBuilder. El catálogo se importa a SQLite cuando la aplicación se inicia por primera vez o cuando cambia su versión.

---

## Contenido

```text
resources/
└── data/
    ├── champions.json
    └── dataset-meta.json
```

| Archivo | Contenido |
| --- | --- |
| `data/champions.json` | Campeones, identificadores, roles y rutas de retratos. |
| `data/dataset-meta.json` | Versión de Data Dragon, fecha de generación, fuentes y regla de posiciones. |

---

## Uso durante el arranque

`champion_repository::initialize` aplica primero las migraciones SQL y después compara la versión almacenada en SQLite con `dataset-meta.json`.

- Si no hay versión previa o la versión cambió, reemplaza el catálogo dentro de una transacción.
- Si la versión no cambió, no escribe de nuevo los campeones.
- Los datos de catálogo se mantienen separados de los futuros datos de usuario.

---

## Actualizar el catálogo

Desde la raíz del repositorio:

```powershell
node .\package\scripts\update-champions.mjs
```

Para una versión concreta:

```powershell
node .\package\scripts\update-champions.mjs 16.18.1
```

El script actualiza simultáneamente este directorio, el JSON público del frontend y los retratos de `src/frontend/public/champions/`.

Necesita conexión a Data Dragon y CommunityDragon. Revisa los cambios del dataset antes de distribuir una nueva versión de la aplicación.

---

## Reglas de mantenimiento

- No edites manualmente `champions.json` salvo una corrección excepcional y documentada.
- Mantén `champions.json` y `dataset-meta.json` juntos; la versión de metadatos controla la reimportación.
- Si cambia el formato del catálogo, añade una migración de base de datos cuando sea necesaria y pruebas de regresión.
- No guardes datos de usuario ni información sensible en esta carpeta.
