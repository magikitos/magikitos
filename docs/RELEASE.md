# Estado de entregas

Registro operativo único. El historial de entregas y decisiones descartadas vive
en Git, no en varias guías contradictorias. Distinguir siempre un candidato local
de una activación en producción.

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
