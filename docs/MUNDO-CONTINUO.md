# Mundo continuo

Las pantallas exteriores se juegan como UN bosque: la cámara enseña dos a la vez y el duende pasa
de una a otra sin corte. Por dentro siguen siendo escenas separadas —la unidad de datos, del servidor, del Studio y de las
aventuras que cada una lleva—, y eso no cambia. Decisión del dueño (19-sep-2026): «que el usuario
juega y no sabe que está separado el juego por escenas diferentes… todo lo que sea trabajo para el
browser del usuario dáselo a él».

Estado de publicación: [RELEASE.md](RELEASE.md). Controles: [SHARED-FOREST.md](SHARED-FOREST.md).
Rutas y toques: [NAVIGATION.md](NAVIGATION.md).

## Las piezas

| Pieza | Qué hace |
| --- | --- |
| `world-layout.js` | El **plano**: sitúa cada pantalla exterior en casillas relativas a la de arranque. Sale de las salidas de borde (`navigation.exits`): la vecina queda pegada por ese borde y alineada por el centro de la banda con la coordenada de llegada. Si dos salidas no coinciden o dos pantallas se pisan, lo devuelve como conflicto. También da las **costuras** de una pantalla (una por vecina, con su desplazamiento y sus salidas), el **marco** hasta donde puede mirar la cámara y qué pantallas toca un rectángulo de vista. |
| `model.js` (`World`) | El marco de dos casillas de cada pantalla se **abre en las bandas de las salidas a pie**, después de repartir la vegetación (que respeta el marco cerrado y así no tapa la banda). `terrainWalkable`, `collisionAt` y `waterBeyond` contestan más allá del borde preguntando a la **vecina enlazada** en sus coordenadas; sin vecina en memoria, la banda se da por continuada dos casillas y el resto del borde sigue siendo pared. `link(seams)` lo enlaza el director; `beyond(point)` traduce un punto exterior a la vecina. |
| `river-navigation.js` (`canFloat`) | El margen del casco contra el borde del mapa se salta en el tramo que una salida a remo abre, y el agua de más allá la contesta la vecina o la propia banda. |
| `crossings.js` | El cruce se **dispara pegado al borde** (`SEAM_TRIGGER`, 0,15 casillas, para los dos modos) y no en la zona autorada de hasta tres casillas, que sigue valiendo para el contrato del servidor. La llegada es la geométrica (`crossingArrival`: banda alineada + desvío conservado), la **cámara viaja con el duende** (se traduce, no se recentra), la salida de vuelta queda **cerrada** hasta salir de su banda y no hay aviso al cruzar. Un toque más allá del borde (`aimBeyond`) es un viaje en dos tramos: hasta la costura y, al otro lado, el mismo toque en sus coordenadas. |
| `scenes.js` (director) | Calcula el plano al arrancar y su versión en píxeles (`plane`), guarda los **residentes** de cada pantalla en memoria (siguen viviendo al otro lado), **enlaza** las cacheadas por sus costuras cada vez que la caché cambia —y les pone `origin`, su esquina en el plano—, y precarga primero lo que la cámara está a punto de enseñar (`scenesIntersecting` con margen) y después las vecinas por las que se sale. Por una costura no se espera a la red: la instantánea de lo construido ya se pidió al calentar y se refresca por detrás. |
| `scene-frame.js` | La cámara se acota al **marco del plano** en exteriores (`world.frame`), a la pantalla en interiores o sin plano. La cámara es del duende y no se arrastra (salvo construyendo), y el zoom máximo es el que cubre la pantalla en la que estás: entre las dos cosas, alejar nunca enseña más allá de los mapas. |
| `renderer.js` | Sin recortes por pantalla (dejaban una raya en la costura y partían al duende). Primero el **hueco del plano** (`drawVoid`), luego el suelo de las vecinas enlazadas y el de la tuya, y por último **todas las cosas de todas las pantallas en una sola pasada** ordenada por profundidad, cada una trasladada a tus coordenadas. El arte de los actores se pide una vez para todo lo visible, los de las vecinas incluidos. El terreno se ancla por trozos (`terrain.pin`, `pinVoid`). |
| `ground.js` / `terrain.js` | `paintVoid` pinta lo que no es ninguna pantalla **continuando el borde más cercano**: cada píxel del hueco toma la orilla del píxel de borde de la pantalla más próxima, así que un lago que llega al borde de su mapa sigue siendo lago y un prado sigue siendo prado, con la misma hierba (ruido del plano, semilla común) y sin caminos. `terrain.voidChunk` lo cachea en coordenadas del plano como las demás baldosas. |
| `game.js` | Los residentes de las vecinas pasean en su propio mundo con la cámara traducida (`wander`). Un toque fuera de la pantalla busca la vecina (`world.beyond`) y llama a `crossings.aimBeyond`. `inspect()` expone `seams`, `frame` y `pendingBeyond`. |

## Los datos

Las llegadas de las salidas (`position`) están en el **propio borde de destino** (0,1 casillas dentro).
Antes estaban siete casillas dentro «para no volver a cruzar sin querer»; hoy eso lo hace el
cerrojo. Los centros de banda están alineados entre las dos pantallas de cada costura (la boca del
río de la pradera se ensanchó una casilla para centrarla en 112), y `check-world-layout` lo exige.
El paso medido al cruzar es de unos cuatro píxeles, menos de lo que se anda en un fotograma
corriendo; y si un fotograma lento se salta la banda del disparo, quien ya ha rebasado el borde
dentro de la banda cruza igual (`beyondEdge`), recogido al borde (`ontoEdge`), que es el origen
que el servidor admite.

La **hierba** se pinta con un ruido medido en coordenadas del plano y una semilla común
(`paintGround`, `world.origin`): sin eso, el manchado cambiaba de fase en la costura y se veía
como una raya de otro verde.

El plano actual, en casillas: pradera (0, 0); sauces (64, −144); rápidos (64, −288); raíces
(64, −432); jardín humano (192, −432). Caja: de (0, −432) a (320, 112).

**Para añadir una zona** basta con autorar su escena con una salida de borde hacia una vecina del
plano (y la de vuelta): entra en el plano, en la precarga, en el enlace y en el pintado sin tocar
una línea del motor. `npm test` avisa si el plano no cierra.

## El servidor

El demonio del bosque vivo valida cada cruce con el contrato que viaja dentro de la release
(`tools/live-contract.cjs`): el origen tiene que estar dentro de la zona autorada o de la banda
del borde con su margen, y la llegada tiene que ser exactamente `crossingArrival` o la posición
escrita. Como el disparo fino cae dentro del margen ancho y la llegada es la geométrica, lo que
el cliente hace es lo que el servidor admite, y el contrato se regenera con cada build. Cambiar
las llegadas en los datos sin regenerar el contrato dejaría cruces rechazados: por eso viajan juntos.

## Lo que no hace (todavía)

- **La presencia en vivo es por pantalla.** El demonio manda los vecinos de TU escena, así que
  quien está al otro lado de la costura aparece al cruzar. Con cien asientos para todo el bosque
  es raro coincidir justo en una costura; hacerlo bien pide que el cliente mande una vista por
  pantalla que toca y el demonio conteste por cada una (protocolo privado).
- **Las costuras están pintadas como bordes.** Los márgenes de las pantallas se dibujaron cuando
  eran bordes; ahora se ven pegados. La boca del río de la pradera se arregló con geometría: el
  río de los sauces se abre en abanico hasta el lago en sus últimas filas (`banks` 140→144) y
  las bandas de barca cubren el agua entera; y la pradera y los sauces se pasan a pie por todo el
  borde compartido (`meadow-up` / `meadow-down`). Lo que queda —vegetación que no cruza la
  costura, algún cambio de dibujo— es trabajo de Studio, no del motor.
- **Rutas largas.** Un toque en la vecina va en dos tramos por la costura más cercana; no busca
  camino a través de dos pantallas.

## Verificación

`npm test` incluye `check-world-layout.cjs` (plano, costuras, enrutado, agua, disparo, cámara) y
`check-river-core.cjs` (bordes flotables, llegadas dentro de la banda). En navegador,
`test:world-controls` cruza la costura del río remando con el dedo puesto y comprueba que la barca
sigue al otro lado; `test:river` recorre los muelles y la costura a remo.
