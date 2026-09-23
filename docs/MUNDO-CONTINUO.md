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
| `renderer.js` | Sin recortes por pantalla (dejaban una raya en la costura y partían al duende). Se **ancla primero todo lo que el fotograma va a enseñar** (hueco, vecinas y la tuya) y solo después se pinta: primero el **hueco del plano** (`drawVoid`), luego el suelo de las vecinas enlazadas y el de la tuya, y por último **todas las cosas de todas las pantallas en una sola pasada** ordenada por profundidad, cada una trasladada a tus coordenadas. El arte de los actores se pide una vez para todo lo visible, los de las vecinas incluidos, y solo en los fotogramas en que toca repasarlo (cada 120 ms, `actorArt.due`), que es cuando se arman las copias trasladadas de las vecinas. Al final, si el fotograma no ha tenido que construir ninguna baldosa a la vista, se construye **una del anillo de alrededor por adelantado** (`terrain.prefetch`). |
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

- **El suelo pisable se rehacía entero en cada llegada** (21-sep-2026, medido en Chrome). Cada
  pantalla tiene 27.648 casillas y cada una pregunta treinta veces si hay agua bajo los pies:
  48 ms de reloj en la pradera, 25 en las raíces, y `riverSection` era el 20 % de toda la CPU de
  un cruce. La caché de mundos no vale en las pantallas donde se construye —cuatro de las cinco de
  fuera—, así que el mundo que la precarga acababa de armar se tiraba y se volvía a armar. Entrar
  a la pradera costaba dos o tres fotogramas perdidos, SIEMPRE. Ahora ese mapa se guarda por
  pantalla (`model.js`, `terrainGrids`) con una clave que son exactamente sus ingredientes —marco,
  bandas de las costuras, contorno del interior y agua—, así que cambiar una orilla lo recalcula y
  que llegue otro duende no. Medido: `new World` de la pradera pasa de 73,6 ms a 6,2, y los diez
  cruces del banco de pruebas pasan de perder dos o tres fotogramas cada vez a no perder ninguno.

- **Y preguntar por el agua estaba mal planteado** (21-sep-2026, decisión del dueño: «preguntar
  siempre si hay agua es un poco raro, hay que hacerlo eficientemente»). En una fila de píxeles el
  agua es siempre lo mismo —el cauce entre dos orillas, las elipses de los charcos, los puentes que
  la tapan— y averiguarlo cuesta una interpolación de Hermite con dos senos por río. Se preguntaba
  punto a punto: treinta sondas por pisada, y la misma fila una y otra vez. Ahora el agua de una
  fila se calcula una vez y se guarda; el pie pregunta por el RECTÁNGULO que ocupa en cada una de
  sus ocho filas en vez de tantear treinta puntos; un tramo recto barre su banda de filas en vez de
  repetirlo en cada paso; y el centro de una casilla no se vuelve a medir, porque `navigationTerrain`
  ya lo tiene contestado (`cellCanStand`). Medido: la máscara de construcción de la pradera pasa de
  704.842 evaluaciones de orilla (240 ms) a 3.384 (82 ms); dos mil pisadas pegadas a la orilla, de
  60.000 a cero; y un toque largo junto al lago, de 114.518 evaluaciones y 193 ms a cero y 34 ms.
  La respuesta es la MISMA: `check-adventure-geography` compara 574.600 puntos y 143.650 pisadas
  contra la versión punto a punto, y ninguna difiere.

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
- **El demonio rechazaba cruces legítimos** (visto en su registro, 20-sep-2026: `cruce rechazado…
  from=[…, 2303.99]`): el cliente recogía el origen a alto−0,01 píxeles y el demonio solo admitía
  hasta alto−1. Quien rebasaba el borde de un paso —andando rápido o con un fotograma lento— veía
  «no hemos podido preparar el viaje». Ahora `ontoEdge` recoge un píxel dentro y el demonio admite
  el borde inclusive (`movement.move`, `transitions.cross`); el motivo del último cruce fallido
  queda en `inspect().crossingError` y el del último precalentado en `inspect().prewarmError`.
- **Lo que no se pudo calentar se apartaba para siempre** hasta cambiar de pantalla: la vecina
  quedaba sin mundo y su hueco se pintaba como relleno (césped sin camino ni árboles). Ahora se
  reintenta a los cinco segundos, y la pantalla que dejas pasa a caliente ANTES de activar la
  nueva, que es cuando se poda el presupuesto.
- **Lo que se ve no se expulsa** (la última causa, medida: cada protagonista pesa 8,3 MB
  descodificado y el arte de los jugadores cercanos entra con prioridad de foco; las hojas de la
  pantalla vecina eran solo «calientes» y eran lo primero que caía con gente alrededor, con
  sesión). `SpriteLibrary` tiene tres niveles: fijo (la pantalla que pisas), **visible** (las
  vecinas que tocan la vista, que la poda no puede tocar) y caliente (las demás vecinas). El arte
  de los actores solo se admite en lo que queda, los más cercanos primero (`actor-art.js`).
- **Ya no hay costas de un solo lado** (`coasts`): el lago es un `rivers` de dos orillas, y ese
  código se retiró de `geometry.js` y `ground.js`.
- **Y un río puede cruzar la pantalla** (23-sep-2026): con `axis: "x"` sus `banks` son
  `[x, orilla norte, orilla sur]` con la misma Hermite monótona. El canal del seto y el brazo de
  las raíces eran un rectángulo recto de esquinas en escuadra y ahora serpentean como los demás.
  Todo el que pregunta por el agua lo hace por `river-course.js` (`riverRowSpans` para una fila,
  `riverShore` para la orilla pintada, `riverBox` para la fase gruesa); la corriente y los que
  reman siguen el primer río que BAJA (`mainChannel`). La costura seto↔raíces vale 70..92 en las
  dos pantallas y la vigila `check-world-polish`, igual que ningún decorado de pie en el agua.
- **La pantalla vecina estaba a medio pintar** (20-sep-2026, repaso): sus baldosas salían bien
  —se pegan en píxeles de pantalla desde la vista traducida— pero lo que se dibuja en coordenadas
  del mundo (puentes, ondas y recortes de interiores) iba sin el desplazamiento de la costura y
  caía una pantalla entera fuera de la vista. Desde la pradera, el río de los sauces se veía
  QUIETO y sin puente hasta pisarlo. `drawGround` recibe ahora `ox, oy` y los traslada;
  `check-adventure-browser` mira el agua de la vecina en dos instantes y exige que se mueva (con
  el código anterior cambian 68 píxeles, con este 390).
- **Lo visible se decidía con la cámara anterior**: al llegar por una costura, el repaso de
  retención corría antes de acotar la cámara nueva, así que el rectángulo de la pantalla vieja se
  leía en el marco de la nueva y señalaba a la vecina contraria. La pantalla que acabas de dejar
  —media pantalla de árboles— se quedaba solo caliente hasta el siguiente pulso de la precarga, y
  con la precarga frenada (diálogo, ahorro de datos, 2G) hasta el siguiente cruce. Ahora
  `retainWarm` corre DESPUÉS de fijar la cámara.

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
- **Tres celdas del plano siguen vacías.** (192, 0), (192, −144) y (192, −288): el rincón que
  deja la L de las cinco pantallas. La cámara llega hasta ahí a propósito —se puede mirar hasta el
  otro extremo del bosque— así que el hueco se pinta continuando el borde más cercano y el mapa se
  lee entero; plantado en el extremo este de la pradera, casi media pantalla es ese hueco: se ve
  como pradera, pero ahí no se entra. Llenarlo es autorar tres pantallas de 192 × 144 con sus
  salidas de borde, y el motor las admite sin tocar una línea; no hay nada que arreglar en el
  código, hay bosque que escribir.

## Verificación

`npm test` incluye `check-world-layout.cjs` (plano, rejilla, costuras, enrutado, agua, disparo,
cámara) y `check-river-core.cjs` (bordes flotables, llegadas dentro de la banda). En navegador,
`test:world-controls` cruza la costura del río remando con el dedo puesto y comprueba que la barca
sigue al otro lado; `test:river` recorre los muelles y la costura a remo.

⛔ **Los cruces se prueban con el demonio de verdad** (`npm run test:live-crossing`,
`check-live-crossing-browser.cjs`, 20-sep-2026). Las suites anteriores iban sin sesión y nunca
pasaban por el bosque vivo, que es quien rechazaba el origen recogido en el borde: tres veces se
dio por arreglado lo que el demonio seguía rechazando. Esta suite levanta el demonio real con el
contrato de la misma build, simula la identidad y el guardado, y un jugador con sesión sube y baja
ocho veces por la costura pradera↔sauces (andando, corriendo y dándose la vuelta al momento)
mientras el demonio tiene que seguirle pantalla a pantalla sin un solo rechazo ni un precalentado
fallido. Con el recogido antiguo (alto−0,01) o la cota antigua del demonio (alto−1) la suite FALLA,
comprobado. Las puertas con demonio las cubre `check-forest-browser.cjs`, y la cota inclusiva del
demonio tiene su prueba unitaria en la web (`check-forest-live.cjs`, «edge inclusive»).
