# Estado de entregas

Registro operativo único. El historial de entregas y decisiones descartadas vive
en Git, no en varias guías contradictorias. Distinguir siempre un candidato local
de una activación en producción.

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
