# Navegación por intención

Contrato de entrada y rutas compartido por juego y Studio. Estado de publicación:
[RELEASE.md](RELEASE.md). El comportamiento no depende de una escena concreta.

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

## El río: cuerpos, costuras y precarga (17-sep-2026)

**El río es de todos.** El vecino que rema en su cáscara y el corcho de quien
pesca son cuerpos de colisión, no decorado (`riverBodies` en `river-life.js`).
Se recalculan por fotograma con el MISMO reloj con el que se dibujan, así que el
choque cae donde se ve a alguien. Un cuerpo que ya te envuelve NO te encierra
—si no, llegar justo donde pasa una barca te dejaría sin poder remar— y quien te
alcanza con la barca parada te aparta lo justo (`yieldToRiverBodies`) en vez de
pasarte por encima. Lo que dice quien se lleva el golpe lo declara la escena en
ese cuerpo (`bump`), no el motor.

**Las costuras coinciden con el agua.** Las bandas de salida van dibujadas en
tiles y el casco se planta a `HULL_RADIUS` del borde del mapa, así que quedaba un
carril donde la barca estaba pegada al final del río y no pasaba nada: le
ocurría a las diez salidas de aguas abajo, a las de la izquierda y a la del
islote. `riverExit` pregunta ahora si la barca está PEGADA al borde por un lado
que tiene salida, derivándolo del casco en vez de ensanchar dieciséis
rectángulos a mano. Y `riverArrival` conserva el desvío respecto al centro del
paso: quien cruza pegado a una orilla sigue pegado a esa orilla.

**Las vecinas se calientan solas.** `SceneDirector.prewarm` prepara las
pantallas que tocan a la que estás —puertas y bordes, sacados de los datos—, de
una en una, con el mundo quieto, ordenadas por lo cerca que está la salida hacia
ellas y con un techo (`WARM_SCENES`). El techo no es prudencia abstracta: el
bosque tiene ocho puertas y cada pantalla cuesta megas de textura.
`check-adventure-residents.cjs` mide el peor caso real (cada escena con sus tres
vecinas más caras) y `check-river-core.cjs` barre las dieciséis salidas punto por
punto sobre el borde flotable.

⛔ Y en `SceneDirector.enter` se FIJA antes de retener: `activate()` vacía el
conjunto de calentadas y poda, así que reteniendo antes la poda se lleva lo
recién cargado de la pantalla a la que entras y te quedas sin dibujos. Se veía
como que los clics no hacían nada, porque sin sprite no hay a quién acertarle.
