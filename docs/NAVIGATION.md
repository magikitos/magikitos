# Navegación por intención

Implementación local, septiembre 2026. No cambia mapas, reglas de misiones,
guardados ni la API. No desplegada en esta ronda.

## Contrato de interacción

| Entrada | Comportamiento |
| --- | --- |
| Clic/toque en suelo | Llega al destino esquivando cuerpos. No activa conversaciones, usos de inventario, empujes ni puertas de paso. |
| Clic/toque en objeto o vecino | Se acerca e interactúa únicamente con ese objetivo. Los demás cuerpos se esquivan. |
| Clic/toque en puerta | Se coloca delante y cruza en la dirección de entrada. |
| Clic/toque en objeto empujable | Busca un lado accesible y empuja ese objeto con la física compartida. |
| Movimiento con teclado | Conserva contacto, empuje y umbrales direccionales. |

Ratón, lápiz y dedo generan la misma intención. Caminar, correr y remar no
modifican qué se ha pedido. Cerrar el diálogo no reactiva un recorrido concluido.
La selección visual conserva el margen táctil del objeto; un toque dentro de
ese margen es un toque en objeto, no en suelo.

## Responsabilidades

- `input.js` / `map-gestures.js`: traducen teclado, toque, arrastre, pellizco y dirección continua.
- `journey.js`: único propietario de intención, destino, waypoints, ritmo y
  reintento. Planea `ground`, `interact`, `portal` o `push` con servicios comunes.
  Devuelve una llegada, no abre UI ni ejecuta reglas.
- `navigation.js`: un solo A* para jugador y residentes. Comprueba celdas y tramos
  con la misma geometría de colisión que el movimiento, incluyendo actores vivos.
  La caché de celdas pertenece a cada búsqueda; nunca conserva vecinos obsoletos.
- `model.js` / `collision-grid.js` / `geometry.js`: terreno, cuerpos, pies y consulta
  espacial. El propio actor queda excluido incluso al reconectar desde media celda.
- `movement.js`: subpasos físicos y consumo completo del presupuesto de distancia.
- `locomotion.js`: paseo/carrera; no decide quién habla ni qué se recoge.
- `portals.js` / `movables.js`: aproximación especializada, sin otro pathfinder.
- `game.js`: coordina esas piezas y despacha la llegada deliberada a `interact`.
  Las reacciones siguen en datos y `rules.js`; no hay casos por cartel o personaje.

Se han retirado el estado paralelo `pending`/`rollIntent`, el setter de rutas del
controlador y la comprobación de segmentos de solo terreno que quedó sin uso.
El renderer lee el destino opcional; Studio no necesita fingir un recorrido.

## Obstáculos durante el viaje

Antes de seguir el próximo tramo se comprueba su ocupación actual. Un vecino o
objeto nuevo provoca un desvío. Un choque que aparece dentro de un subpaso también
se detecta: detenerse físicamente no equivale a haber llegado.

Si no queda ruta transitable, se conserva el destino y se espera; se permite como
máximo una búsqueda cada 300 ms mientras dura el bloqueo. Al despejarse, continúa.
No se teletransporta, atraviesa cuerpos ni sustituye silenciosamente el destino.
Un clic nuevo, teclado, arrastre, diálogo o cambio de escena cancela el recorrido
y sus reintentos; no hay timers sueltos ni promesas que puedan resucitarlo.

Un píxel inaccesible de suelo se resuelve al iniciar hacia una celda cercana
alcanzable (la rejilla usa 16 unidades). Ese destino resuelto queda fijo y es el
que muestra el marcador. Un objetivo interactivo que desaparece se cancela; si
se mueve, vuelve a buscarse una aproximación antes de interactuar.

Todo sucede en el navegador. No hay peticiones de rutas, eventos de movimiento
ni cambios de saldo o partida en servidor. La intención es temporal: guardar
conserva posición/estado, no una orden de caminar pendiente.

## Verificación

`npm test` incluye `check-adventure-journeys.cjs`: desvíos estáticos y dinámicos,
bordes de cuerpos, espera y recuperación, objetivo móvil, llegada única, empuje
explícito, cancelación y contacto de teclado. Movimiento a 20/30/60/120 Hz.
`check-adventure-doors.cjs` comprueba además que una ruta incidental no entra y
que el clic deliberado y la entrada manual conservan los umbrales actuales.

`npm run test:journeys` usa Chrome con ratón y táctil a 1440×900, 768×1024 y
390×844. Cambia solo el JSON de escena de una respuesta efímera del navegador:
el motor, entrada, sprites, picking y despacho son los compilados reales. No
añade escena ni API de depuración mutable al juego o al Studio. Comprueba rodear
un cartel y vecino sin hablar, seleccionarlos expresamente, llegar y cerrar sin
reapertura. Capturas y trazas en `.local/journeys-review/`.

Las suites `test:browser` y `test:mobility` cubren también el mundo real, seis
idiomas, siete tamaños, interiores, puertas/escaleras, barco, Studio, zoom,
arrastre y cambios de ritmo. No sustituyen una prueba manual del gusto de juego.

Resultados de publicación: [RELEASE.md](RELEASE.md).
