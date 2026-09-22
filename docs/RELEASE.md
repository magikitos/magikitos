# Estado de entregas

Registro operativo único. El historial de entregas y decisiones descartadas vive
en Git, no en varias guías contradictorias. Distinguir siempre un candidato local
de una activación en producción.

## Candidato local: «Yo», diálogos, muelles y prueba física del Studio — 22 septiembre 2026

Artefacto `ffbc872aa296a92f8867`, instalado en DDEV y con su autoridad local
reiniciada. **No desplegado, no subido a producción.** El puntero del repositorio
web está modificado únicamente para probar esta versión local.

- Cuenta anónima antes del elenco, envío/confirmación en el botón, errores bajo
  el campo y cierre al elegir duende. Sin acceso redundante a «Mi cuenta».
- Diálogos sin botón «Ok» ni columna vacía para carteles. Tocar fuera consume
  ese gesto: no inicia un viaje. Caminar parte de 72 px/s en móvil y aumenta
  suavemente hasta 84 según el lado corto visible (480–960 px CSS); correr sigue a 216.
- Propuesta del Studio aplicada: 19 colocaciones, cuatro retiradas y un camino
  de la escena principal. Aplicada también la revisión 799: entrada del muelle
  `[-1.25,-1,1.4375,1.5]`, fuente, casa de seta, bota, roble y taller con sus
  cajas compuestas. El vecino de la fuente se aparta 1,5 casillas para no nacer
  dentro de su nuevo cuerpo. El Studio quedó sin diferencias ni conflictos.
- Acceso `dock-jetty/planks` editable sobre el muelle, compartido por variante
  y orientado hacia el agua. Se compila en el contrato que valida el servidor;
  ahora incluye superficie caminable normalizada al dibujo y desembarco seguro
  derivado de ella. No admite un destino fuera de las tablas. La aproximación
  admite tablas más estrechas que la cuadrícula sin ensanchar la colisión real.
- Studio: «Probar con duende», recolocación, teclado, toque y arrastre; mismos
  movimiento, navegación, huella y reglas direccionales del juego. Prueba también
  rectángulos aún sin guardar y no escribe partidas ni cambia de escena.
  La caja seleccionada se resalta; contacto rojo, entrada activada amarilla,
  suelo caminable verde. La revisión 793 del dueño sobrevivió al reinicio
  como 794, sin conflictos y con exactamente la misma entrada propuesta.
- Doble clic/toque sobre un elemento abre la edición y encuadra el dibujo y todas
  sus cajas, entrada y superficie caminable. El duende de prueba se mantiene
  centrado al caminar o recolocarlo. Verificado en 1440×1000, 768×1024 y 390×844.
- Corregida la prueba de cuerpos contra el arte: `ink` y `anchor` ya usan píxeles
  lógicos; dividirlos por `pixelRatio` otra vez producía falsos muros invisibles.
  Se conserva la geometría dibujada por el dueño y la prueba rechaza exceso real.
- La aproximación a una puerta acepta una casilla vecina y comprueba el tramo
  preciso final: la barbacoa ya no invalida por redondeo la nueva puerta de Brizno.
- Solo en DDEV: `/bosque` distingue página HTTP y conexión WebSocket; portada
  comprobada con 200 y negociación WebSocket con 101.

Verificado: `npm test` entero, cuenta/diálogos en cuatro tamaños, controles y
teclado en cuatro tamaños, edición/guardado/recarga de muelles en tres tamaños,
68 comprobaciones de transiciones reales y pruebas negativas del servidor.
Prueba física del Studio en tres tamaños, superficies editadas con paridad de
desembarco en servidor y 912 casos reales de marcha / 5.472 cambios de ritmo
con los 18 protagonistas. `npm test` completo y comprobaciones específicas
repetidas tras ajustar la aproximación al muelle estrecho.
`check-release-live` completo contra DDEV: seis rutas, seis portadas, API,
web intacta y juego en escritorio/tablet/móvil, sin escrituras de jugador.
Capturas locales: `.local/self-dialogue-review/`, `.local/probe-review/` y `.local/gait-review/`.

## Producción: el mapa nuevo del dueño, y la accesibilidad deja de mirar una sola pantalla — 22 septiembre 2026

Artefacto `1271c25008e2655db47f`, fuente del juego `542b658`, web `621ed663` (solo puntero).
Anterior conservada: `16680a394ddf68e7cc91`. Mismas rutas.

SHA-256 de `release.json`: `8b2452695a2b60f5519b951064b5d490f2c361020184a380c037aff1d1e7552a`. 817
archivos verificados y ESTACIONADOS antes de mover el puntero. **Sin migración**, **sin PHP nuevo**;
cambia el contrato (medio bosque de sitio) y el demonio arrancó con `release=1271c25008e2655db47f`.
Construido desde un árbol limpio, idéntico byte a byte al del árbol de trabajo.

### Lo que publicó el dueño

Sesión entera de Studio aplicada tal cual: **92 decoraciones retiradas**, **30 colocaciones
movidas** y **entrada dibujada en cuatro casas**. El **almacén** se muda a la orilla ESTE
(171,75 · 36,25), la **casa de hojas** al hueco que deja (103,75 · 103), el **setómetro** arriba del
todo, y **cuatro rocas alineadas en x=146,75** sellan a propósito el paso a pie: a esa orilla se
llega desembarcando río arriba y entrando por la costura de arriba. La decoración del bosque baja
de 232 a 143 piezas.

⛔ **Y ESO ES LO QUE LA VERJA NO SABÍA MIRAR.** `check-adventure` declaró el almacén perdido, y se
equivocaba por partida doble. La cadena de errores, porque las tres veces el dueño tenía razón:

1. Medía «se llega andando desde el `spawn` de ESTA pantalla». A una pantalla se entra también por
   la costura de una vecina y desembarcando en un muelle.
2. Al meter la llegada de las PUERTAS como entrada, el almacén pasó a declararse alcanzable **desde
   su propia puerta**, que es no comprobar nada: la llegada de una puerta es donde apareces al
   SALIR, y para salir has tenido que entrar. Medido: era la única entrada que llegaba.
3. Y el error de fondo: **`exit.position` es dónde aterrizas en la pantalla de DESTINO**, así que
   las salidas de una pantalla describen puntos de OTRA. Mirando las suyas se le atribuían al
   bosque llegadas en el filo de abajo (y=143,9) donde no se puede estar, mientras se le ocultaba
   la que sí tiene: `river-willows/meadow-down-bank` deja en **(160, 0,1)**, arriba en la orilla
   este, y desde ahí se llega al almacén andando. Ahora se recorre el catálogo entero.

Comprobado en negativo: desviando esa costura a la orilla oeste, la prueba vuelve a ponerse roja
nombrando las entradas que probó.

### Dos más, de que la entrada viva ya en el ELEMENTO

- `validatePlacement` juzgaba la entrada contra el cuerpo escrito en la COPIA, y casi ninguna lo
  lleva desde que el cuerpo es del elemento: veía «sin cuerpo, nada que estorbe» y habría aceptado
  una entrada metida dentro de la casa. Ahora pregunta a la familia.
- `renderScene` BORRABA la entrada heredada al mover una copia (`elementBody` solo contesta por las
  propuestas pendientes): mover una casa dos casillas devolvía su puerta ancha a la automática de
  una casilla en la vista previa.

### Y un tercer tope escrito a mano

`check-adventure-doors` exigía `w <= 2` y se puso roja por una puerta de 2,75 perfectamente legal
desde que el ancho subió a 3. Sale de `ENTRANCE_LIMITS`, como los otros dos que ya se corrigieron.
Van tres pruebas con el mismo vicio en dos días: **un límite no se escribe dos veces**.

### Comprobado

`npm test` entero (84 bloques, salida 0) y en producción `check-release-live` en las seis rutas,
más la lectura directa del `adventure-config` servido para el almacén, la casa de hojas, el
setómetro y las rocas.

## Producción: la primera puerta ancha, y una entrada dentro del cuerpo ya no se puede guardar — 22 septiembre 2026

Artefacto `16680a394ddf68e7cc91`, fuente del juego `b201827`, web `575fc41d` (solo puntero).
Anterior conservada: `bbc088623c786bcb5831`. Mismas rutas.

SHA-256 de `release.json`: `12c82d27794faa3d5351b3dc3f597016de0e1d82b4aff1dda19c5f58ccc71893`. 817
archivos verificados y ESTACIONADOS antes de mover el puntero. **Sin migración**, **sin PHP nuevo**;
cambia el contrato (el cuerpo y la entrada del refugio de hojas) y el demonio arrancó con
`release=16680a394ddf68e7cc91`. Construido desde un árbol limpio, idéntico byte a byte al del árbol
de trabajo.

### Alcance publicado

- **La primera puerta del bosque más ancha que una casilla.** `leaf-home/avellano` estrena cuerpo y
  una entrada de **2 casillas** (`umbral [81.5, 85.825, 2, 0.5]`, leído del `adventure-config` que
  sirve producción). Las otras catorce siguen a 1 × 0,375 fuera y 1 × 0,25 dentro.
- **El tope de ancho sube de 2 a 3 casillas.** El de ALTO no se toca: media casilla, porque una
  franja alta rompe la guarda de dirección y el pestillo. El de ancho nunca fue mecánico.
- **Una entrada dentro del cuerpo no abre NUNCA, y ahora se sabe.** El umbral se prueba contra el
  PUNTO del duende, que no entra en un sólido: su huella mide 12×10 px, así que se queda a 6 px por
  los lados y 5 por arriba y abajo. Medido sobre el mundo compilado en la entrada que dibujó el
  dueño: 297 puntos dentro del umbral y **cero** donde pudiera estar. `entranceReachable` engorda
  los cuerpos con la media huella y exige que quede algo pisable —una franja que solape A MEDIAS
  sigue valiendo—, contrastado con el motor en cuatro posiciones (0, 132, 264 y 297 alcanzables).
- **En el Studio se ve antes de guardar**: roja y con su nombre en el mapa, aviso en la barra,
  «Terminar» apagado y el atajo `Enter` cortado. Y «Dibujar entrada» ya no nace roja: la entrada
  sale donde sale la automática, por debajo del cuerpo.

### Tres agujeros que salieron al hacerlo

1. **El control de muros invisibles solo miraba las escenas.** Desde que el cuerpo es del ELEMENTO,
   lo que tapia el bosque entero vive en `elements.json` y no lo veía nadie: la propuesta del dueño
   pedía 8,75 celdas para una lámina de 5,57 y pasó la verja. Extendido a las variantes, con los
   Delimitadores fuera —tapiar más de lo que dibujan es su trabajo—. El cuerpo se recortó a la
   lámina antes de publicarlo.
2. **La paridad PHP/JS de puertas comparaba mal.** Le daba al gemelo la entidad CRUDA, sin la
   variante mezclada; el compilador sí la mezcla. Aguantó mientras ninguna variante tuvo `entrance`:
   con la primera, 82 contra 81,5. Ahora resuelve la apariencia igual que el compilador.
3. **Dos pruebas llevaban el tope escrito a mano** y se pusieron rojas anunciando fallos que no
   existían. Salen de `ENTRANCE_LIMITS`, como el mensaje de error que enseña el Studio.

### Descartado a propósito

El cuerpo propuesto para `log-home/redondo` movía la caja una casilla a la derecha sin cambiar el
ancho: deja 1,28 celdas de cabaña dibujada sin cuerpo y pone 2,16 de muro invisible, en cabaña,
taller y tronco torcido a la vez. Y la entrada de `workshop-door` estaba escrita en la COPIA y
dentro de su propio cuerpo; su entrada automática ya funciona.

### Comprobado

`npm test` entero (84 bloques, salida 0), `npm run test:studio-entrance`, y en producción
`check-release-live` en las seis rutas más la lectura directa del `adventure-config` servido.

## Producción: la bombita vuelve a salir del navegador y cuatro muros invisibles menos — 21 septiembre 2026

Artefacto `bbc088623c786bcb5831`, fuente del juego `61eaa3f`, web `5ff89736` (solo puntero).
Anterior conservada: `8fee2c4f72711c844e46`. Mismas rutas.

SHA-256 de `release.json`: `4927a1636126e63c0ff33f54b5ab5ba2f914e69d0ffa3bc843e9d58a2ec4889f`. 817
archivos verificados y ESTACIONADOS antes de mover el puntero. **Sin migración**, **sin PHP**, pero
**SÍ cambia el contrato**: se van 19 `requires` de las escenas de río y cambian los rectángulos
protegidos y el terreno construible alrededor de cuatro puertas; el demonio arrancó con
`release=bbc088623c786bcb5831`.

⛔ **Construido desde un árbol LIMPIO** (worktree disperso, 188 MB sin los másteres de arte) con
el MISMO id que el árbol de trabajo, comparado además fichero a fichero.

### Alcance publicado

- **La bombita y la tenaza estaban MUERTAS desde que se escribieron.** El servidor las tenía
  implementadas y en el OpenAPI, pero `community-mine` y `community-defuse` faltaban en la lista
  blanca del cliente (`api.js`), que rechaza cualquier punto desconocido antes de tocar la red.
  Como `maintain()` pasa el punto en una VARIABLE, ningún buscador de literales lo vio y el
  jugador solo leía «vuelve a intentarlo», siempre. Comprobado en el paquete servido.
- **Cuatro muros invisibles fuera.** Taberna, taller, casa del pescador y almacén arrastraban un
  cuerpo de cuando su lámina tenía el ancla al borde izquierdo; el arte se reancló al centro y
  ellos se quedaron empujados al este. El del almacén medía 17 celdas para un dibujo de 8,25:
  **56 casillas de suelo libre tapiadas**, medidas con `cellCanStand` antes y después. Los cuatro
  cuerpos nuevos están comprobados en el `adventure-config` que sirve producción.
- **Las tres escenas de río ya no piden barca para estar en ellas**, que atascaba el buzón de
  acciones de quien entraba a pie: 403 en la cabeza de la cola, para siempre. `human-hedge` sí
  sigue pidiéndola, porque a ese jardín solo se llega remando.
- **«Cancelar» dejó de mentir**: con una petición en el diario ya no se ofrece, porque el envío
  sigue vivo y la pieza aparecería igual.
- **Volver con la flecha de atrás vuelve a medir**, abriendo sesión nueva (`vuelta-atras`).
- **Tres puertas nuevas en la verja**: `check-api-contract`, `check-element-bodies` (que compara
  los 665 cuerpos del mundo con la tinta del atlas horneado) y `check-docs-links`.

### Comprobado

`npm test` entero (84 bloques, salida 0). Navegador: `test:browser`, `test:mobility`,
`test:journeys`, `test:world-controls`, `test:warehouse`, `test:river` y `test:studio-entrance`.
Con el demonio de verdad: `test:live-crossing` (ocho cruces seguidos), `test:forest` y
`test:objects`. En producción, `check-release-live` en las seis rutas, más la lectura directa del
`adventure-config` servido para las cuatro puertas y los tres ríos.

⛔ **`test:studio-entrance` cazó un error MÍO** antes de salir: afirmaba que el cuerpo de una
casita se escribe en `element-families.json`, y `build-woodland-kit.cjs` rehace esas 39 familias
arrancando con `variants: []`, así que el siguiente `art:catalog` lo habría borrado en silencio.
Va a `elements.json`. La prueba de la verja ya cubría los dos lados; la de navegador guardaba la
afirmación perdedora.

## Producción: dieciocho melodías más y el peso medido — 21 septiembre 2026

Artefacto `8fee2c4f72711c844e46`, fuente del juego `d4bde92`, web `13b100d0` (solo puntero).
Anterior conservada: `10a99014de5761a7c628`. Mismas rutas.

SHA-256 de `release.json`: `02373564754d82b54d9c250939f9cda8a2d6a27313300a33f97c2fb9b38f19e0`. 817
archivos verificados y ESTACIONADOS antes de mover el puntero. **Sin migración**, **sin PHP**,
**sin cambio de contrato**; el demonio arrancó con `release=8fee2c4f72711c844e46`.

⛔ **Construido desde un árbol LIMPIO** (worktree disperso, 188 MB sin los másteres de arte) con
el MISMO id que el árbol de trabajo.

### Alcance publicado

- **De cuatro pistas a veintidós**, de doce minutos de música a sesenta y siete. Entran por la
  herramienta de siempre: original intacto en `data/audio/originals` con su MD5 por nombre y
  derivado normalizado a −20 LUFS, pico −2 dBTP, estéreo 44,1 kHz a 128 kbit/s. Se importaron
  desde una COPIA de la carpeta de descargas, porque `--import` mueve el fichero de entrada.
- **Al que juega no le cuesta nada**: los dos decks van con `preload="none"` y solo tienen
  cargadas la pista actual y la siguiente, así que entrar con el sonido puesto son dos peticiones
  de audio haya cuatro pistas o cuarenta. Lo que crece es el artefacto: 87 MB, de los que 62 son
  audio y 22 arte.
- **El peso, medido y escrito** en RELEASING.md: el arte ya está en el mínimo (348 de 351
  paquetes en paleta de 256 colores; recomprimir el IDAT ahorra 0,2 %, refiltrar por línea lo deja
  13,9 % MÁS grande, y reordenar el atlas ahorraría un 2 % a cambio de que todo el mundo se
  vuelva a descargar 19 MB). Los «13 MB» de un paquete eran memoria descodificada: en disco son
  808 KB.

### Comprobado

`npm test` entero (82 bloques) y `test:audio` con las veintidós pistas. En producción,
`check-release-live` en las seis rutas y el catálogo servido con las 22 pistas.

## Producción: el agua se pregunta por filas, no punto a punto — 21 septiembre 2026

Artefacto `10a99014de5761a7c628`, fuente del juego `7e9f590`, web `bb9131cc` (solo puntero).
Anterior conservada: `e8c39cd5111788d3b235`. Mismas rutas.

SHA-256 de `release.json`: `c3fb6bdbf96085e5e607d0514e571fa1576ac2937abd7aad8fb1d348e9efd5aa`. 799
archivos verificados y ESTACIONADOS antes de mover el puntero. **Sin migración**, **sin PHP**,
**sin cambio de contrato**; el demonio arrancó con `release=10a99014de5761a7c628`.

⛔ **Construido desde un árbol LIMPIO** con el MISMO id que el árbol de trabajo.

### Alcance publicado

- **El agua de una fila son intervalos.** El cauce entre dos orillas, las elipses de los charcos y
  los puentes que la tapan: averiguarlo cuesta una interpolación de Hermite con dos senos por río,
  preguntarlo después es comparar dos números. Se preguntaba punto a punto, treinta veces por
  pisada y la misma fila una y otra vez.
- **El pie es un rectángulo**, no una nube de treinta sondas, y **un tramo recto barre su banda de
  filas** en vez de repetir la pregunta en cada paso de dos píxeles. Y el centro de una casilla ya
  no se vuelve a medir: `navigationTerrain` lo tiene contestado desde que se construyó la pantalla.
- **Medido**: la máscara de construcción de la pradera pasa de 704.842 evaluaciones de orilla
  (240 ms) a 3.384 (82 ms); dos mil pisadas pegadas a la orilla, de 60.000 a cero; un toque largo
  junto al lago, de 114.518 y 193 ms a cero y 34 ms. La respuesta es la MISMA:
  `check-adventure-geography` compara 574.600 puntos y 143.650 pisadas contra la versión anterior
  y ninguna difiere.

### Dos pruebas que llevaban rotas, y no eran de este cambio

Fallaban igual antes de tocarlo. La de recogidas esperaba una seta cuando la mata da tres desde el
Setómetro: ahora lee la cantidad de la escena y no vuelve a romperse. La de gatos perseguía con las
flechas a pelo y se estrellaba contra una valla colocada en medio, empujando veinticinco segundos:
ahora se le persigue tocando hacia él dentro de lo que se ve, como se juega.

### Comprobado

`npm test` entero (82 bloques). En navegador: regresiones, viajes, controles del mundo, movilidad,
río, cruces con demonio de verdad, gatos, recogidas, seto, picnic, arbolado, Ascua, capítulo y las
cuatro del Studio. En producción, `check-release-live` en las seis rutas y el demonio con la
release nueva.

## Producción: el Studio sin cabecera y los cruces sin fotogramas perdidos — 21 septiembre 2026

Artefacto `e8c39cd5111788d3b235`, fuente del juego `7857c14`, web `80ff3097` (solo puntero).
Anterior conservada: `d1ef0ad5d748e9217e61`. Mismas rutas.

SHA-256 de `release.json`: `b30634a167ab41f372501351cde64036a0993be403f65e6e169f943d190ed587`. 799
archivos verificados y ESTACIONADOS antes de mover el puntero. **Sin migración**, **sin PHP nuevo**
(el compilador del mundo sí cambia), **sin cambio de contrato**; el demonio arrancó con
`release=e8c39cd5111788d3b235`.

⛔ **Construido desde un árbol LIMPIO** con el MISMO id que el árbol de trabajo.

### Alcance publicado

- **Cruzar deja de perder fotogramas.** Cada pantalla tiene 27.648 casillas y cada una pregunta
  treinta veces si hay agua bajo los pies: 48 ms de reloj en la pradera, y `riverSection` era el
  20 % de toda la CPU de un cruce. Ese mapa se rehacía ENTERO en cada llegada, porque la caché de
  mundos no vale en las pantallas donde se construye (cuatro de las cinco de fuera), así que la
  pradera costaba dos o tres fotogramas perdidos SIEMPRE. Ahora se guarda por pantalla con una
  clave que son exactamente sus ingredientes —marco, bandas de las costuras, contorno del interior
  y agua—, así que cambiar una orilla lo recalcula y que llegue otro duende no. Medido en Chrome,
  diez cruces ida y vuelta: sin la caché seis pierden fotogramas (huecos de hasta 50 ms), con ella
  ninguno, todos a 16,8 ms; `new World` de la pradera pasa de 73,6 ms a 6,2.
- **El cuerpo y la entrada de un elemento son del ELEMENTO** (decisión del dueño). Viven en la
  variante de su familia y valen para todas sus copias, las puestas y las que se pongan después.
  El compilador resuelve la variante fijada antes de calcular la puerta, así que PHP y el motor
  leen el mismo cuerpo, y un cuerpo compuesto sustituye al simple en vez de sumarse: llevar los dos
  rompía la escena entera al construirla.

### El Studio (no viaja en la release, es local)

Tres barras arriba pasan a ser una franja; fuera el exportar diff y el bloque de revisión. El
cuerpo y la entrada se dibujan ENCIMA del elemento en el mapa, con el mapa bloqueado mientras se
dibuja, y lo guardado va a su variante, retirando de paso los cuerpos sueltos de cada copia. Los
elementos se arrastran desde la galería hasta el punto exacto donde se sueltan.

### Comprobado

`npm test` entero (82 bloques). En navegador: las cuatro suites del Studio, con la del cuerpo y la
entrada reescrita para el editor nuevo. El control negativo del rendimiento está medido en los dos
sentidos con el mismo banco. En producción, `check-release-live` en las seis rutas y el demonio
arrancado con la release nueva.

## Producción: arboledas 2.5D, setas y balanza — 21 septiembre 2026

Artefacto `7a20d5b13025487467c0`; fuente `528aea9` (implementación `f9c7435`);
smoke endurecido en `3309e93`; web `f2be66ad`. Anterior conservada:
`b0a7d454754724d0785b`, que ya incluía las colocaciones del Studio y la noche
anclada a la hoguera del suroeste.
SHA-256 de `release.json`:
`f49d38a009e53faaba4b900a1e6e5e7d22d12be2b47b4c3cd4fbd02efe0e0f6e`.

- Ocho arboledas de troncos visibles reemplazan las copas cenitales en la galería;
  extremos naturales, cuatro esquinas y cuerpos por silueta. Las ocho rocas no
  cambian. Másteres anteriores conservados; su atlas obsoleto ya no se distribuye.
- Seis grupos de setas (tres especies × pareja/trío), con rendimiento declarado
  por variante. Selección visual compartida entre cliente, Studio y compilador:
  dos/tres visibles entregan dos/tres, tanto localmente como en el servidor.
  Sin cambiar los IDs/bits de recolección ni reiniciar partidas.
- Brocheta: cinco setas, una ramita, navaja y fuego; herramientas reutilizables.
  El almacén sigue trocando setas, no setines. Textos revisados en seis idiomas.
- Balanza del Setómetro junto a la taberna: daily y ranking nativos, paginados,
  sin HTML embebido ni sesiones colaborativas. Tres endpoints JSON documentados
  delegan selección, clasificación y votos a los servicios existentes de la web.
  CSRF, prueba humana y cuotas conservados; par/día validados por servidor.
  Ningún premio o cargo en el saco; sin reintentos automáticos de votos ambiguos.

Comprobado: suite completa `npm test`; receta Ascua en tres tamaños × dos modos de
movimiento; almacén en escritorio/móvil; 16 delimitadores en Studio aislado, tres
tamaños; Setómetro en cinco formatos, errores/cuotas/cierre durante envío/doble clic,
y lecturas reales de DDEV. API local: 182 lecturas y escrituras rechazadas; 47
comprobaciones de autoridad del bosque; adaptador PHP puro sin escrituras reales.
Capturas revisadas en `.local/screenshots/`.

Build reproducible desde worktree limpio `528aea9`, idéntico al de desarrollo.
Release estacionada y verificada antes de publicar el puntero/API juntos por la
pipeline normal de la web. Backup automático conservado; sin migraciones nuevas
ni importaciones en producción. Demonio reiniciado y confirmado con la nueva ID.

En producción: seis HTML/landings/API correctos, tres formatos de caminar/remar,
daily/ranking reales en cinco formatos y seis idiomas, y SHA-256 de los seis
PNG/JSON nuevos comprobados contra CDN. Cero escrituras de jugador en el smoke.

Studio local reiniciado en 47832; workspace 653 sin cambios pendientes/conflictos,
historial preservado. DDEV recuperado aplicando solo la migración existente 4240,
que le faltaba, tras backup local `.local/backups/pre-setometro-20260921.sql.gz`.
Servicio local del bosque operativo. Arte y reconstrucción:
[`forest-market/README.md`](../data/aventura/art/forest-market/README.md).

## Producción: mapa del Studio y noche anclada — 21 septiembre 2026

Artefacto `b0a7d454754724d0785b`, juego `283ee0d`, web `bad9803a`
(solo puntero, sobre `743fdc30`). Anterior conservada: `82a321d87cc9d16beca7`.
SHA-256 de `release.json`: `b8f4eada5c87f677eea561917f53277b7fe080420094a261e047d5031c05147a`.

Aplicada la propuesta del Studio 648: posiciones, caminos, retiradas y 17 altas.
La noche, el corrillo y el área de cuentos siguen `story-fire` sin coordenadas
duplicadas. Patrullas del picnic trasladadas con sus gatos; una bebida movida una
casilla para recuperar su acceso. Delimitadores promovidos al catálogo compartido,
con cuerpos por variante y esquinas huecas. Studio: vecinas, filtro de árboles,
guardado multiescena; propuesta reaplicada mediante rebase, sin conflictos ni borrado
de historial. Los nuevos cambios de arte/Setómetro/setas aún no forman parte de esta entrega.

Suite de unidades completa, retomada tras corregir referencias antiguas de fixtures;
Ascua en tres tamaños y movimiento reducido; 16 variantes de delimitadores probadas
en Studio aislado en tres tamaños; capturas y aproximación a la hoguera. Artefacto
idéntico reconstruido desde el commit limpio con `--reuse-art`. Instalado localmente;
DDEV no estaba escuchando, así que las pruebas locales usaron el preview Node.

Release estacionada y verificada antes de activar; reinicio ordenado únicamente de
`bosque-vivo`. Sin migraciones, importaciones ni cambios de partidas. Smoke público:
seis HTML y assets correctos, seis landings/API, web normal intacta, caminar/remar
en 1440×900, 768×1024 y 390×844; cero escrituras de jugador enviadas. Las inserciones
de seguridad de Cloudflare se validaron por la excepción estricta del smoke.

## Producción: apoyos alternos y encaje paseo/carrera — 21 septiembre 2026

Artefacto `82a321d87cc9d16beca7`, fuente del juego `f7cfe43` (incluye `5d2abf5`),
web `d450e5a6` (**solo puntero**). Anterior conservada: `d1ef0ad5d748e9217e61`.
Las rutas no cambian. Publicación autorizada después de probar la corrección local.

SHA-256 de `release.json`:
`102ee2e7bde3558a077fd57793f28cba5f453d820e11f60e69e4d08b2cc76602`.
791 archivos verificados y estacionados antes de activar. Una copia limpia del
commit, con los atlas registrados y sin los másteres, reconstruye exactamente el
mismo ID mediante `node tools/build.cjs --reuse-art`.

- 216 contactos opuestos en las seis direcciones con componente horizontal de
  los 18 protagonistas; cabeza, gorro y torso originales conservados. Mismo número
  de poses y tamaño de textura, sin procesamiento de imágenes durante el juego.
- Carrera frontal alineada con el paseo en siete hojas, incluida Brezo:
  corrección offline de +0,5 a +2,5 px lógicos, sin mover jugador, sombra o cámara.
- Marcha de 72 a 84 px/s y carrera de 190 a 216 px/s, con zancadas de 44/72 px.
  El contrato cambia únicamente `maxFootSpeed` y el `pushSpeed` derivado.
  `bosque-vivo.service` se detuvo ordenadamente y arrancó con la nueva release
  durante el cambio de puntero (07:45:16 UTC), sin errores de persistencia.
- Sin migraciones, cambios de PHP, modificaciones de partidas, importaciones,
  cambios de mapas ni reinicios de otros servicios. Identidad personal verificada
  en los dos repositorios. El cambio ajeno de `taramundi/cuentos/build-pdf.mjs`
  quedó intacto y fuera de esta entrega.

Comprobado: `npm test` completo, 1.152 muestras de alineación de los atlas
(desvío medio frontal/trasero máximo de 0,875 px lógicos), Ascua en tres tamaños
y ambos modos de movimiento reducido, ocho cruces con el daemon real y cero
rechazos, Studio aislado (caminos, recorte, colisiones, guardado y diff).
Las pruebas específicas previas cubren 912 casos de marcha y 5.472 pasos de cambio
paseo/carrera, más la última comprobación de las variantes 100 y 142 tras el ajuste final.

La suite general de navegador pasó con una espera diagnóstica adicional de 2,5 s
antes de medir la caché, sin modificar el test registrado ni el motor. La espera
original de 400 ms mide a veces la precarga aún en curso: reproducido también con
el JS anterior de producción; ambos terminan y se mantienen en 225 bloques para
844×390. El arranque frío del Studio necesitó ampliar solo en el ejecutor temporal
el plazo a 600 s. Se utilizó Chromium headless instalado (1228). DDEV no estaba
disponible, por lo que no se acredita la suite completa `test:boundary` local.

En producción: seis HTML idénticos byte a byte contra el origen; seis landings,
API pública y web normal correctas; `check-release-live` en 1440×900, 768×1024 y
390×844 (marcha, remada, controles táctiles, desembarco y carga diferida), sin errores
ni escrituras de jugador. Los 72 archivos PNG/JSON de los 36 packs modificados
se comprobaron por SHA-256 a través de la CDN. El daemon anuncia la release nueva.

## Producción: el repaso a fondo — lo que se ve no se expulsa y una herramienta por trabajo — 20 septiembre 2026

Artefacto `d1ef0ad5d748e9217e61`, fuente del juego `071cc70`, web `5c11c7e9` (solo puntero). Anterior conservada:
`e272286c082e930c947b`. Mismas rutas.

SHA-256 de `release.json`: `d67bb26dbdfc0d8c28d748bd29a7fca018c96d6285374eec643487bf9fb96f23`. 791 archivos verificados y ESTACIONADOS antes de mover
el puntero. **Sin migración**, **sin PHP**, **sin cambio de contrato**; el demonio arrancó con
`release=d1ef0ad5d748e9217e61`.

⛔ **Construido desde un árbol LIMPIO** (worktree disperso sin los másteres de arte) con el MISMO
id que el árbol de trabajo.

### Alcance publicado

- **La pantalla vecina estaba a medio pintar**: sus baldosas salían bien, pero lo que se dibuja en
  coordenadas del mundo —puentes, ondas y recortes de interiores— iba sin el desplazamiento de la
  costura y caía una pantalla entera fuera de la vista. Desde la pradera, el río de los sauces se
  veía QUIETO y sin puente hasta pisarlo. `check-adventure-browser` mira ahora el agua de la
  vecina en dos instantes: con el código anterior cambian 68 píxeles, con este 390.
- **Y lo visible se decidía con la cámara anterior**: al llegar por una costura, el repaso de
  retención corría ANTES de acotar la cámara nueva, así que el rectángulo de la pantalla vieja se
  leía en el marco de la nueva y señalaba a la vecina contraria; la pantalla que acabas de dejar
  se quedaba solo caliente hasta el siguiente pulso de la precarga —y con la precarga frenada
  (diálogo, ahorro de datos, 2G) hasta el siguiente cruce. Es la misma avería que los tres niveles
  de retención vinieron a arreglar, escondida un piso más abajo.
- **La última causa de las cosas que desaparecían, medida**: cada protagonista pesa 8,3 MB de
  hojas descodificadas y, con sesión, el arte de los jugadores cercanos entra con prioridad de
  foco. Las hojas de la pantalla vecina eran solo «calientes» y eran lo primero que la poda
  expulsaba cuando el presupuesto se llenaba de gente: mirando la pradera desde los sauces, sus
  árboles y su casa desaparecían y volvían al rato. `SpriteLibrary` tiene tres niveles —fijo (la
  pantalla que pisas), **visible** (las vecinas que tocan la vista, que la poda no puede tocar) y
  caliente—, el director dice en cada pulso de la precarga qué vecinas están a la vista, y el arte
  de los actores solo se admite en lo que queda, los más cercanos primero. Además, «caliente» pasa
  a significar tener las hojas Y el mundo (`SceneDirector.ready`): si la poda se llevaba las hojas,
  la precarga daba la vecina por lista y nadie las volvía a pedir.
- **Un solo pintor de briznas** para las pantallas y para el hueco del plano (`paintTufts`), con
  su prueba en `check-adventure-camera`: mismo grano, agua sin briznas, ni puntas ni flores sobre
  camino o arena. El dibujo es idéntico al anterior, comprobado operación a operación antes de
  sustituir los dos bucles.
- **Un solo pegado de baldosas** (`blitChunks`) para el suelo y el hueco; un solo sitio donde se
  decide el presupuesto (`rebudget`); las copias trasladadas de las cosas de las vecinas solo se
  arman en los fotogramas en que toca repasar el arte (`actorArt.due`), no sesenta veces por
  segundo para tirarlas.
- **Una sola lista de hojas para el que viaja** (`travellerPacks`): quien cruzaba una costura a
  remo podía llegar sin remo y sin barca, porque las dos llegadas pedían cosas distintas.
- **Lo que se perdía sin decirlo**: la subida de la partida se reintenta siempre que se aplaza
  (antes, un cambio hecho durante una obra de la comunidad se quedaba sin subir hasta el siguiente
  cambio); cambiar de cuerpo sin que quepan sus hojas vuelve al anterior y lo dice, con su frase
  en los seis idiomas; lo pendiente de construir se valida al cargarlo; una cola de recuperación
  llena se cuenta en vez de reintentarse cada 30 s; las ondas del agua solo se calculan dentro de
  la propia pantalla.
- **Código muerto fuera**: las costas de un solo lado (`coasts`, `coastX`), dos migraciones de
  guardado que ya no aplican a nadie, `placeBy`, `DRAG_SLOP`, `BUILT`, `sourceEntities`,
  `arrive()`, un `clampCamera` que solo llamaba a `frameCamera` y ocho scripts que no ejecutaba
  nadie (cuatro suites de navegador muertas y cuatro preparadores de arte de una sola vez).
- **Una herramienta por trabajo**: `tools/world.cjs` es la única forma de compilar el mundo (build,
  Studio y veintiuna pruebas); `scripts/browser-studio.cjs` arranca el Studio aislado de las cinco
  suites que lo necesitan; `scripts/browser-live.cjs` es la web simulada de las tres suites con
  demonio de verdad, que se saltan solas si la web privada no está al lado y SOLO por eso.
- **Cinco suites que nadie podía ejecutar**: existían, funcionaban y no las llamaba ningún
  comando. Son `test:forest`, `test:objects`, `test:forest-ddev`, `test:shared-map` y
  `test:art-live`, y cubren lo que ninguna otra cubre: la pila completa con DDEV, los objetos
  compartidos por el WebSocket y el arte real en los seis idiomas.

### Comprobado

`npm test` entero (75 bloques). En navegador contra el bundle local: cruces con demonio de verdad
(`test:live-crossing`), bosque vivo (`test:forest`), objetos compartidos (`test:objects`),
controles del mundo, viajes, regresiones (45 bloques, con el agua de la vecina), movilidad,
diálogo, elenco, zoom, empotrado, capítulo, picnic, seto, arbolado, gatos, recogidas, Ascua, el
almacén y las cuatro del Studio. Veinte cruces seguidos por la costura sin una sola anomalía, con
las hojas clavadas en 49 MB y CERO baldosas repintadas después de las 84 primeras. Fotograma
medido junto a la costura: 1,7 ms de mediana y 5,7 en el percentil 99 sin frenar la CPU; 5,4 y
24,1 con la CPU a un sexto, un solo fotograma por encima de 33 ms en 358.

En producción: `check-release-live` en las seis rutas, `test:art-live` (catálogo y arte reales en
tres tamaños), seis cruces por la costura con la API de verdad sin anomalías ni peticiones
fallidas, el demonio arrancado con la release nueva y su registro sin un solo «cruce rechazado».

## Producción: el cruce que el demonio rechazaba — 20 septiembre 2026

Artefacto `e272286c082e930c947b`, fuente del juego `a2bf30f`, web `ac050b7e` (puntero y el demonio del bosque vivo
admitiendo el borde del mapa). Anterior conservada: `f9266288e12030a7902b`. Mismas rutas.

SHA-256 de `release.json`: `c72d750fe1a38e442179f7c50e0b044110cea6ed37559c681b4733918cf24951`. 791 archivos verificados y ESTACIONADOS antes de mover
el puntero (frente a la anterior cambian `aventura.min.js` y las seis páginas). **Sin migración**,
**con el demonio** (tres cotas de posición pasan a inclusivas) y **sin cambio de contrato** (el
demonio arrancó con `release=e272286c082e930c947b`).

⛔ **Construido desde un árbol LIMPIO** con el MISMO id que el árbol de trabajo. `npm test`
completo y las suites de navegador de cruces, viajes, regresiones, zoom y río.

### Alcance publicado

- **El rechazo del demonio, cazado en su registro** (la línea que la release anterior empezó a
  escribir): `cruce rechazado: edge/meadow-down… from=[…, 2303.99]`. El cliente recogía el origen
  del cruce a alto−0,01 píxeles (`ontoEdge`) y el demonio solo admitía hasta alto−1
  (`movement.move`), así que quien rebasaba el borde de un paso —andando rápido o con un
  fotograma lento— veía «no hemos podido preparar el viaje». El cliente recoge ahora un píxel
  dentro y el demonio admite el borde inclusive, también para los clientes que aún no han
  recargado. El motivo del último cruce fallido queda en `inspect().crossingError`.
- **La vecina sin mundo**: un precalentado que fallaba (red, presupuesto) apartaba la pantalla
  hasta cambiar de pantalla, y su hueco se pintaba como relleno, césped sin camino ni árboles
  (captura del dueño). Se reintenta a los cinco segundos y el motivo queda en
  `inspect().prewarmError`.
- **La pantalla que dejas pasa a caliente en el mismo gesto de activar la nueva**
  (`SpriteLibrary.activate(ids, warm)`), que es cuando se poda el presupuesto: antes, en ese
  instante, sus hojas no eran ni fijas ni calientes. Y el presupuesto de hojas es de 128 MB cuando
  el navegador no dice cuánta memoria hay (Safari), 192 MB con cuatro gigas o más y 96 MB con menos.

- **La prueba que faltaba**: `npm run test:live-crossing` (`check-live-crossing-browser.cjs`)
  levanta el demonio real con el contrato de esta misma build, simula identidad, guardado y
  ticket, y un jugador CON SESIÓN sube y baja ocho veces por la costura pradera↔sauces (andando,
  corriendo y dándose la vuelta al momento) mientras el demonio le sigue pantalla a pantalla sin
  un rechazo ni un precalentado fallido. Con el recogido antiguo o la cota antigua del demonio la
  suite falla (comprobado a propósito antes de publicar). Las tres releases anteriores se dieron
  por buenas con suites sin sesión, que nunca pasaban por el demonio.

### Comprobado

`npm test` entero (74 bloques); en navegador contra el bundle local: controles del mundo, viajes,
regresiones, zoom, río, la suite nueva de cruces con demonio y la de bosque vivo (puertas, notas,
plazas); en la web, `check-forest-live` (cota inclusiva), `-negative` y `-load`. En producción:
`check-release-live` en las seis rutas, el demonio con la release nueva, seis cruces anónimos sin
anomalías y cero «cruce rechazado» en el registro del demonio tras el despliegue.

## Producción: la rejilla perfecta, el lago de la pradera y los cruces que no se pillan — 20 septiembre 2026

Artefacto `f9266288e12030a7902b`, fuente del juego `91f3fdf`, web `853f33e3` (puntero y el demonio del bosque vivo
anotando los cruces que rechaza). Anterior conservada: `c6ce1261cff94ca1f0ce` (los pasos legibles del elenco, del otro agente, que esta
release incluye). Mismas rutas.

SHA-256 de `release.json`: `b20701fac5dd414934f9a791b17a947ad5e407bac357b50b9be45a94a8638c92`. 791 archivos verificados y ESTACIONADOS antes de mover
el puntero (frente a la anterior cambian `aventura.min.js`, `game-contract.json` y las seis páginas;
el arte no se toca). **Sin migración** (las zonas de río no tenían nada construido: el
desplazamiento de 64 casillas no toca ninguna fila; lo construido en la pradera conserva sus
coordenadas), **con PHP mínimo** (una línea de registro en `bosque-vivo/presence.cjs`) y **con
contrato del bosque vivo** (pantallas, bandas y máscaras nuevas; el demonio arrancó con
`release=f9266288e12030a7902b`). Las posiciones guardadas dentro de un tramo de río caen al punto de aparición
de la pantalla la primera vez, como cualquier llegada que no se puede pisar.

⛔ **Construido desde un árbol LIMPIO** con el MISMO id que el árbol de trabajo. `npm test` completo
y las suites de navegador (veintiuna, sin DDEV).

### Alcance publicado

- **La rejilla** ([MUNDO-CONTINUO.md](MUNDO-CONTINUO.md), «La rejilla»; decisión del dueño: «que
  todo el mundo sean escenarios del mismo tamaño y encajen como una cuadrícula perfecta entre
  ellos, modular»): las cinco pantallas exteriores miden 192 × 144 y ocupan celdas exactas
  (pradera 0,0; sauces 0,−144; rápidos 0,−288; raíces 0,−432; jardín 192,−432). Los tramos de río
  se desplazaron 64 casillas a la derecha y crecieron por el oeste; la pradera creció por el este
  y el sur; el jardín por el este y el sur. El suelo nuevo lleva la flora autorada de cada
  pantalla, lejos del agua, los caminos, lo colocado y los bordes, y es pisable y construible.
  `check-world-layout` exige la celda entera y la posición exacta.
- **El lago de la pradera**: el océano de un solo lado pasa a ser un lago de dos orillas (`rivers`,
  con `sway`) cerrado por el este y por el sur; el cauce de los sauces llega recto (96..128) y el
  lago se ensancha ya dentro de la pradera. Fuera del plano solo queda césped, así que no hay
  dos bordes distintos que se encuentren en diagonal (la «línea recta sin orilla» de la derecha).
  El vaivén de la orilla muere en el propio borde para encajar píxel a píxel con los sauces.
- **Las bandas de paso cubren todo el césped** de cada borde compartido, a los dos lados del río
  (a la pradera se baja también por la orilla este del lago); si enfrente hay un árbol, se aparece
  un paso al lado dentro de la banda antes que en el centro (el «se desplaza a la derecha»).
- **Los cruces que se pillaban** (capturas del dueño): la caché de mundos era una LRU pura y, tras
  cruzar a los sauces, tiraba la pradera —a la vista— por detrás de las casitas calentadas: sus
  árboles y su casa desaparecían y volvían. Ahora nunca se expulsa la pantalla activa ni sus
  vecinas por costura, y una vecina caliente sin mundo se vuelve a preparar. El cerrojo de la
  llegada exigía salir de la banda entera para volver (la «barrera invisible»): basta con andar
  dos píxeles hacia el borde. El viaje reutiliza la preparación que la precarga ya tiene en marcha
  en vez de reservar el arte dos veces, y el presupuesto de hojas es de 192 MB en aparatos con
  cuatro gigas o más. Medido en local: 16 cruces seguidos arriba-abajo sin una anomalía.
- **Detalles del cruce**: el icono de construir ya no parpadea al cambiar de pantalla, y la
  barquita de los sauces sigue remando por el lago y se desvanece en vez de cortarse en la
  costura (`riverLife[].beyond`, opacidad).
- **El demonio anota los cruces que rechaza** (kind, id, pantalla, origen y llegada), para que un
  «no hemos podido preparar el viaje» tenga rastro en `journalctl -u bosque-vivo`.

### Comprobado

`npm test` entero (con la rejilla y el lago en `check-world-layout`, `check-adventure-geography`,
`check-river-core` y `check-world-polish`). En navegador contra el bundle local: controles del
mundo, movilidad, viajes, regresiones, diálogo, elenco, zoom, empotrado, río, capítulo, picnic,
seto, bosque, gatos, recogibles, Ascua, almacén y Studio (caminos, selección, galería, entradas).
En producción: `check-release-live` en las seis rutas y el demonio con la release nueva.

## Producción: pasos legibles y una fase común para todo el elenco — 20 septiembre 2026

Artefacto `c6ce1261cff94ca1f0ce`, fuente del juego `4998d12`, web `d57e54a8`
(solo puntero). Anterior conservada: `8a3ae0eab255158cede5`.
SHA-256 de `release.json`:
`3f035ffde3cbdad3520e0ff43c2824c59015843119653ec882e7fbbe1413925c`.

791 archivos verificados y estacionados antes de activar por fast-forward guardado.
Construcción desde un checkout limpio del commit publicado, con `--reuse-art`:
mismo ID y mismo inventario que el candidato probado. Solo cambian el JS y las seis
páginas; **ningún sprite, mapa, CSS, audio, API, guardado ni contrato del servidor**.
Sin migración ni reinicio del bosque vivo: el contrato tiene el mismo hash y el
servicio permanece activo. Identidad personal `alvarofranz` en ambos repositorios.

### Corrección

- Paseo y carrera conservan sus velocidades (72/190 px/s) pero dejan leer las
  piernas: 7,2/11,875 cambios de pose por segundo, antes 10,3/21,1.
- Fase continua basada en distancia realmente recorrida: no cambia arbitrariamente
  de pierna al pulsar Espacio, girar o pasar por un nodo de una ruta. Sin rebotes
  artificiales, retoques de anclas ni imágenes nuevas; chocar sin avanzar no anima.
- Los jugadores remotos usan el mismo ciclo, no un reloj de carrera independiente.
  Durante la carga de su hoja de correr se usa el paso equivalente de su propio
  paseo; no se deslizan con el sprite quieto. Una conexión detenida no los deja
  corriendo indefinidamente sobre el sitio.
- Movimiento reducido mantiene apagada la ambientación, pero ya no limita a 12 FPS
  el pintado del protagonista cuando se desplaza: antes se perdían fases de piernas.

Contrato de animación y cómo probarlo: [Duendes](art-direction/DUENDES.md#andar-y-correr-reproducción-común-21-sep-2026).

### Verificación

`npm test` completo. `test:gait`: 18 protagonistas × ocho direcciones × dos marchas
en tres tamaños, más movimiento reducido: **912 casos / 32.832 pintados**, con las
poses solicitadas realmente disponibles (sin fallback quieto). Pruebas puras a
20/30/60/120/144 FPS, diagonales, colisiones, paradas, cambios de marcha, rutas y
paridad con jugadores interpolados.

Suites de navegador: movilidad, viajes, controles, selector, diálogos, gatos,
Ascua/cocina/hallazgos, río, empotrado, frontera web/API y regresiones completas
incluido Studio. La primera ejecución de regresiones agotó el plazo de horneado
offline del Studio; repetida sin la carga paralela pasó **sin modificar el test ni
su plazo**. DDEV sirve el artefacto y sus seis páginas exactas.

En producción: prueba previa del artefacto estacionado (andar/correr), bytes exactos
de las seis rutas en origen y `check-release-live` completo en el dominio público
(landings, API, web, assets, paseo, remo y desembarque a 1440/768/390). Todas las
escrituras bloqueadas en las pruebas públicas; ninguna partida alterada. Evidencia
local en `.local/gait-review/` y `.local/production-controls/`.

## Producción: el bosque anda suelto, la orilla es orilla y las entradas se dibujan — 20 septiembre 2026

Artefacto `8a3ae0eab255158cede5`, fuente del juego `5898874`, web `771318a8` (puntero y documentación de la API).
Anterior conservada: `2fc664357039f59ed6f5`. Mismas rutas.

SHA-256 de `release.json`: `7f7ca61d7620c7529d709b0a0bca58b44e85b9e5395b3395d43cb3f2e23825d3`. 791 archivos verificados y ESTACIONADOS antes de mover
el puntero (frente a la anterior cambian `aventura.min.js`, `game-contract.json` y las seis
páginas; el arte no se toca). **Sin migración**, **sin PHP de juego** (la web solo cambia el
puntero y `docs/WORLD-API.md`), **con contrato del bosque vivo** (la máscara de suelo seco se
recompila con la costa nueva; el demonio arrancó con `release=8a3ae0eab255158cede5`).

⛔ **Construido desde un árbol LIMPIO** (`git worktree` sobre `5898874`, `node tools/build.cjs
--reuse-art`) con el MISMO id que el árbol de trabajo. `npm test` completo (con dos comprobaciones
nuevas, `check-door-geometry` y la del Studio ampliada) y las suites de navegador.

### Alcance publicado

- **Los sacos no se regalan** (decisión del dueño: «esa idea es una estupidez»): fuera el saco
  del día, su temporizador `gravelDaily` y sus textos. La gravilla solo sale del trueque de cinco
  setas con Cebolino; `check-bomb-balance` lo exige.
- **Cebolino a la vista**: atiende junto al extremo del mostrador, no detrás, y fuera de la
  regadera hay un cartel (`warehouse-sign`) que dice quién vive dentro y qué cambia. La suite
  `test:warehouse` comprueba que sus píxeles están en pantalla al entrar.
- **Los trompicones** ([MUNDO-CONTINUO.md](MUNDO-CONTINUO.md), «Los trompicones que había»):
  con una costura a la vista, anclar el suelo por partes expulsaba las baldosas de la pantalla
  que pisas y las reconstruía en el mismo fotograma (unas 240 baldosas de 256×256 por segundo,
  medidas: el tick pasaba de 1,4 a 8 ms en portátil). Ahora se ancla todo lo visible antes de
  pintar, la poda ocurre al insertar y hay holgura para un anillo; y las baldosas nuevas entran
  de una en una y por adelantado (`terrain.prefetch`) en vez de una fila entera en un fotograma
  (77 ms medidos). Las ondas del agua se calculan una vez por celda. Medido después: 0 baldosas
  rehechas junto a la costura, tick máximo 5-6 ms, ningún fotograma por encima de 16 ms.
- **Nada aparece ni desaparece al cruzar**: la pantalla que dejas pasa de activa a caliente en el
  acto (sus hojas no quedaban protegidas durante los ~600 ms hasta la siguiente precarga), sus
  residentes siguen donde estaban en vez de rehacerse, y las hojas viven en un `ImageBitmap`
  propio en lugar de en la caché del descodificador del navegador, que un teléfono vacía cuando
  quiere.
- **La orilla del océano** es una curva de Hermite monótona como las de los ríos (antes, tramos
  en S con la tangente vertical en cada punto: la «diagonal cortante»), con un vaivén de un
  tercio de casilla que se apaga en los extremos para que la boca del río encaje en la costura,
  y la banda de orilla se mide perpendicular a la costa: el mismo grosor de arena y borde que
  en los ríos. Física, pintura y máscara del servidor leen la misma función (`coastX`).
- **Las entradas se dibujan en el Studio** ([README del Studio](../tools/adventure-studio/README.md#cuerpo-y-entrada-de-un-elemento-21-sep-2026)):
  una puerta lleva una sección «Entrada» con la franja que la abre, relativa al pie (ΔX, ΔY,
  ancho, alto), editable a mano o arrastrando la franja azul del mapa, con deshacer, guardado y
  propuesta. Se guarda como `entrance` en la escena y `adventureDoorGeometry` (PHP) la convierte
  en el mismo umbral y llegada de siempre; gemelo `doorGeometry` en JS con prueba de paridad.
  Ninguna escena lleva todavía una entrada dibujada: eso lo decide el dueño en el Studio.
- **Prueba del picnic** independiente del reloj: las setas rebrotan por ventanas de ocho horas
  del reloj (`floor(now / renewMs)`, igual en el servidor), y la prueba fallaba tres horas de cada
  ocho.

### Comprobado

`npm test` entero. En navegador contra el bundle local: almacén, controles del mundo, movilidad,
viajes, regresiones, diálogo, elenco, zoom, empotrado, río, Studio (caminos, selección, galería y
la entrada nueva). Medidas de rendimiento y capturas en `.local/polish-review` (fuera de git). En
producción, `check-release-live` en las seis rutas y el demonio con la release nueva.

## Producción: el bosque se mantiene solo, el almacén del constructor y los 18 protagonistas — 19 septiembre 2026

Artefacto `2fc664357039f59ed6f5`, fuente del juego `e0106f4` (incluye la rama `cast-release-20260919`,
`14f31d1`, fusionada en `74708f7`), web `5a2988d6` (migración 4240 y su lista blanca local) y
`8f3b453b` (PHP, demonio, cron, landing, textos y puntero). Anterior conservada:
`31131f69d88aff7ca904`. Mismas seis rutas de juego debajo de /bosque y sus traducciones.

SHA-256 de `release.json`:
`028fe696bf791e85ad2d5ea0b4f0aca7bf7261863a6e9d3364f18496ffa63def`.
791 archivos verificados y ESTACIONADOS antes de mover el puntero (frente a la anterior: 184
nuevos, 2 retirados, 9 cambiados: `aventura.min.js`, `manifest.json`, `game-contract.json` y las
seis páginas). **Con migración** (`4240_el_bosque_se_mantiene_solo.sql`: `mined_by`, `mined_at`,
`explodes_at`, `steps_json` en los objetos comunitarios, `clock` de presencia por zona y el aviso
`forest_bomb`; aplicada por el panel ANTES del PHP que la lee, copia automática en
`/var/backups/migrations/magikitos/20260919T182547Z__4240_el_bosque_se_mantiene_solo.sql.gz`),
**con PHP** (dos endpoints nuevos, `community-mine` y `community-defuse`; el snapshot devuelve
`clock` y el desgaste por tramo) y **con contrato del bosque vivo** (el demonio arrancó con
`release=2fc664357039f59ed6f5; sharedProps=3` y aprendió los mandos `clock` y `steps`). Dos redes
de seguridad nuevas en el cron de cada minuto, `Bosque (bombitas)` y `Bosque (hierba)`, que solo
escriben cuando recogen algo o fallan.

⛔ **Construido desde un árbol LIMPIO** (`git worktree` sobre `e0106f4`, `node tools/build.cjs
--reuse-art`) con el MISMO id que el árbol de trabajo. `npm test` completo sobre esa misma build
(en el árbol de trabajo, por bloques), con cuatro comprobaciones nuevas: `check-construction-density`,
`check-forest-overgrowth`, `check-forest-bomb` (gemelo JS/PHP con mutación negativa) y
`check-bomb-balance` (solo setas, bomba > alicates, saco = paquete, 8 h).

### Alcance publicado

- **El bosque se mantiene solo** ([AUTOMANTENIMIENTO.md](AUTOMANTENIMIENTO.md)): el precio de
  caminos y vallas se dobla por cada 2 % de la zona ya construido (`densityDoubling`, gemelos
  JS/PHP con la misma redondez), la bombita con nota se pega a un objeto ajeno y estalla a las
  cinco horas con aviso a los treinta minutos, los alicates la desactivan, y la hierba se come
  por los extremos los tramos de camino que nadie pisa en 720 minutos de reloj de presencia (el
  reloj solo corre con alguien en la zona). Herencia y accesos protegidos no se bombardean.
- **El almacén del constructor**: Cebolino (residente 111) vive en la regadera junto al lago del
  rincón nocturno del primer bosque (`overworld` 104,105). Dentro, una habitación dibujada
  (`interior.artwork`) con mostrador, estantería y sacos. Cambia cinco setas por un saco de
  gravilla (diez celdas de camino), seis por una bombita y dos por los alicates, y regala un saco
  abierto cada 24 horas de servidor. Las setas vuelven a salir en el mismo sitio a las 8 horas.
  Los setines siguen siendo reputación, nunca moneda. Los caminos se pagan en gravilla y las
  vallas en palitos; nadie regala gravilla fuera del almacén.
- **Los 18 protagonistas** del otro agente (`cast-release-20260919`): elenco jugable completo con
  sus packs, retratos y la guía [art-direction/DUENDES.md](art-direction/DUENDES.md).
- **La web**: la landing /bosque estrena la sección «El bosque se cuida solo» en seis idiomas
  con el CSS de la casa (sin reglas nuevas), el aviso `forest_bomb` llega a la campana y al
  correo, y `mined_by` entra en la lista de columnas de usuario (se anula al borrar y se
  reasigna al fusionar cuentas).
- **Limpieza**: fuera los planes viejos (`FINAL-UPGRADE.md`, `ART-DUENDES.md`, `ART-PROMPTS.md`,
  `PICNIC-POLISH.md`, `GAME-SAVE-API.md`, `REPOSITORY-BOUNDARY.md`, los README de entregas de
  arte ya integradas y el `FINAL.md` de este mismo plan) y seis scripts de revisión de un solo
  uso. Lo vigente vive en el índice del README, [SHARED-FOREST.md](SHARED-FOREST.md),
  [API.md](API.md), [RELEASING.md](RELEASING.md) y [ART.md](../data/aventura/ART.md).

### Comprobado

`npm test` entero sobre la build publicada. En navegador contra el bundle local: almacén
(`test:warehouse`, nuevo: entrar, hablar, los tres cambios y el saco diario), controles del
mundo, movilidad, viajes, regresiones, diálogo, bosque compartido, elenco, zoom, empotrado y río.
En producción: `check-release-live` (17 bloques: seis rutas, seis landings y tres anchuras), el
demonio del bosque vivo con la release nueva, `GET /api/world/community?zone=overworld` con
`clock`, la landing con el texto del almacén y la gravilla, y los packs, textos y contrato del
almacén servidos bajo `/game/releases/2fc664357039f59ed6f5/`. **Pendiente conocido**:
`scripts/check-community-maintenance.php` (web) es una prueba de la base de datos local y
requiere DDEV, así que se escribió pero no se ejecutó; la migración se verificó directamente
en producción con su copia previa.

## Producción: el juego se llama /bosque, la costura no salta y el dedo solo anda — 19 septiembre 2026

Artefacto `31131f69d88aff7ca904`, fuente del juego `5443a67`, web `285faa4d` (landing y puntero) y
`99aaa47f` (el WebSocket del bosque vivo al `.htaccess`). Anterior conservada:
`29497b332ec03fcadcc2`. Rutas: /bosque/explorar y cinco traducciones (`/en/forest/explore`,
`/de/wald/erkunden`, `/fr/foret/explorer`, `/it/bosco/esplora`, `/pt/floresta/explorar`), debajo
de la landing /bosque y sus traducciones.

SHA-256 de `release.json`:
`a37c13abf38a5c96968214e0db44695292f66446f9464b4ab7ec416bdeaee2d9`.
609 archivos verificados y ESTACIONADOS antes de mover el puntero. Frente a la anterior cambian
`aventura.min.js`, `game-contract.json` y las seis páginas. **Sin migración**, **con PHP** (la web
estrena la landing y las rutas nuevas, así que va por el despliegue normal de la web) y con
contrato del bosque vivo (mismas llegadas; el demonio arrancó con `release=31131f69d88aff7ca904`).

⛔ **El artefacto se construyó desde un árbol LIMPIO** (`git worktree` sobre `5443a67`, con
`node tools/build.cjs --reuse-art`, que es lo único que un clon puede hacer: las carpetas
`review/` del arte van fuera de git) y dio el MISMO id que el árbol de trabajo: el build es
determinista. Las comprobaciones de Node se pasaron en el árbol de trabajo (66 bloques, con
`check-world-layout`, `check-river-core` y `check-world-polish` adaptados); en el árbol limpio
fallan solo las seis que buscan `../magikitos` al lado.

### Alcance publicado

- **Mundo continuo pulido** ([MUNDO-CONTINUO.md](MUNDO-CONTINUO.md)): al cruzar, el duende se
  recoloca en el punto exacto del bosque (`settle`); sin recortes por pantalla ni raya en la
  unión; el hueco del plano se pinta continuando el borde más cercano; el río de los sauces se
  abre en abanico hasta el lago y la pradera y los sauces se pasan a pie por todo el borde. Paso
  medido al cruzar: 3,2 px (un fotograma andando), cámara 4,3 px.
- **La cámara es del duende**: dos dedos y la rueda solo hacen zoom (anclado al centro de la
  vista si hay un viaje tocado en marcha), el arrastre queda para construir, el zoom máximo
  nunca enseña más allá de los mapas.
- **El joystick invisible solo anda** (correr es Espacio o el toque lejano), pinta una porción
  casi transparente hacia donde manda y es más tenue en conjunto.
- **La web**: `/aventura` pasa a `/bosque` sin redirección (decisión del dueño). `/bosque` y sus
  traducciones son una landing real de la casa (qué es, cómo se juega, tu duende y tu partida,
  captura real de la pradera) con «Explorar el bosque»; el iframe y su módulo solo existen ahí;
  la habitación del menú vuelve a navegar. `compile-assets.sh` admite `SIN_BASE_DE_DATOS=1`.
- **Incidente y arreglo en el mismo despliegue**: el vhost llevaba `ProxyPass /bosque` (a mano
  en `httpd.conf`) para el WebSocket del bosque vivo, así que `/bosque` y `/bosque/explorar` en
  castellano contestaban `{}` con 404 durante unos minutos. La regla vive ahora en el `.htaccess`
  del proyecto, en la ruta exacta y solo con `Upgrade: websocket`; las líneas del vhost se
  quitaron (copia en `/root/httpd.conf.bak-20260919-bosque`). Comprobado: landing 200, juego 200,
  `101 Switching Protocols` a través de Cloudflare.

### Comprobado

`npm test` entero. En navegador contra el bundle local: controles del mundo (1440/768/390/844,
con la costura del río a remo y el pellizco que no arrastra), movilidad, viajes, regresiones (44
bloques, seis rutas), diálogo, bosque compartido, elenco, zoom, empotrado y río. En producción,
`check-release-live` en las seis rutas, las seis landings enlazando su juego y tres anchuras
(17 bloques), y el demonio del bosque vivo activo con la release nueva.

## Producción: el bosque exterior es uno (mundo continuo) — 19 septiembre 2026

Artefacto `29497b332ec03fcadcc2`, fuente del juego `db986cdc9cd9e86a1df4585debe588262f2c6062`,
web `843691a7`. Anterior conservada: `3a3ab5c30627e39142e4`. Rutas: /aventura y
cinco traducciones.

SHA-256 de `release.json`:
`91bbb3b716bda226346a8ea34cd92bd0201479fb340973bcc896e6d7ef9cdfcf`.
610 archivos verificados y ESTACIONADOS antes de mover el puntero (instalador en un solo
fichero Node, ejecutado como `magikitos` desde `/tmp`, temporal borrado después). Frente a la
anterior cambian `aventura.min.js`, `game-contract.json` y las seis páginas. **Sin migración y
sin PHP**, pero **con contrato del bosque vivo**: las llegadas de los cruces están ahora en el
propio borde y el demonio, que relee el contrato del artefacto al reiniciarse con el despliegue,
arrancó con `release=29497b332ec03fcadcc2`.

### Alcance publicado

- **Mundo continuo** ([MUNDO-CONTINUO.md](MUNDO-CONTINUO.md)): las pantallas exteriores se
  colocan en un plano derivado de sus salidas; la vecina se pinta al lado antes de pisarla, con
  sus residentes paseando; el cruce se dispara pegado al borde, llega al mismo punto del bosque
  (cuatro píxeles de paso medidos), traduce la cámara en vez de recentrarla, cierra la salida de
  vuelta y no avisa; dos dedos llevan la cámara hasta el otro extremo; un toque en la pantalla
  vecina es un viaje en dos tramos. La hierba se pinta con un ruido continuo por el plano.
- **Datos**: las dieciséis llegadas de borde pasan a 0,1 casillas del borde de destino; la banda
  de la boca del río de la pradera se centra en 112. El plano: pradera (0,0), sauces (64,−144),
  rápidos (64,−288), raíces (64,−432), jardín humano (192,−432).
- **Límites declarados**: la presencia en vivo sigue siendo por pantalla (quien está al otro
  lado aparece al cruzar); los márgenes de las pantallas se dibujaron como bordes y donde las
  anchuras no coinciden se ve un cambio de dibujo, que es trabajo de Studio.

### Comprobado

`npm test` entero (66 bloques) con `check-world-layout` nuevo y `check-river-core` adaptado. En
navegador contra el bundle local a 1440/768/390/844: controles del mundo (la barca cruza la
costura con el dedo puesto), río, viajes, movilidad, regresiones, diálogo, bosque compartido,
elenco, zoom y la frontera de cuenta. Un cruce a pie medido fotograma a fotograma en escritorio y
móvil: paso máximo de 4,8 px al cruzar, cámara 5,7 px. En producción, `check-release-live` en las
seis rutas y tres anchuras con cero escrituras de jugador, y el demonio del bosque vivo activo
con la release nueva.

## Producción: Yo, el saco y Construir rediseñados, y la puerta de la cuenta — 19 septiembre 2026

Artefacto `3a3ab5c30627e39142e4`, fuente del juego `c68e5e42e126d0fd0891228be037ebb9f079002e`,
web `e8022702`. Anterior conservada: `6b034b57ec99f966e0d0`. Rutas: /aventura y
cinco traducciones.

SHA-256 de `release.json`:
`39575add3b4c72fb048cee9e28d9a7a85b07373ad6257cce38f0c93dee60ebbd`.
610 archivos verificados y ESTACIONADOS antes de mover el puntero (instalador en un solo
fichero Node, ejecutado como `magikitos` desde `/tmp`, temporal borrado después). Frente a
la anterior solo cambian `aventura.min.css`, `aventura.min.js` y las seis páginas. **Sin
migración y sin PHP**.

### Alcance publicado

- **Las modales hacen scroll y se rediseñan en tarjetas** (el dueño: «un diseño un poco
  cutre… déjalo perfecto con máxima usabilidad en mobile, tablet y desktop»). Hasta hoy
  tenían tope de alto sin desplazamiento: en escritorio y tablet el elenco, el correo de
  la cuenta y las últimas filas del catálogo quedaban recortados. Pantalla completa solo
  en el teléfono (< 640 px); la tablet conserva la tarjeta.
- **«Yo»**: cabecero con el retrato del elenco y una línea que dice si la partida te sigue
  o vive solo en este navegador; dos columnas en escritorio (tu duende / tu cuenta, tu
  partida, idioma) en tarjetas con rótulo.
- **El saco**: fotos en cajas del mismo tamaño (`sprites.iconIn`), la cuenta en una chapa,
  detalle con foto en columna fija a la derecha desde 900 px.
- **Construir**: el sitio como subtítulo; «Llevas» con nombre y número y solo lo que llevas;
  precio en rojo en la baldosa cuando no te llega; barra de colocar con etiquetas en
  escritorio e iconos en el teléfono. El nombre de la esquina se recorta para no pisar el saco.
- **Construir sin cuenta abre «Yo»** (el dueño: «no simplemente decirle "tienes que guardar
  tu cuenta", sino mostrar el modal de Yo»). Sin sesión, «para construir en el mapa público
  tienes que tener tu cuenta creada» con la tarjeta de la cuenta resaltada; con sesión sin
  la partida guardada, la tarjeta de la partida con su botón. Textos nuevos en seis idiomas.
- **El aro del joystick se queda** siempre que el dedo manda, más tenue (el dueño: «que
  siempre salga, solo ligeramente más transparentito»). Fuera el contador de aprendizaje.

### Comprobado

`npm test` entero (65 bloques, con los textos nuevos en seis idiomas), y en navegador a
1440/768/390/844: controles del mundo, elenco, regresiones generales y la puerta de la
cuenta de la frontera (su comparación con la web de DDEV no corrió: DDEV servía 503 sin la
release instalada). Capturas revisadas de los tres paneles, del aviso de cuenta y de la barra
en 390, 768 y 1440, con la API simulada en local. En producción, `check-release-live` en las
seis rutas y tres anchuras con cero escrituras de jugador enviadas.

## Producción: el joystick invisible bajo el dedo — 19 septiembre 2026

Artefacto `6b034b57ec99f966e0d0`, fuente del juego `6e37940a65ad17f2bb29e09c505b49eea911ca4c`,
web `c3fb0999`. Anterior conservada: `4afa37fb2d4b5f31342b`. Rutas: /aventura y
cinco traducciones.

SHA-256 de `release.json`:
`2d7cf2b18c9199028bf1826850b8de3ae886a98274783e68846573b3a0bbaf9b`.
610 archivos verificados y ESTACIONADOS antes de mover el puntero (instalador en un solo
fichero Node, ejecutado como `magikitos` desde `/tmp`, temporal borrado después). **Sin
migración y sin PHP**: solo el cliente del juego y el puntero.

### Alcance publicado

- **El mando es un joystick invisible que nace donde apoyas el dedo** (decisión del dueño
  tras probar en producción el guiado hacia el dedo de la entrega anterior: «con nada que
  me alejo ya se pone a correr», «para ir arriba el dedo tiene que estar muy arriba»).
  Mover el dedo manda al duende en esa dirección como una flecha del teclado, por
  `directionIntent`: mismas colisiones, empujes, charlas al chocar, costuras y remo.
  Umbrales en píxeles de pantalla: zona muerta 10, andar hasta 100, correr en el borde,
  volver a andar bajo 80. Soltar para. El origen sigue al dedo pasado el radio, así que
  virar no exige levantar. Tocar sigue siendo ir e interactuar.
- **Aro de aprendizaje** pintado en el lienzo mientras el dedo manda, hasta seis segundos
  acumulados andando con él; después se apaga para siempre en ese navegador
  (`localStorage`, como el duende elegido: el contrato `GameState` de la nube no admite
  claves nuevas).
- **El lienzo no se selecciona en iOS**: la pulsación larga sacaba «Copiar / Buscar con
  Google» y pintaba la página de azul. `user-select: none` y `-webkit-touch-callout: none`.
- La cámara va pegada al duende, sin adelanto ni destino. Dos dedos y botón derecho mueven
  la cámara; el segundo dedo suelta el mando. Se borran `leadTo`, `cameraLead`, `guided`,
  `river.lead`, `dockFor` y `pendingWater`. Textos de ayuda en seis idiomas al día.

### Comprobado

`npm test` entero (65 bloques, con la unitaria de gestos reescrita: origen que sigue, zona
muerta, histéresis, dos dedos, botón derecho, modo construir, cancelación), y en navegador
contra el bundle local a 1440/768/390/844: controles del mundo (con el aro apagándose al
aprender y la costura del río con el dedo puesto), movilidad, viajes, río, mundo y zoom,
diálogo y bosque compartido. Captura del aro en móvil simulado revisada. En producción,
`check-release-live` en las seis rutas y tres anchuras, remando con el dedo y cero
escrituras de jugador enviadas. Nota operativa: el disco del Mac del dueño quedó con menos
de 400 MB libres durante la construcción; se limpiaron solo los temporales de la sesión.

## Producción: mantener el dedo es guiar — 19 septiembre 2026

Artefacto `4afa37fb2d4b5f31342b`, fuente del juego `d0f5405b7a7b7db2625963e2871f27b81d4b5cea`,
web `6008980b`. Anterior conservada: `7ef023e7b6b41c66bef3` (el mando del mapa de esta
madrugada, activado en la web `e0e88da3` sin acta propia aquí; se conserva para pestañas
abiertas y vuelta atrás). Rutas: /aventura y cinco traducciones.

SHA-256 de `release.json`:
`57492727190e03d9dff1eac8f8eadd4a6b3663ba218e3cf52c438ba5de322fbb`.
610 archivos verificados y ESTACIONADOS antes de mover el puntero (instalador en un solo
fichero Node, ejecutado como `magikitos` desde `/tmp`, temporal borrado después). **Sin
migración y sin PHP**: solo el cliente del juego y el puntero.

### Alcance publicado

- **Mantener el dedo es guiar** (decisión del dueño: el «arrastrar el mapa lleva al duende al
  centro» «no permite navegación continua»). Un dedo, lápiz o botón izquierdo que se queda
  puesto 180 ms, o que pasa la holgura de toque, lleva al duende hacia lo que hay bajo el dedo
  con la cámara pegada a él: se anda sin soltar y se vira deslizando. Cerca anda, lejos corre,
  encima del duende es quieto (14 → 20 px de histéresis). Soltar termina el viaje en el último
  punto. Un toque largo sin mover el dedo sigue siendo un toque con interacción.
- **La cámara se mueve con dos dedos o con el botón derecho/central**, sin dar órdenes ni
  cortar el viaje en curso. Un pellizco quieto sigue haciendo zoom sobre el duende sin soltar la
  cámara. Construyendo, un dedo sigue moviendo el mapa. Menú contextual del lienzo anulado.
- **Guiando, la cámara sigue al duende y no al sitio**, y se adelanta hasta 32 px de mundo
  hacia el rumbo, suavizado (`cameraLead`, función pura). **Clavar es llegar, no viajar**: un
  zoom a medio viaje hacia un sitio tocado ya no teletransporta la cámara al sitio (lo destapó
  la prueba en 390×844).
- **Sin marcador de destino** («no quiero el puntito blanco placeholder de posición final»).
- Textos de ayuda del lienzo en seis idiomas al día. Del teclado no se tocó nada.

### Comprobado

`npm test` entero (65 bloques, con la unitaria de gestos reescrita y la nueva de
`cameraLead`), y en navegador contra el bundle local a 1440/768/390/844: controles del mundo,
movilidad, viajes, río, mundo y zoom, diálogo y bosque compartido. La suite de construcción
contra DDEV no pasó del asiento del servicio en vivo (entorno; el paneo en modo construir queda
en la unitaria). En producción, `check-release-live` en las seis rutas y tres anchuras, con
el dedo mantenido remando y cero escrituras de jugador enviadas.

## Producción: apuntar antes de clavar, y postes a toques — 18 septiembre 2026

Artefacto `fb314b25fc8fecd9542c`, fuente del juego `a8d6c25c8619b28f60f2cbe63472148b28979fa5`,
web `8d01a24a`. Anterior conservada: `bb91229ae4c7f1da4cd0`. Rutas: /aventura y
cinco traducciones.

SHA-256 de `release.json`:
`2d45f00c3d26840a2005200a40b0e83c442621e7ef860a4270cd6ab02c8ccc3d`.
525 archivos verificados y ESTACIONADOS antes de mover el puntero. Sin migración. **Con PHP**:
esta vez la autoridad cambia —la regla de vecindad de los trazados— y por eso el puntero y el
`src/game/community.php` viajan en el MISMO commit de la web, que es lo que deja la ventana en
cero.

⛔ **El artefacto se construyó desde un árbol LIMPIO** (`git worktree` sobre el commit publicado)
porque otro agente estaba generando arte de duendes en el mismo repositorio: lo que no está
comiteado no se publica, y su trabajo se quedó donde estaba.

### Alcance publicado

- **El rastrillo es el rastrillo**: `data-sprite="rake"`, el mismo objeto que se recoge en el
  bosque para hacer caminos. Fuera el SVG dibujado a mano.
- **La pieza nace sin sitio.** Con ratón aparece bajo el cursor y lo sigue; con el dedo aparece
  donde tocas; el toque la clava y Colocar la fija. Si ahí no cabe, se va igual a ese sitio y
  **destella en rojo, sin una palabra**: lo único que la barra dice con palabras es lo que CUESTA,
  en rojo cuando no te llega. Tras colocar vuelve a la mano por apuntar, no encima de lo que
  acabas de dejar.
- **Vallas y caminos a TOQUES, poste a poste**, con el precio subiendo a la vista y `⟲` para
  quitar el último. Se erradicó la máquina de mantener-pulsado entera: arrastrar mueve el mapa,
  siempre.
- **Imán de una celda** sobre los postes de su especie: es el hueco más grande por el que un
  duende todavía no pasa, así que cierra exactamente lo que no servía de puerta. El poste que va
  a atrapar se enciende antes de soltar.
- **Y una puertecita se puede construir**: pasar cerca de la PUNTA de un trazo deja de contar como
  ir en paralelo a él. Medido, los huecos de una celda a dos y media se caían todos por
  `too_close`.

### Comprobado

`npm test` entero, las dos caras del validador en negativo (cliente y autoridad), el recorrido
real en DDEV con valla, camino y piscina a 1440/768/390 —clavando postes, quitándolos, empalmando
con lo recién puesto y comprobando que un arrastre sigue moviendo el mapa sin plantar nada—, la
frontera con su puerta de cuenta, y en producción `check-release-live` en las seis rutas y tres
anchuras con cero escrituras de jugador. De paso salió que el botón de recentrar se comía la
esquina de Colocar a 390px: se comprobó PULSANDO los bordes de los tres botones de la barra en
las dos modalidades y las tres anchuras.

## Producción: construir es un icono más, y lo que se pone se queda — 18 septiembre 2026

Artefacto `bb91229ae4c7f1da4cd0`, fuente del juego `ddb5574374be2e7247bf6ff764dee03c587afab9`,
web `0e60ca9b`. Anterior conservada: `eb4e139a8b7d33148951`. Rutas: /aventura y
cinco traducciones.

SHA-256 de `release.json`:
`e94af4224dad50461464314dbddf7d82bd85c6f71b29131db6b061fcbd64ddee`.
525 archivos verificados y ESTACIONADOS antes de mover el puntero. **Sin migración y sin
PHP**: esta entrega es del cliente del juego y no toca ni la autoridad, ni el contrato de la
API, ni una tabla.

### Alcance publicado

- **Construir se abre desde un rastrillo de la esquina de arriba, junto al saco**, igual en
  teléfono que en escritorio (decisión del dueño: «nada de botón abajo a la izquierda»), y se
  llama **Construir** a secas: que el bosque es colectivo ya se ve.
- **Su catálogo es la modal de la casa**: el mismo caparazón y la misma rejilla que el saco y
  que «Yo» —`.world-bag-grid` pasa a ser `.world-pick-grid`, que no es del saco—, a pantalla
  completa en el teléfono. Una baldosa por cosa, variantes incluidas: las diecisiete a la vista.
- **Elegir CIERRA el catálogo**, y ahí estaba el fallo que el dueño reportó como «he
  seleccionado piscina y al pinchar no se queda en el sitio»: con el panel ocupando media
  pantalla, «tócalo donde quieras» significaba tocar el panel. La pieza se queda en la mano, el
  mapa vuelve a ser tuyo entero y abajo queda una barra fina con qué llevas, por qué no cabe
  cuando no cabe, y Colocar.
- **Lo colocado se queda**: ni mover ni quitar, tampoco lo tuyo. Tocar algo puesto cuenta quién
  lo dejó y nada más. El servidor sigue sabiendo mover y retirar y los datos conservan su
  `removeCost`/`removeLabel`: el día que vuelva la retirada comunitaria es una pantalla.
- **Dos baldosas no se llaman igual**: `construction.json` trae un mapa de variante a clave de
  textos (doce palabras en seis idiomas) y `check-community-foundations` se niega a pasar si una
  se queda sin nombre. Las flores del prado se llaman por lo que son y la prímula pasa a ser una
  de sus dos caras.
- **Los duendes chocan.** Los desconocidos eran un dibujo y se atravesaban; ahora tienen cuerpo y
  solo contra ti, sin tocar la autoridad. Quien ya te está encima es atravesable hasta que sales.
- **La barca amarrada se pega a su muelle.** Estaba entre 3,1 y 4,6 tiles de la punta por
  compartir punto con el ancla de embarque, que es física; la aparcada es un dibujo y se deriva
  del muelle real con `docks()`, así que se mueve con el embarcadero.

### Comprobado

`npm test` entero, el recorrido real de construir en DDEV (valla, camino y piscina a
1440/768/390, contra el API y la base de verdad), la frontera con su puerta de cuenta, el río
con sus seis muelles, el elenco, y las dos pruebas del Studio, que sigue editando solo lo fijo
que pone el dueño. En producción, `check-release-live` en las seis rutas y tres anchuras, con
cero escrituras de jugador enviadas. La prueba del rastrillo tras desembarcar espera al pintado
siguiente: medido contra producción, aparece a los 17 ms, y leer el DOM en el mismo tic medía el
estado de antes de bajarse de la barca.

## Producción: la tienda sale del bosque — 17 septiembre 2026

Artefacto `50f00dde6041c46a1a7d`, fuente del juego `0b942dd6aefe807356b57b30d91c32a835845aa2`,
web `1613ba6a`. Anterior conservada: `a09ac5145af32f81a0f9`. Rutas: /aventura y
cinco traducciones.

SHA-256 de `release.json`:
`a2352c0adfdca6423083ca1b28b87f6255b8036391a4812bf92999af774a7e7b`.
480 archivos verificados y ESTACIONADOS antes de mover el puntero. Sin migración:
esta entrega no toca ni una tabla.

### Alcance publicado

- **La tienda ya no está en el bosque** (decisión del dueño: «quita todo lo de
  la api de exponer los productos»). El taller de Carmen se queda como SITIO y
  sus dos bancos pasan a ser mobiliario. Se fueron enteros `workshop.js` —que
  estiraba la habitación y plantaba un expositor por figura a la venta—, la sala
  `shop` del catálogo, `products()`, `furnish()`, la vista de producto con su
  precio, el dibujado del expositor, las dos reglas de CSS y las cuatro claves
  de texto. En la web, `worldApiCatalogue()` solo acepta `kind=art`: `products`
  es un `invalid_kind` 400 como cualquier otro valor que no existe, y el esquema
  `Product` sale del contrato en los dos repos. La tienda sigue viva en la web,
  en el menú, el pie, la home y cada ficha de figura.
- **Y las comprobaciones que probaban la tienda prueban lo contrario**: un lote
  de productos se RECHAZA en el cliente (`invalid_sheet`), `kind=products` entra
  en la lista de peticiones inválidas del API local, y los barridos de navegador
  dejan de pasear por una sala que no existe.
- **El Studio nombra las doce pantallas.** Su lista de nombres estaba escrita a
  mano y había caducado: nombraba tres escenas que ya no existen y le faltaban
  las seis que nacieron después, así que el río, el seto, la casita de seta y la
  maceta salían con su SLUG en el selector. El nombre ya existe y es el que el
  juego ANUNCIA al llegar: se resuelve igual que en `sceneKeys()` y se lee en
  castellano de los mismos ficheros de texto, así que una pantalla nueva llega
  al Studio con su nombre puesto sin tocar una línea. Y viaja del snapshot VIVO
  y no del archivado, que se guarda por un hash del mundo y del arte: un nombre
  corregido hoy seguiría enseñándose viejo hasta que cambiara el mapa.
- **La sesión de mapa del dueño**, aplicada tal cual: overworld, taberna,
  refugio de hojas, casita de seta y el taller, que estrena cómoda y estufa
  donde estaban los bancos de la tienda.

### Lo que salió al aplicar la sesión

- **La barbacoa del merendero tapaba el felpudo de la maceta del pescador.** Lo
  cazó el guardián de rutas («exit: arrival»): salir de esa casa dejaba al
  jugador dentro de un sólido. Se mueve la barbacoa un cuarto de casilla, que es
  lo mínimo que deja pasar. El Studio NO avisa de esto: valida cada pieza por
  separado y la caminabilidad es una pregunta de la escena entera.
- **⛔ Una comprobación fijaba el TAMAÑO de una seta.**
  `assert.equal(find("picnic-mushroom").scale, 0.85)` no medía ninguna regla:
  medía una tarde. El Studio existe justamente para que el dueño redimensione lo
  que hay en el mapa, así que eso convierte una decisión de arte en un build
  roto (la casa ya publica recogibles a 0,48 y a 0,65). Lo que se sostiene es el
  CONTRATO de la seta —sin cuchillo no se corta, con cuchillo cae una—, intacto.

### Comprobado antes y después de mover el puntero

`node scripts/test.cjs` entero (37 PASS), los barridos de navegador del bosque,
del Studio (caminos y selección), de las láminas, de la actividad nativa, del
API local contra DDEV y el de frontera —que exige que los dos repos consuman el
MISMO contrato—. En producción, `check-release-live.cjs`: las seis rutas con su
HTML byte a byte, cero escrituras de jugador y el API protegido.

## Producción: un sitio sin nombre dice su slug — 17 septiembre 2026

Artefacto `a09ac5145af32f81a0f9`, fuente del juego `89817ad0b9ef67c0bd113ebcfddecba024e3cde6`.
Anterior conservada: `9f3fce5a666ca9861191`. Rutas: /aventura y cinco traducciones.

SHA-256 de `release.json`:
`435ceffb459654fa52ce2c4c89c751d325d59526c6b5b35c1da57ef1318ae355`.
479 archivos verificados antes de mover el puntero. Esta entrega lleva la
migración **4234** (fuera los dos claros retirados), aplicada antes del puntero
porque solo borra filas de zonas que el código publicado ya no conoce.

### Alcance publicado

- **Cuatro sitios del bosque anunciaban su slug.** Entrar al refugio de hojas
  decía «house» y a la taberna «tavern»; salir de la maceta del pescador al lago
  decía «lake» y llegar al merendero «picnic». Al viajar, el mundo anuncia el
  rótulo de la pantalla y, si no lo tiene, el trozo de mapa donde caes —y dentro
  de una casa, la pantalla misma—. Eso es lo que pregunta el motor, así que ahora
  es lo que EXIGE el compositor de textos: las tres casas estrenan rótulo como
  todas las demás pantallas y los tres trozos del mapa se nombran junto a la
  pantalla que los dibuja. Romper uno de esos nombres es el sexto destrozo que la
  comprobación de textos hace a propósito.
- **Lo que dice el bosque, leído línea a línea.** Las conchas ya no le sirven a
  «alguien del islote» sino a la vecina que hace botones con ellas; el letrero del
  claro se lee entrecomillado y luego opina el duende, como los otros cuatro del
  bosque; el trazo dejó de llamarse vallita cuando lo mismo dibuja un camino; y
  salir de una casa lleva al bosque, que es donde caen cinco de las seis puertas.
- **El islote sale también de los nombres.** El paquete de arte que dejó guarda el
  huerto que hoy vive en la pradera de los sauces, así que se llama `garden`, su
  tarea es `art:garden` y la guía es `RESIDENTS.md`. El README describía un
  exterior de 128×96 y un islote habitado de 64×48 al que se llegaba en barca.
- **Un paquete de sprites se nombra por su contenido**, así que cada retoque
  dejaba el anterior detrás: 26 ficheros y 1,1 MB de dibujos en un repositorio
  público que ningún manifiesto nombraba. Se podan al hornear, que es donde se
  sabe lo que sigue vivo.
- **Seis barridos de navegador no tenían forma de correrse** (gatos, seto,
  recogidas, río, selección del Estudio y el bosque compartido): existían y nadie
  los llamaba. Los seis pasan y los seis tienen su tarea.
- **La firma de lo que se construye en el claro viaja con la persona.** Al bosque
  se entra con una identidad anónima, así que reclamar la cuenta pasa siempre por
  la fusión — y la fusión no movía `game_community_objects.creator_id`: al borrar
  el anónimo, la vallita y el banco que esa persona acababa de dejar se quedaban
  SIN AUTOR, en público y para siempre. Ninguna de las dos columnas del bosque se
  llama `*_user_id`, así que las tres guardias de la casa eran ciegas a ellas.

### Comprobado en producción

Las seis rutas byte a byte contra el artefacto instalado, el API protegido, el
bosque en tres tamaños de pantalla y cero escrituras de jugador
(`check-release-live`). Y en el sitio de verdad, entrando a la taberna y al
refugio con el teclado: anuncian «La taberna de la bota» y «El refugio de hojas»,
sin un error de JS. La firma, reproducida en el clon en las dos direcciones: sin
el arreglo el dueño de la pieza queda en NULL al reclamar la cuenta; con él, en la
cuenta nueva.

## Producción: un bosque más pequeño que se cruza andando — 17 septiembre 2026

Artefacto `9f3fce5a666ca9861191`, fuente del juego `3dbacd14917de41a3ad74d3d74bd9c4d497df4e4`.
Anterior conservada: `a876f38ab81cc7889473`. Rutas: /aventura y cinco traducciones.

SHA-256 de `release.json`:
`089f4b0546250e890234fbc13b396c4712ccccbd453844974f0044ed9eb00886`.
479 archivos verificados antes de activar el puntero. Esta entrega SÍ lleva
esquema: migraciones **4232** (fuera el hogar privado y el saber) y **4233** (el
claro nuevo y los vértices de las vallas), aplicadas ANTES de mover el puntero
porque el código que se publica ya no escribe la columna del saber y sí escribe
la de los vértices.

### Alcance publicado

- **Cuatro pantallas menos.** Se van el laberinto de los juncos, el islote de las
  conchas, la ribera de las kelihouses y el tocón de Mirlo. El mapa era grande y
  estaba vacío, y media mitad existía para sostener las dos cosas que esta ola ya
  había retirado: las praderas privadas y la isla a la que solo se llegaba en
  barca.
- **La vida del islote se mudó a la pradera de los sauces** conservando las
  distancias entre sus treinta y tres piezas. Dos excepciones, las dos del dueño:
  las tres casas se borran en vez de mudarse, porque la misma casa en dos
  pantallas no es consistente; y la playa de las conchas se ESPEJA antes de
  viajar, porque en el islote el agua quedaba al este y aquí queda al oeste.
- **La pradera se cruza andando de punta a punta.** Ocho costuras a pie unen las
  tres pantallas del río por las dos orillas, declaradas en los mismos bordes que
  cruza la barca y con la misma pieza detrás. El río muere en su nacimiento, así
  que a un borde sin salida se le pide que CIERRE el cauce en vez de encajar.
- **Construir vuelve a tener sitio, y es público**: el claro de los sauces,
  cuarenta y ocho por treinta tiles de hierba abierta con tres entradas. Los dos
  claros anteriores vivían en pantallas que ya no existen, así que el recorte del
  mapa se había llevado la construcción sin que se viera.
- **La vallita es un TRAZADO**, la misma polilínea que dibuja el Estudio, así que
  una valla del bosque y una valla de la casa son la misma cosa. Se dibuja
  dejando pulsado y arrastrando; un arrastre rápido sigue moviendo el mapa. Se
  cobra por celda y el servidor mide los vértices que recibe en vez de fiarse del
  precio que le manden.
- **La caja de construir dice lo que quiere**: lo que llevas encima siempre a la
  vista, ninguna baldosa apagada (el renglón dice qué falta), variantes como
  fotos, Girar y Colocar, el claro pintado en el suelo y la cámara viajando a él
  al abrir.
- **La sala de las láminas para colorear podía no abrirse nunca**: su círculo
  estaba a treinta tiles de su mesa desde que el mapa se redibujó en el Estudio.

### Comprobado en producción

Las seis rutas byte a byte contra el artefacto instalado, el API protegido, cero
escrituras de jugador, y en navegador: remar, desembarcar en el claro, y subir y
bajar la pradera a pie cruzando las dos costuras (sauces → rápidos → raíces y de
vuelta), conservando el desvío al cruzar.

## Producción: el texto por pantalla y el río de todos — 17 septiembre 2026

Artefacto `a876f38ab81cc7889473`, fuente del juego `de1505394c8f0c2197150012fca26c0d2a62fb5d`.
Anterior conservada: `b2b1297497393ca2b985`. Rutas: /aventura y cinco traducciones.

SHA-256 de `release.json`:
`f0ab339c17914056b303d9430ed998d49978fa228a8632c6872d91c7bae200dc`.
509 archivos verificados antes de activar el puntero. Despliegue limitado al
puntero y la documentación: sin cambios de backend, migraciones ni escrituras.

### Alcance publicado

- **El texto deja de ser un fichero por idioma.** El motor lleva sus 213 frases
  incrustadas y cada pantalla trae las suyas junto a sus sprites: entre 0 y 63
  por escena, la mayor de 4,9 KB. La página incrusta ~4,8 KB menos por idioma
  hoy, y una pantalla nueva ya no engorda la primera carga. Cada clave se
  escribe con sus seis idiomas juntos, así que la paridad no se puede romper.
- **Ni un setín se acuña en el bosque.** Brizno entrega sus remos, la vecina de
  las conchas recibe un regalo y la fuente no cobra por un deseo. La maquinaria
  (peajes, premios, recuerdos, tokens de precio) sigue intacta en el motor y en
  el contrato del servidor, y `economy.rewards` se conserva porque es el
  vocabulario de las partidas ya guardadas.
- **Pasada de diálogos y carteles**: ningún texto dice dónde está algo ni lo que
  pasó fuera de plano. El cartel del picnic señalaba al oeste diciendo «pa
  arriba» desde que se movió el mapa; el del muelle dice ahora que con un par de
  remos y cualquier cosa que flote se hace una barquita.
- **El río es de todos**: el vecino que rema y el corcho de quien pesca son
  cuerpos de colisión con su propia queja, y una barca parada se aparta en vez
  de que le pasen por encima.
- **Las costuras coinciden con el agua**: el casco llega 0,175 tiles más allá de
  donde acababan las bandas, así que pegarse al final del río no hacía nada en
  diez salidas. Y cruzar pegado a una orilla llega pegado a esa orilla.
- **Las pantallas vecinas se precargan** (las tres más próximas, con techo
  medido: peor caso 3.417 KB).

### Verificación

`npm test` (39 comprobaciones) y los nueve barridos de navegador: aventura, río,
picnic, Ascua, capítulo, movilidad, trayectos, gatos, seto, controles, empotrado,
encuadre y modalidad de entrada. Barrido nuevo de textos por pantalla, que además
rompe cinco invariantes a propósito para verlo gritar. Las dieciséis salidas del
río barridas punto por punto sobre el borde flotable.

Tres fallos que ya estaban desplegados se arreglan de paso: los barridos de la
fuente y de movilidad llevaban coordenadas del mapa escritas a mano y el dueño
redibujó el bosque, y el del río contaba la telemetría anónima como una escritura
del jugador. `check-community-browser` sigue necesitando la web local y no se
ejecuta aquí.

## Anterior: bosque, ribera y Studio — 16 septiembre 2026

Artefacto `16b0a4d437c50c2ba7d6`, instalado en DDEV. **No desplegado a producción**;
el puntero local de la web no se incluye en el push. Esta revisión parte del juego
`4a16ba5` y la web `5eac98ff`, conservando la integración de la pestaña Aventura.

Última revisión del Studio:

- Incorporadas las 39 recolocaciones del bosque, la escala del cuenco, las dos
  retiradas de árboles y el cercado que propuso el propietario. Ajustados los
  accesos y patrullas a las nuevas posiciones, conservando IDs y partidas.
- Las piezas solapadas del picnic pasan a dos vallas continuas, con entrada libre.
  Herramienta **Vallas**: tramos horizontales, diagonales o verticales, esquinas
  editables, postes compartidos y colisión estrecha derivada del mismo trazado.
- Selección múltiple por clic o marco, movimiento y ajustes en grupo, modo táctil,
  Backspace/Supr protegido, deshacer y guardado de una única versión.
- Castaño y sauce nuevos, originales/prompts conservados y variantes en la galería;
  dos packs independientes (unos 476 KB en total), con reducción integrada 2×.
- Eliminados los campos heredados redundantes que producía la propuesta: las
  escenas guardan ajustes de instancia, no copias de las definiciones de familia.

Verificación de esta revisión: `npm test`, selección/trazado en navegador con
workspace aislado (1440×1000, 768×1024 y 390×844), y revisión visual de las 15
capturas del bosque, picnic, interiores y río. Se conserva la versión del Studio
del propietario, sin conflictos ni cambios pendientes tras incorporar su diff.
Receta completa en cinco tamaños, captura/regreso de gatos en tres y recogibles
con persistencia en cuatro, usando posiciones de prueba derivadas del mapa
actual en vez de coordenadas antiguas. Sin tocar partidas del propietario.
Editor de caminos: creación, arrastre, inserción/borrado, deshacer, recarga,
exportación y cancelación al pellizcar comprobados en escritorio, tablet y móvil.

Base de bosque y ribera conservada:

- Bosque inicial de 144×112 tiles, nueve ramales, casas más separadas y picnic
  delimitado por vegetación. Brizno y su barbacoa están junto a su casa y el muelle.
- Botella disponible solo después de cocinar, también en el contrato de la API.
  Se van los humanos, permanece su gato y aparece un segundo de otra variedad.
- Gatos con torso registrado entre fases, cadencia ligada a distancia y regreso
  con reintento de ruta; no se teletransportan ni quedan abandonados al soltar.
- Taberna de 40×32 con tres corrillos, personajes mirando hacia sus mesas y
  menaje reutilizable. Las entradas usan el spawn de su habitación, sin duplicarlo.
- Cinco tramos amplios con perfiles de orilla compartidos por dibujo, colisión
  y corriente. Estelas sin flechas, bambú, pescadores y barquita de cáscara.
- Jardín de los gatos conectado antes de los rincones comunitarios: cinco macetas
  movibles ocultan al jugador; el cuenco permite construir la piscina.
- Maceta de base invertida sustituida sin romper su ID. Arte nuevo y sus fuentes
  revisadas en `data/aventura/art/world-polish/`; packs antiguos sustituidos retirados
  del árbol público, recuperables en Git y `.local/art-history/world-polish-20260916/`.

Verificado: `npm test`, 15 capturas de escenas, suite general de navegador
(siete tamaños, interiores, puertas, guardado, seis idiomas y Studio), captura y
regreso de gatos en tres tamaños, receta en cinco, galería/variantes en cinco,
recogibles en cuatro y movimiento/cámara en tres, integración con la web y
colocación/retirada/reembolso de valla y piscina con API
real local en escritorio, tablet y móvil. Backend local: 34 comprobaciones de
autoridad y 13 de concurrencia. Solo fixtures identificadas, retiradas al acabar.

Los 100 duendes, partidas, autoría del Studio y construcciones previas se conservan.
El Studio no tiene cambios pendientes ni conflictos tras el rebase. Las pruebas
responsive usan Chrome automatizado; no certifican dispositivos físicos ni Safari.
Pasos reproducibles: [LOCAL-DEVELOPMENT.md](LOCAL-DEVELOPMENT.md).

## Última producción verificada (anterior a este candidato)

Última activación verificada: `18b22405a8894271294f`, 16 septiembre 2026.
Fuente del artefacto: `b683ed8960cf7c5cb240409cf836cca9f028b626`.
Activación web: `750eecfd38377bcfe4c70571091fca9db30e7c11`.
Anterior conservada: `04c689f5c4a7b20aab65`.
Rutas: /aventura y cinco traducciones; web y API independientes.

SHA-256 de `release.json`:
`c2f4928fa9cec700907e0979ae30aa1657ae5ccd056af732dcea7d2c460d58d2`.
397 archivos verificados antes de activar el puntero. Despliegue fast-forward
limitado al puntero, documentación y herramientas de prueba/autoría inertes:
sin cambios de backend, migraciones, seed, importaciones ni escrituras en partidas.

### Alcance publicado

- Botella independiente en el suelo junto a la papelera; mismo ID autoritativo.
- Doce palos colocados: cuatro en el bosque y dos por tramo recolector del río.
- Galería Recogibles: palos, plantas culilimpia y botella; familias reproducibles.
- Seta de Brizno al 85 %, dibujo y cuerpo transformados juntos.
- Índices estables de plantas/palos; sin resetear inventarios ni partidas.
- Quince documentos obsoletos retirados, recuperables en Git. Guías vigentes
  consolidadas; `REPOS.md` privado resume la separación real sin duplicar este registro.

### Verificación de aquella activación

Local: `npm test`; recogibles en cuatro tamaños; galería/autoría y receta
completa en cinco tamaños; 33 comprobaciones locales de autoridad, 13 de
concurrencia/restauración/identidad y 167 peticiones de contrato API local en
seis idiomas. Las fixtures locales se retiran al terminar; no se usan cuentas
reales para estas pruebas. Studio principal conserva su workspace sin conflictos.

Integración general: siete tamaños de 320×568 a 2560×1440; cinco interiores en
cuatro tamaños; seis idiomas; puertas, escaleras, barca, guardado y pruebas aisladas
de recorte/colisión/autosave/diff del Studio.

Producción: seis rutas exactas byte a byte en origen; shell y hashes de JS/CSS,
manifest y contrato en el dominio público; API, galería plana, mundo compartido,
web tradicional y accesos protegidos. Bosque, navegación, desembarco, controles y
carga diferida probados en 1440×900, 768×1024 y 390×844. Cero escrituras enviadas;
también se bloquearon los POST de seguridad inyectados por Cloudflare.
Prueba pública específica de recogibles: botella/papelera, partida con barca,
seta reducida, desaparición de palos y persistencia tras recargar en 1440×900,
768×1024, 390×844 y 844×390, con todas las escrituras bloqueadas.

Entrada explícita, fullscreen y música/ambiente se conservan sin cambios. Sus
pruebas públicas de señal, voces y crossfade pertenecen a la entrega anterior;
el núcleo de audio se vuelve a comprobar en `npm test`. No es una compilación
nativa ni certificación de Safari/iOS o dispositivos físicos.
Procedimiento repetible: [RELEASING.md](RELEASING.md).

## Recuperación y límites

Conservar el artefacto anterior y revertir solo el puntero con revisión explícita;
no restaurar bases de datos encima del progreso nuevo. Mantener medios, partidas,
Studio y construcciones existentes. No ejecutar ejemplos/seed al pulir escenas.

La publicación usa cuenta personal `alvarofranz`; ver `AGENTS.md`. La consolidación
de los dieciséis commits de desarrollo del 16-sep conservó el commit fundacional
`ce13ac20b4045e87345ba576b93b950c112ca000`; recuperación local:
`.local/history/before-personal-squash-20260916.bundle`,
`refs/backup/pre-personal-squash-20260916` y
`refs/backup/audio-before-personal-squash-20260916`. La web no reescribió historial.

La entrega nativa queda para su agente responsable: [MOBILE.md](MOBILE.md).
