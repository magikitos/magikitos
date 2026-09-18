# El bosque es de todos

Dirección aprobada, septiembre de 2026. La aventura y los conocimientos se ganan
individualmente; disfrutar de una construcción ajena no completa tu aventura.
Sin vidas, combate, Libro del Bosque, fiambreras ni parcelas privadas.

## Recorrido de esta entrega

1. Merendero humano al noroeste. Los humanos no detectan al duende; su gato sí.
   Mira su dirección, aprovecha los obstáculos y consigue navaja y mechero.
   El gato avisa antes de perseguir; si te pilla, te lleva por el pantalón, con el
   culete arriba y las extremidades colgando. Te deja más lejos, nunca en el agua,
   sin quitar objetos ni puntos de vida. Hay margen para escapar tras soltarte.
2. Con la navaja cortas seta. Recoges una ramita, enciendes y cocinas. Los humanos
   se marchan **al cocinar**, no al entregar. El primer gato permanece y aparece
   un segundo de otra variedad; solo uno puede transportar al protagonista.
   Brizno vive junto al muelle y comparte la barbacoa al lado de su casa. Recibe
   la primera brocheta y entrega diez setines y sus remos reutilizables. Vuelve a
   tener hambre cada cinco horas; la recompensa inicial no es una granja infinita.
3. Al marcharse los humanos aparece una botella tirada junto a la papelera;
   antes no existe ni se puede obtener mediante la API. En el embarcadero: botella + navaja +
   remos del viejo. Solo se consume la botella. La navegación queda desbloqueada.
4. Tres regiones de río de 128 × 144 tiles, con orillas explorables, desembarcos,
   vegetación, recursos y corrientes. Las rápidas empujan de verdad: busca remansos.
   La dirección de las estelas usa el mismo campo que la física; no es una flecha
   decorativa que promete una corriente inexistente.
5. Desde las raíces sale un brazo hacia el seto humano. Cuatro gatos, macetas
   movibles que tapan la visión, cuenco y semillas. El cuenco permite una piscinita;
   las semillas abren jardinería. «Recolocar las macetas» reinicia solo ese puzle.
6. **Todo el bosque se construye** (17-sep-2026). La zona ya no es una parcela: es la
   pantalla entera, y lo que se enumera es lo PROHIBIDO. Cuatro pantallas abiertas
   (el bosque y los tres tramos de río) con vallitas, caminos, bancos, mesas, flores,
   macetas, farolitas y piscina. Todos ven la misma versión confirmada al visitarla.
   No son visitantes conectados en tiempo real. Detalle en [CONSTRUCCION.md](../CONSTRUCCION.md).

## Controles y construcción

- Clic/toque en suelo: caminar/correr hasta allí, rodeando obstáculos sin activar
  conversaciones. Clic en objeto: acercarse y realizar esa interacción.
- Flechas/WASD: movimiento directo. Espacio sostenido: correr o remar más rápido.
  Espacio en diálogo: siguiente; Enter/Escape: cerrar. Clic fuera del diálogo:
  cerrar y utilizar ese mismo clic para caminar/interactuar. **No hay rodar**.
- Palanca FLOTANTE de ocho direcciones a la derecha cuando se usa el táctil. La
  zona es una caja invisible en la esquina (`--world-stick-size`) y el anillo que
  se ve se dibuja DONDE cae el pulgar: ese punto es el neutro, y desde él todas las
  direcciones cuestan los mismos `--world-stick-travel` píxeles. Con el anillo
  clavado en la esquina, «abajo» y «abajo-derecha» eran las dos direcciones más
  difíciles del juego —el neutro estaba a 84px de dos bordes y la deflexión se
  gastaba 45, así que el pulgar terminaba a unos 47px del margen, encima de la
  franja de gestos del sistema—; eligiendo el neutro el problema no se pelea, se
  quita. Al soltar, el anillo vuelve a su sitio con una transición.
  La zona es lo ÚNICO que captura el gesto, así que fuera de ella el toque para
  caminar, el arrastre para desplazar el mapa y el pellizco siguen siendo los de
  siempre; y una pulsación DENTRO que no llega a dirigir se reenvía como toque en
  el mapa (`WorldInput.tapAt`), para que la esquina no se coma un destino.
  Arrastrar el pulgar cambia dirección sin levantarlo, con zona muerta y captura
  del puntero. El turbo aparece a la izquierda **solo con dirección activa**; al
  volver al centro, soltar o cancelar se oculta y desactiva, incluso si el otro
  dedo seguía pulsando. **Mientras hay conversación no hay palanca**: `openDialogue`
  pausa el movimiento, así que una palanca en pantalla no dirige a nadie y solo le
  cuesta al diálogo su propia altura dos veces (la que reserva y el empujón que esa
  reserva le da). Una marca en la raíz (`data-world-talking`) pone la reserva a cero
  y recompone las cinco reglas que se apartan de la esquina.
  Los controles son los mismos a pie y en la barca; una mano
  puede seguir dirigiendo al cruzar muelles y límites del río. Soltar, cancelar o
  perder el foco nunca deja un control pulsado. No se simulan teclas desde el DOM.
- Arrastrar: desplazar mapa; moverse retoma seguimiento. Pellizco/rueda: zoom del
  mapa, no de diálogos/botones. El recentrado aparece en el centro del joystick
  táctil, o como botón independiente abajo a la derecha con ratón/teclado.
  En exteriores se puede alejar hasta el límite geométrico de cobertura del mapa,
  sin un porcentaje mínimo artificial ni bordes vacíos; el encuadre inicial no cambia.
  Los interiores conservan su presentación de habitación recortada con exterior pintado.
- Caminar/correr: 72/190 píxeles de mundo por segundo. Remar/turbo: 82/205,
  antes de sumar corrientes. El núcleo más fuerte de los rápidos mantiene el
  retroceso físico incluso con turbo; hay remansos para remontar, no vidas que perder.
- Las rutas de clic, vecinos, gatos y barca comparten A* y simplificación por
  visibilidad: diagonales largas y menos giros, sin recortar cuerpos ni orillas.
  La búsqueda de atajos está acotada a 64 puntos por tramo y el protagonista
  comprueba 48 píxeles por delante para reaccionar a obstáculos móviles, además
  de validar cada subpaso de movimiento de dos píxeles.
- Con barca en el saco, caminar hasta la punta de un muelle embarca automáticamente.
  Remar hacia la punta desembarca. Clic/toque en las tablas traza la aproximación;
  no hay botones de embarcar/desembarcar ni activación por pasar de lado o descansar.
- **Construir se abre desde el rastrillo de la esquina de arriba, junto al saco**, igual en
  teléfono que en escritorio (18-sep-2026, decisión del dueño: «nada de botón abajo a la
  izquierda»). El catálogo es una modal de la casa —el mismo caparazón y la misma rejilla que el
  saco y que «Yo», a pantalla completa en el teléfono— con una baldosa por COSA, variantes
  incluidas: su dibujo, su nombre, el de la variante cuando hay más de una y lo que cuesta. Y
  **elegir la CIERRA**: era el fallo de fondo, porque con el panel ocupando media pantalla
  «tócalo donde quieras» significaba tocar el panel, y la pieza elegida no se quedaba en ningún
  sitio.
- Elegida la pieza, **nace sin sitio**: con ratón aparece bajo el cursor y lo sigue, con el dedo
  aparece donde tocas. El toque la CLAVA y el botón **Colocar** la fija — un clic no coloca nada
  para siempre, que es lo que pide «lo que se pone se queda». Si ahí no cabe, la pieza se va igual
  a ese sitio y **destella en rojo, sin una palabra**: lo que la barra dice es lo que CUESTA, y en
  rojo cuando no te llega, que es la única pregunta que el mapa no puede contestar solo. La pieza
  sigue en la mano tras colocar —poner una flor casi nunca es poner una sola— pero vuelve a estar
  por apuntar, no encima de lo que acabas de dejar.
- **Vallitas y caminos se clavan A TOQUES, poste a poste**, con la misma polilínea que dibuja el
  Studio (ocho postes y veinticuatro celdas de largo, y las vallas con sus dos vistas dibujadas:
  no giramos un PNG como una pegatina). Cada toque clava uno, el tramo del último a tu dedo va en
  fantasma, el precio sube a la vista y `⟲` quita el último. **Arrastrar mueve el mapa. Siempre**:
  aquí vivió un dejar-pulsado-y-arrastrar cuyo cartel era mentira (18-sep-2026, el dueño: «eso lo
  que hace es mover el mapa, y está bien que eso mueva el mapa»), y los dos gestos ya no comparten
  nada que puedan pisarse.
- **Un toque a menos de UNA CELDA de un poste se pega a él, sin espacio.** El número no es a ojo:
  una valla se come un cuarto de celda a cada lado de su punta y un duende mide doce píxeles, así
  que un hueco de N celdas deja (N − 0,5) de paso — media celda deja cero, una celda deja ocho
  píxeles (no pasa) y celda y media deja dieciséis, que es el primer hueco por el que sí se pasa.
  El imán cierra exactamente lo que no servía de puerta, y el poste al que va a pegarse se
  ENCIENDE antes de que sueltes. Va en celdas del mundo y no en píxeles de pantalla, o el zoom
  cambiaría qué toques empalman.
- **Lo que se pone se queda: no hay mover ni quitar** (18-sep-2026, decisión del dueño). Ni lo
  de otra persona ni lo tuyo — un bosque que cualquiera puede deshacer no es un sitio al que
  volver. Tocar algo puesto cuenta qué es y quién lo dejó, y nada más. ⛔ El servidor SIGUE
  sabiendo mover y retirar (con su devolución de materiales y su historial) y los datos conservan
  el `removeCost`/`removeLabel` de sembrar hierba sobre un caminito: el día que vuelva la
  retirada comunitaria es una pantalla, no una migración.
- Lo prohibido se compila de la propia pantalla: puertas, muelles, vecinos y cosas con
  las que se hace algo, con su margen, más los rincones de ambiente que declara el
  catálogo. Nadie puede cerrarle el paso a lo que ya se alcanzaba.
- **Y una PUERTECITA se puede construir** (18-sep-2026). Un trazado se empalma o se aparta sus
  celdas, pero pasar cerca de la PUNTA de otro no es ir en paralelo a él: medido con el validador
  de verdad, dos vallas en línea separadas de una celda a dos y media —justo los huecos por los
  que cabe un duende— se caían todas por `too_close`, así que solo se podía empalmar o dejar un
  portón de tres celdas, y nada en medio. Contra el INTERIOR de un trazo la banda sigue prohibida
  y un paralelo se cae igual en cuanto avanza un par de celdas. El arreglo vive en los dos
  gemelos, `construction-layout.js` y `src/game/community.php`, y los dos lo comprueban en
  negativo.

## Datos pequeños y responsabilidades claras

La presentación táctil arranca con `pointer: coarse`, ausencia de `any-pointer:
fine` y `maxTouchPoints > 0`. El HTML trae joystick/turbo ocultos para evitar un
destello en escritorio. Después manda la entrada real: Pointer Events de tipo
touch muestran el joystick; ratón/lápiz o teclado de juego lo ocultan. No se usa
`ontouchstart`, detección de modelo ni listeners `once`. Los MouseEvents de
compatibilidad no se escuchan; el movimiento de ratón mientras hay dedos
apoyados no interrumpe el control. Escribir/componer en formularios tampoco cambia
el modo. Los cambios de capacidades solo corrigen la estimación antes de la
primera entrada observada. Las consultas son una ayuda, nunca una identidad del
dispositivo ni una garantía infalible de hardware.

| Módulo/dato | Responsabilidad |
| --- | --- |
| behaviors/*.json + rules.js | Reacciones y recetas declarativas; sin ramas por misión en interact |
| resource-nodes.json + resources.js | Registro estable de recogidas; un bit por nodo y ciclo por región |
| cat-encounters.js | Visión, cobertura, patrulla, persecución, transporte y salida segura locales |
| world-controls.js / input.js / map-gestures.js | Joystick y turbo simultáneos, prioridad del diálogo, teclado y cámara; sin distinguir dispositivos |
| input-modality.js | Estimación inicial conservadora y selección dinámica de entrada real, sin user-agent ni estado persistido |
| navigation.js / journey.js / movement.js | Rutas compartidas simplificadas, intención persistente y colisión por subpasos |
| river-navigation.js / river.js / docks.js | Casco/corrientes, navegación y umbrales direccionales derivados de cada muelle |
| river-course.js | Márgenes dibujados mediante puntos [y, izquierda, derecha]; curva monótona compartida por agua, física y corrientes |
| river-life.js | Barquitas ambientales y cañas de pescadores; sin eventos, colisiones ni progreso simulado |
| construction.json | Costes, conocimiento, superficies, huellas, vistas, capacidades y zonas |
| construction-layout.js | Previsualización pura, paridad con el validador PHP |
| material-account.js | Cola durable de comandos, reconciliación y recuperación, sin subir saldos |
| community.js | Snapshot compartido, colocación y confirmaciones de API |
| ambient-activities.js | Reservar puntos de actividad y escogerlos por capacidades, no por mueble |
| cloud-save.js | Posición/progreso privado, conflictos y archivos de recuperación |
| construction-ground.js | Dónde se puede estar de pie: una sola definición para el compilador y el navegador |
| tools/community-terrain.cjs | Límites, máscara de suelo, rincones prohibidos y anclajes de paso, compilados desde la pantalla real |

Ramitas/hojas son contadores, no millones de instancias con ID en inventario.
La ramita del suelo sí tiene un nodo estable: desaparece al recogerla y renueva en
el siguiente ciclo diario. Plantas de hojas conservan su planta y renuevan cada dos
minutos; conchas cada cinco horas. La cosecha usa tiempo del servidor al sincronizar.
Hay doce palos colocados deliberadamente: cuatro en el bosque inicial y dos en
cada uno de los cuatro tramos recolectores del río. No hay esparcimiento aleatorio.
Palos y culilimpias se añaden desde la galería Recogibles del Studio; al incorporar
el diff se registran sus IDs sin reordenar bits de partidas existentes.
[Contrato de autoría](../data/aventura/REFACTOR.md#recogibles-en-el-studio).

Definiciones estáticas se comparten; un objeto persistido guarda únicamente tipo,
variante, media-tile x/y, orientación, vértices si es un trazado, autor, revisiones y
agregados sociales. No se duplica su imagen, coste o árbol de comportamiento. Historial
aparte, nunca enviado en los snapshots normales. Máximos actuales: 24 objetos por autor
y por pantalla, más un techo por pantalla que sube con su tamaño (320 el bosque, 240
cada río; 96 por defecto para una zona que no lo declare).

IA ambiental: máximo tres vecinos activos en tareas, un cálculo de ruta cada medio
segundo y reserva de plazas. Solo quien ya tiene poses de sentarse las utiliza;
los demás conversan/cuidan rincones sin inventar sprites. Los NPC no gastan tus
recursos, no fabrican reputación y no producen eventos de red. Ampliar acciones
futuras significa añadir una capacidad con animación, no un if por cada mueble.

## Arte y rendimiento

Cinco gatos originales de ocho direcciones; hojas registradas, no cinco GIFs DOM.
Cada dirección camina con cuatro fases independientes, no una fase intermedia
repetida. El paso depende de distancia recorrida, no de la tasa de refresco.
El traslado busca un punto seco a 880–1240 píxeles del gato: cinco veces el radio
anterior de 176–248. El plazo depende de la ruta, con dos reintentos si un vecino
la bloquea y salida segura si deja de ser transitable. No se alarga un temporizador
dejando al jugador atrapado. La búsqueda es acotada y no envía eventos al servidor.
Al soltarlo se separan ambos cuerpos sobre suelo transitable. El gato gira y
vuelve a su hogar a 76 px/s, sin volver a perseguir durante ese regreso. Si cambia
la ocupación, reintenta la ruta con las mismas colisiones usadas para caminar;
no abandona el regreso quedándose inmóvil lejos de casa. Las cuatro fases de paso
avanzan cada nueve píxeles recorridos. El registro offline compensa el pequeño
desplazamiento del torso, sin deformar ni inmovilizar las patas.
Ascua tiene la pose específica colgante. Sus maestros y prompts quedan en
`data/aventura/art/cats/`; `scripts/prepare-adventure-cats.php` prepara alfa/celdas
localmente conservando originales. Los primeros intentos descartados no se exportan.
Los remos de madera regalados por Brizno están también en la barca vacía y las
32 poses de navegación; maestros, referencias y prompts exactos en
`data/aventura/art/river/catalog.json`. Se retienen los maestros anteriores.
Se mantiene **2x con reducción integrada**, movimiento selectivo y sutil.

Se conservan los cien NPC existentes y el arte de rodar, sin cargarlo en el juego.
El experimento antiguo importa su copia archivada del controlador, no el runtime.
Los packs se piden por escena/acción, las escenas preparadas se limitan a cuatro,
el terreno por chunks visibles y los gatos a ocho por escena. No se descargan
maestros, se escanean imágenes fuente ni se manda movimiento al servidor.

Los cinco márgenes principales usan perfiles propios, no una onda repetida.
Se alinean en ambos extremos a 32 tiles de anchura, con centro en x=48 y tramos
rectos de enlace. El contrato de navegación y pruebas de casco
comprueban que se puede remontar por un remanso sin cruzar tierra ni saltar paredes.
Las zonas siguen siendo lugares grandes, no pantallitas de una sola curva.
Las estelas son líneas que siguen la corriente física: no llevan puntas de flecha.
Pescadores y barquitas de nuez son ambientación local, no otros jugadores en vivo.

## Studio y expansión

Un único workspace local, sin editar producción: http://127.0.0.1:47832/#map.
Escala continua 25–300% en elementos admitidos; las colisiones escalan con ellos.
Puertas/actores protegidos conservan restricciones. Galería con cinco variantes
de gato, tres de valla, cuenco/piscina y el repertorio anterior. Caminos, posición,
crop y colisión siguen pasando por diff, validación y rebase; no se borran cambios
del usuario para actualizar la base.

Para otra construcción: definición, arte/familia, coste/conocimiento, huella,
superficie y capacidades; pruebas JS/PHP; nuevo arte solo si aporta algo. Para otra
aventura: reglas y desbloqueo individual, no modificar interact(). Para un molino:
primero diseñar una aventura y anclajes RIVER_EDGE reales. El esquema admite
superficies; esta entrega solo publica construcciones de suelo firme. No fingimos
que ya exista toda la futura rama mecánica, pesca, comercio o reputación avanzada.

Seguridad, límites, migración y operación: [GAME-SAVE-API.md](GAME-SAVE-API.md).
La autorregulación social es una dirección de diseño; las modificaciones ajenas
siguen cerradas en esta primera entrega hasta tener evidencia para abrirlas.
