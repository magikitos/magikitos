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
| `renderer.js` | Sin recortes por pantalla (dejaban una raya en la costura y partían al duende). Se **ancla primero todo lo que el fotograma va a enseñar** (hueco, vecinas y la tuya) y solo después se pinta: primero el **hueco del plano** (`drawVoid`), luego el suelo de las vecinas enlazadas y el de la tuya, y por último **todas las cosas de todas las pantallas en una sola pasada** ordenada por profundidad, cada una trasladada a tus coordenadas. El arte de los actores se pide una vez para todo lo visible, los de las vecinas incluidos. Al final, si el fotograma no ha tenido que construir ninguna baldosa a la vista, se construye **una del anillo de alrededor por adelantado** (`terrain.prefetch`). |
| `ground.js` / `terrain.js` | `paintVoid` pinta lo que no es ninguna pantalla **continuando el borde más cercano**: cada píxel del hueco toma la orilla del píxel de borde de la pantalla más próxima, así que un lago que llega al borde de su mapa sigue siendo lago y un prado sigue siendo prado, con la misma hierba (ruido del plano, semilla común) y sin caminos. `terrain.voidChunk` lo cachea en coordenadas del plano como las demás baldosas. |
| `game.js` | Los residentes de las vecinas pasean en su propio mundo con la cámara traducida (`wander`). Un toque fuera de la pantalla busca la vecina (`world.beyond`) y llama a `crossings.aimBeyond`. `inspect()` expone `seams`, `frame` y `pendingBeyond`. |

## Los trompicones que había (20-sep-2026)

Dos cosas hacían que el bosque diera saltitos al moverse, y ninguna era la animación:

- **Anclar por partes expulsaba lo que aún no estaba anclado.** Cada `terrain.pin` podaba en el
  acto con el presupuesto de lo anclado hasta ese momento, así que con una vecina a la vista
  anclar su suelo tiraba las baldosas de la pantalla que pisas, que se reconstruían en el mismo
  fotograma: unas 240 baldosas de 256×256 por segundo pintadas píxel a píxel, quietos o andando,
  en cuanto asomaba una costura (medido en `.local/polish-review`: el tick pasaba de 1,4 ms a 8 ms
  en un portátil; en un teléfono eso son fotogramas de 30-60 ms). Ahora anclar no expulsa: la poda
  ocurre al insertar, con todo lo visible ya anclado, y el presupuesto lleva holgura para el anillo.
- **Una fila entera de baldosas nuevas entraba de golpe.** Al andar, las cinco o seis baldosas de
  la fila que asoma se construían en el mismo fotograma (hasta 77 ms en portátil). Ahora se pinta
  una por adelantado y por fotograma, del anillo que rodea la vista, cuando el fotograma va suelto.

Y con ellos, tres cosas que hacían «aparecer y desaparecer» al cruzar: la pantalla que dejas pasa
de activa a **caliente en el acto** (sus hojas no quedan sin proteger los ~600 ms hasta la
siguiente precarga), sus **residentes siguen donde estaban** (no se rehacen al entrar), y las hojas
viven en un **ImageBitmap propio** en vez de en la caché del descodificador del navegador, que un
teléfono vacía cuando quiere. Las ondas del agua se calculan una vez por celda (`water.js`).

Y la causa de fondo, encontrada con las capturas del dueño (20-sep-2026, «subo, bajo, subo, bajo…
a veces desaparecen cosas, otras… se queda pillado en la barrera invisible»):

- **La caché de mundos era una LRU pura** con techo de seis, y la pantalla que pisas solo «se
  usaba» al entrar: tras cruzar a los sauces, la pradera —enlazada y a la vista— era lo más viejo
  de la lista, por detrás de las casitas calentadas al pasar junto a sus puertas, y la siguiente
  precarga la tiraba: sus árboles y su casa desaparecían y volvían al rato (`scenes.prepare`).
  Ahora nunca se expulsa la pantalla activa ni una vecina suya por costura, y una vecina caliente
  sin mundo en la caché se vuelve a preparar.
- **El cerrojo de la llegada exigía salir de la banda entera** (3,4 casillas) para volver: quien
  cruzaba y se daba la vuelta al momento empujaba un muro invisible. Basta con andar dos píxeles
  hacia el borde para volver (`Crossings.check`).
- **Dos preparaciones a la vez de la misma pantalla** (la precarga y el viaje) reservaban el arte
  dos veces; ahora el viaje espera a la que ya está en marcha (`SceneDirector.prepare`). Y el
  presupuesto de hojas es de 192 MB en aparatos con cuatro gigas o más.
- El icono de construir ya no se esconde durante el instante del cruce, y la barquita de los
  sauces sigue remando por el lago hasta desvanecerse en vez de cortarse en la costura
  (`river-life.js`, `riverLife[].beyond`).

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

## La rejilla (20-sep-2026)

Decisión del dueño: «el parche de relleno de césped… debe ser parte del mundo, normal caminable y
construible… que todo el mundo sean escenarios del mismo tamaño y encajen como una cuadrícula
perfecta entre ellos, modular». Toda pantalla exterior mide **192 × 144 casillas** y ocupa una
celda exacta del plano; `check-world-layout` lo exige. El plano actual, en casillas: pradera
(0, 0); sauces (0, −144); rápidos (0, −288); raíces (0, −432); jardín humano (192, −432). Caja: de
(0, −432) a (384, 144). Los tres tramos de río se desplazaron 64 casillas a la derecha y crecieron
por el oeste (bosque nuevo, pisable y construible); la pradera creció por el este y el sur, y su
océano pasó a ser **el lago de la pradera**: un río de dos orillas (`rivers`, con `sway`) cerrado por
el este y por el sur, así que fuera del plano solo hay césped y la costura con los sauces encaja
agua con agua y césped con césped a los dos lados del río. El jardín humano creció por el este y el
sur. Las bandas a pie cubren **todo el césped** de cada borde compartido (a la pradera se baja por
el prado del oeste y por la orilla este del lago); si enfrente hay un árbol, `Crossings.travel`
prueba las columnas de al lado antes que el centro de la banda, para no dar un salto. El suelo
nuevo se pobló con la flora autorada de cada pantalla (misma paleta, mismos cuerpos), lejos del
agua, de los caminos, de lo colocado y de los bordes.

Lo que no es ninguna celda sigue pintándose continuando el borde más cercano (`paintVoid`), pero
ya solo queda a la derecha de la pradera, los sauces y los rápidos, donde todos los bordes son
césped: no hay dos bordes distintos que se encuentren en diagonal.

**Para añadir una zona** basta con autorar su escena de 192 × 144 con una salida de borde hacia
una vecina del plano (y la de vuelta): entra en el plano, en la precarga, en el enlace y en el
pintado sin tocar una línea del motor. `npm test` avisa si el plano no cierra o si la celda no
mide lo que debe.

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
  eran bordes; ahora se ven pegados. La boca del río encaja por geometría (el cauce mide 96..128
  en las dos pantallas hasta el borde y el lago se ensancha ya dentro de la pradera) y las bandas
  cubren todo el césped compartido. Lo que queda —vegetación que no cruza la costura, algún cambio de dibujo— es
  trabajo de Studio, no del motor.
- **Rutas largas.** Un toque en la vecina va en dos tramos por la costura más cercana; no busca
  camino a través de dos pantallas.

## Verificación

`npm test` incluye `check-world-layout.cjs` (plano, costuras, enrutado, agua, disparo, cámara) y
`check-river-core.cjs` (bordes flotables, llegadas dentro de la banda). En navegador,
`test:world-controls` cruza la costura del río remando con el dedo puesto y comprueba que la barca
sigue al otro lado; `test:river` recorre los muelles y la costura a remo.
