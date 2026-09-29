# Guía de usuario

PersoBuilder permite sortear equipos de League of Legends, preparar un draft Fearless, elegir un campeón con una ruleta y revisar partidas anteriores. El catálogo y las funciones principales están disponibles en Local; Online se usa para compartir el historial Fearless a través de la API configurada.

## 1. Empezar y navegar

Al abrir la app aparece la pantalla de bienvenida. Pulsa **Comenzar** para abrir Inicio. Desde Inicio puedes abrir una tarjeta de acción. La barra de navegación inferior lleva a **Inicio**, **Equipos**, **Draft**, **Ruleta** y **Ajustes**. El **Historial** se abre desde su tarjeta en Inicio.

La cabecera indica el modo actual. Pulsa el botón **MODO LOCAL** o **MODO ONLINE** para cambiarlo:

| Modo | Qué hace | Qué necesita |
| --- | --- | --- |
| **Local** | Usa el catálogo incluido y guarda el historial en el dispositivo. No consulta la serie Fearless ni envía partidas a la API. | No necesita conexión para jugar. |
| **Online** | Además de las funciones locales, consulta los campeones ya usados y el historial Fearless remoto, e intenta sincronizar los drafts nuevos. | La API debe estar configurada y disponible. |

Para cambiar de Local a Online, pulsa el indicador **MODO** y la app comprueba la API. Si no logra conectar, se queda en Local y muestra un aviso. Al cambiar de Online a Local, la app deja de consultar el historial/serie y de hacer peticiones de juego; las partidas pendientes se conservan en el dispositivo y podrán reintentarse al volver a Online. Al iniciar, guardar una URL nueva o pedir Online, la app puede comprobar la salud del servicio para determinar el estado; esa comprobación no envía partidas.

## 2. Crear equipos

1. Abre **Equipos**.
2. En **Número de equipos**, elige **1 equipo** o **2 equipos**.
3. En **Distribución de posiciones**, elige una opción:
   - **Por posiciones**: busca una composición para TOP, Jungla (JG), MID, ADC y Support (SUP) en cada equipo.
   - **Todo aleatorio**: sortea campeones sin asignarles posiciones.
4. Pulsa **Generar equipos**. Si ya hay un resultado, el botón dice **Generar otros equipos**.

El generador no repite campeones dentro del resultado. Para el modo por posiciones intenta cubrir los cinco roles con los roles asociados a cada campeón; cuando genera dos equipos, ningún campeón se repite entre Azul y Rojo. El sorteo es aleatorio: no evalúa fuerza, nivel de habilidad ni equilibrio competitivo.

Cada generación se añade al historial local automáticamente. Si no hay suficientes campeones disponibles o no es posible cubrir las posiciones, la app presenta un mensaje de error. El número de equipos o el tipo de distribución se puede cambiar antes del siguiente sorteo.

## 3. Simular un Draft Fearless

Un draft consta de cinco selecciones para el Equipo Azul y cinco para el Equipo Rojo. La app no obliga a alternar entre los equipos: tú eliges qué celda completar en cada momento.

1. Abre **Draft**. La tabla muestra las cinco posiciones para cada equipo.
2. Pulsa una celda **Pendiente** del Equipo Azul o Rojo. La celda seleccionada queda resaltada y la app indica qué equipo elige.
3. En la lista de campeones, escribe parte del nombre para buscar o usa el filtro para limitar por posición.
4. Pulsa un campeón de la lista. Su tarjeta queda seleccionada.
5. Pulsa **Confirmar selección** para ponerlo en la celda resaltada.
6. Repite los pasos hasta ocupar las diez celdas. Puedes elegir otra celda antes de cada selección.
7. Revisa los dos equipos en el diálogo **La partida está lista**.
8. Pulsa **Guardar partida** para finalizar o **Seguir editando** para volver a la tabla.

El temporizador empieza con 30 segundos al elegir una celda y vuelve a empezar tras confirmar una selección. Cuando termina el draft aparece una ventana de revisión de 20 segundos; si el tiempo vence, la ventana se abre automáticamente. El temporizador no elige campeones ni descarta la partida. Si vuelves a editar, el plazo de revisión comienza de nuevo.

Un campeón seleccionado en una celda deja de aparecer entre las opciones del draft actual. En la serie Fearless que usa la app, también quedan excluidos los campeones de drafts anteriores guardados localmente. En Online, la app añade los campeones que comunica la API. La lista no podrá actualizarse si falla la consulta Online; la pantalla muestra un error y ofrece **Reintentar**.

### Guardado Local y Online

El guardado siempre escribe primero la partida en el dispositivo:

- **Si estás en Local**, el diálogo confirma que se guardó en el dispositivo. No se envía a ningún servidor.
- **Si estás en Online y la API responde**, el diálogo confirma el guardado local y la sincronización Online.
- **Si estás en Online y la API falla**, el diálogo informa del error, pero la copia local se conserva como pendiente de sincronización. La app reintenta la cola al recuperar el modo Online. El diagnóstico de la respuesta se muestra en el diálogo para ayudar a entender el problema.

El indicador de éxito de sincronización se refiere a la API configurada. Los campeones usados por la serie pueden afectar a drafts posteriores.

## 4. Elegir un campeón con la ruleta

1. Abre **Ruleta**.
2. Elige una posición entre TOP, Jungla, MID, ADC y Support.
3. Comprueba el número de campeones disponibles para esa posición.
4. Pulsa **Girar ruleta** y espera a que termine la animación.
5. El campeón elegido aparece en el resultado. Pulsa **Girar otra vez** para hacer un nuevo sorteo.

La ruleta filtra el catálogo por la posición seleccionada y sortea dentro de ese conjunto. No guarda el resultado en el historial y no excluye automáticamente campeones usados en drafts.

## 5. Consultar y gestionar el historial

Abre la tarjeta **Historial** desde Inicio. El historial reúne partidas de **Draft Fearless** y resultados de **Equipos aleatorios** que se hayan guardado en el dispositivo. Si la API está disponible, también puede mostrar drafts remotos.

### Buscar y filtrar

- Usa **Todos**, **Fearless** o **Equipos aleatorios** para filtrar por tipo.
- Busca por nombre de campeón o fecha en el campo de búsqueda.
- En Online, el selector de origen permite elegir **Todos**, **Local** u **Online**. En modo Local solo se muestran registros locales.
- **Todos** combina el historial del dispositivo con el remoto y omite duplicados que puede identificar por número de partida o composición.
- Si falla la carga remota, las partidas locales siguen visibles. Pulsa **Reintentar** en el aviso para volver a consultar la API.

### Indicar un ganador o borrar partidas

Todas las tarjetas Fearless muestran el menú de tres puntos. Para asignar o modificar el ganador, o borrar una partida Fearless, configura un **Admin Token** válido en Ajustes y utiliza el modo Online. Las partidas sincronizadas usan las rutas administrativas descritas en [el contrato de integración](fearlesssync-admin-api.md). La app solo actualiza su copia local tras confirmar el cambio remoto. Las partidas creadas en modo Local permanecen únicamente en este dispositivo.

Para eliminar varias tarjetas de Equipos aleatorios, mantén pulsada una tarjeta durante aproximadamente medio segundo. Marca las tarjetas que quieras quitar y pulsa **Eliminar**. Pulsa **Cancelar** para salir del modo de selección.

El historial local mantiene hasta 250 registros ordinarios. Las partidas Fearless pendientes o con errores de sincronización tienen prioridad para que se puedan reintentar; si el almacenamiento está lleno y no es posible conservar un nuevo registro, la app mostrará un error.

## 6. Configurar la conexión Fearless

1. Abre **Ajustes**.
2. Introduce la URL base de la API, por ejemplo `https://api.ejemplo.com`.
3. Pulsa **Guardar**. La app guarda la dirección localmente y ejecuta una comprobación de salud. El **Admin Token** solo se configura para seleccionar ganadores y borrar partidas.
4. Revisa el resultado. Si conecta, la app pasa a Online. Si no conecta, permanece en Local; el diálogo **Salida del health check** muestra el diagnóstico de red.
5. Cuando el servicio esté disponible, vuelve a guardar la URL o pulsa el botón de modo de la cabecera para volver a comprobar e intentar Online.

La dirección debe empezar por `https://` y no debe contener usuario, contraseña, parámetros de consulta (`?`) ni fragmento (`#`). La app nativa rechaza además direcciones IP privadas. En modo web, el servidor debe permitir las peticiones desde el origen del frontend mediante CORS. Guardar una URL y que su comprobación falle no impide seguir usando la app en Local.

La URL solo se utiliza para las funciones Fearless: comprobar disponibilidad, consultar la serie y sincronizar partidas. La ruleta, el catálogo y la generación de equipos no requieren esta API.

## 7. Datos guardados y límites

- El catálogo de campeones se distribuye con la app. La versión nativa se mantiene en SQLite; el modo web usa un JSON incluido con el frontend.
- Historial, URL de API y preferencia/estado reciente de conexión se guardan en el almacenamiento local del WebView o navegador.
- Las selecciones de un draft sin guardar existen solo en memoria. Si cierras o recargas la app antes de guardar, se pierden.
- La generación de equipos se registra localmente. Solo los drafts Fearless guardados cuando la app está Online se envían a la API.
- No necesitas una cuenta para las funciones descritas aquí.

Si borras los datos locales de la app o del navegador, puedes perder el historial, la URL configurada y el estado de conexión. La base SQLite del catálogo no es la copia del historial.

## 8. Solución de problemas

| Problema | Qué probar |
| --- | --- |
| No aparece el catálogo o las imágenes | Comprueba que la app terminó de cargar. En Equipos, usa **Reintentar catálogo** si aparece el botón. El catálogo incluido no requiere conexión a Fearless. |
| No puedo entrar en Online | Abre Ajustes, revisa que la URL use HTTPS y pulsa Guardar. Consulta el diagnóstico. Comprueba que el servicio esté accesible; en web, revisa CORS en el servidor. |
| La lista del Draft no aparece al estar Online | La app no pudo consultar campeones usados en la API y bloquea las selecciones para evitar continuar con una lista posiblemente incompleta. Pulsa **Reintentar** o cambia a Local desde la cabecera para continuar con el historial que hay en el dispositivo. |
| Un draft aparece como no sincronizado | La copia local se conserva. Vuelve a Online con la API disponible; la app reintentará las partidas pendientes. |
| Un campeón no aparece en Draft | Puede estar ya seleccionado en el draft, usado anteriormente en la serie Fearless, excluido por el filtro de posición o no coincidir con la búsqueda. En Online, prueba **Reintentar** si no carga la lista de usados. |
| No puedo borrar una partida Online | El historial remoto es de solo lectura en la app. Solo se pueden gestionar los registros locales desde esta pantalla. |
| No se puede guardar una partida o resultado | Libera espacio en el dispositivo/navegador e inténtalo otra vez. Los datos locales tienen un límite de almacenamiento. |
