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
4. Tres regiones de río, cada una una celda entera de la rejilla (192 × 144 tiles desde el
   20-sep-2026, con bosque nuevo por el oeste), con orillas explorables, desembarcos,
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
   No son visitantes conectados en tiempo real. Detalle en «El almacén del constructor», más abajo.

## Controles y construcción

- Clic/toque en suelo: caminar/correr hasta allí, rodeando obstáculos sin activar
  conversaciones. Clic en objeto: acercarse y realizar esa interacción.
- Flechas/WASD: movimiento directo. Espacio sostenido: correr o remar más rápido.
  Espacio o clic en el diálogo: siguiente; el último mensaje se cierra al tocarlo.
  Enter/Escape: cerrar. Clic fuera: solo cerrar, sin caminar ni activar otro control
  con ese gesto. No hay botón «Ok». **No hay rodar**.
- **EL MANDO ES UN JOYSTICK INVISIBLE QUE NACE DONDE APOYAS EL DEDO** (19-sep-2026,
  decisión del dueño, tercera y definitiva del día). Por la mañana se fue el joystick
  fijo de la esquina («es una mierda, no me gusta nada, ni el botón de turbo»); a
  mediodía, el «arrastrar el mapa lleva al duende al centro» («no permite navegación
  continua»); y por la tarde, probado en producción, el «mantener el dedo guía hacia
  lo que hay debajo» («con nada que me alejo ya se pone a correr», «para ir arriba el
  dedo tiene que estar muy arriba»). Lo que hay: apoyas el dedo en CUALQUIER sitio,
  lo mueves más de la holgura de toque (8 px) y el protagonista va en esa dirección,
  exactamente como una flecha del teclado: el vector entra por `directionIntent` y
  comparte con las teclas colisiones, empujes, charlas al chocar, costuras y remo.
  Umbrales en píxeles de PANTALLA, para que el zoom no cambie la sensación: zona
  muerta de 10 y aro de 100. **Con el dedo se anda y punto**: cerca o lejos, la
  distancia no es la marcha (aquí vivió medio día un borde donde se corría, y el
  dueño lo quitó: «esté cerca o lejos el dedo, eso es andar»); correr queda para
  Espacio y para el toque lejano. Soltar para, como soltar una tecla; para viajes
  largos ya está el toque, que sigue igual: pulsar sin mover y soltar es tocar e
  interactuar, dure lo que dure la pulsación. Vale igual con dedo, ratón (botón
  izquierdo) o lápiz, sin preguntarle al navegador qué tienes en la mano.
  **El origen sigue al dedo.** El joystick que se centra donde tocas y obliga a
  levantar para recentrar es el que la gente odia (arrastran el dedo por toda la
  pantalla y nunca lo sueltan). Pasado el radio, el origen se arrastra detrás del
  dedo: ir a la izquierda y volver hacia la derecha se nota al instante sin levantar.
  **La cámara se queda pegada al duende**, sin adelanto ni destino: `cameraGoal` solo
  viaja al sitio de un toque o al foco de construir.
  **Cruzar no suelta el dedo.** El gesto sobrevive a la escena (`keepPointerGesture`
  llega hasta `scenes.enter`) y al otro lado `directionIntent` lo lee igual, como una
  tecla que sigue pulsada.
  **Y cruzar no se ve** (19-sep-2026, [mundo continuo](MUNDO-CONTINUO.md)): las
  pantallas exteriores están pegadas en un plano, la vecina se pinta al lado antes de
  pisarla, la llegada es el mismo punto del bosque, la cámara viaja con el duende y no
  hay aviso. Lo que no es ninguna pantalla se pinta como continuación del borde más
  cercano, y un toque en la pantalla de al lado es un viaje que cruza la costura y
  termina allí.
  **El aro se ve siempre que el dedo manda.** El lienzo pinta un aro tenue donde
  lo apoyaste, una bolita donde está y, dentro del aro, una porción casi transparente
  («pizza slice», un octavo de vuelta) que apunta a donde manda (`renderer.stickHint`,
  sin DOM): enseña que el mando nace bajo el dedo, hacia dónde va y, cuando el origen
  se desliza detrás, que no hace falta levantar para virar; al soltar desaparece. Aquí vivió un contador que lo apagaba tras
  seis segundos andados, y se fue el mismo día (el dueño: «no lo quitaría cuando pasa
  el tiempo, que siempre salga, solo ligeramente más transparentito»).
  **El lienzo no se selecciona**: `user-select: none` y `-webkit-touch-callout: none`
  en el escenario, porque iOS trataba la pulsación larga como seleccionar texto.
  **Mientras hay conversación o narración no hay mando**: `openDialogue` pausa el
  movimiento, y una marca en la raíz (`data-world-retired`) pone a cero el hueco
  que el disco de recentrar tiene reservado abajo a la derecha.
  Los controles son los mismos a pie y en la barca. Soltar, cancelar o perder el
  foco nunca deja un control pulsado. No se simulan teclas desde el DOM.
- **La cámara es del duende y no se arrastra** (19-sep-2026, decisión del dueño:
  «quitaría también lo de desplazarse por el mapa; dejaría solo el zoom»). Dos dedos
  hacen ZOOM sobre el duende y nada más, aunque viajen por la pantalla; la rueda
  también; el botón derecho no hace nada, y el menú contextual del lienzo se anula. El
  segundo dedo suelta el mando (te has parado a mirar), y un viaje tocado sigue su
  camino. El zoom máximo es el que cubre la pantalla en la que estás, y la cámara se
  acota al plano del bosque ([mundo continuo](MUNDO-CONTINUO.md)), así que alejar
  nunca enseña nada más allá de los mapas. Aquí vivieron el paneo a dos dedos y el del
  botón derecho, y se fueron el mismo día que nacieron. La única excepción es
  construir: con la pieza en la mano un dedo, o el botón derecho, mueve el mapa para
  llevarla a su sitio, y el disco de recentrar aparece solo ahí.
- **No se dibuja ningún marcador de destino** (19-sep-2026, el dueño: «no quiero el
  puntito blanco placeholder de posición final, eso molesta»). Guiando saltaría por
  delante del duende varias veces por segundo; tocando, el sitio ya lo sabes.
- **Construir sin cuenta abre «Yo», no un aviso** (19-sep-2026, el dueño: «no
  simplemente decirle "tienes que guardar tu cuenta", sino mostrar el modal de Yo»).
  `community.begin()` pasa por `self.explain()` en los dos casos que tienen puerta:
  sin sesión, `communityNeedsAccount` («para construir en el mapa público tienes que
  tener tu cuenta creada») con la tarjeta de la cuenta resaltada; con sesión pero sin la
  partida guardada en la cuenta, `communitySyncNeeded` con la tarjeta de la partida y
  su botón. El aviso se pinta como llamada de atención encima de la puerta y el panel se
  desplaza hasta ella. Sin conexión o de visita sigue siendo un aviso flotante, porque
  ahí no hay puerta que abrir.
- **Los tres paneles grandes se rediseñaron el 19-sep-2026** (el dueño: «un diseño un
  poco cutre»). La modal HACE SCROLL ella misma con la cabecera pegada, que en
  escritorio y tablet recortaba el elenco, el correo de la cuenta y las últimas filas
  del catálogo sin manera de llegar; a pantalla completa solo en el teléfono (< 640).
  «Yo»: un cabecero con el retrato del elenco y una línea que dice si la partida te
  sigue o vive en este navegador, y dos columnas en escritorio (tu duende / tu cuenta,
  tu partida, idioma) en tarjetas con rótulo. El saco: iconos en cajas del mismo tamaño
  (`sprites.iconIn`, sin bloques ni gigantes), la cuenta en una chapa, y el detalle en
  columna fija a la derecha desde 900 px. Construir: el sitio como subtítulo, «Llevas»
  con nombre y número y SOLO lo que llevas (siete bolsitas iguales a cero no decían
  nada), precio en rojo en la baldosa cuando no te llega, y la barra con etiquetas de
  texto en escritorio e iconos en el teléfono.
  En exteriores se puede alejar hasta el límite geométrico de cobertura del mapa,
  sin un porcentaje mínimo artificial ni bordes vacíos; el encuadre inicial no cambia.
  Los interiores conservan su presentación de habitación recortada con exterior pintado.
- Caminar: 72 píxeles de mundo por segundo en móvil; aumenta suavemente hasta 84
  según el lado corto del área visible (480–960 píxeles CSS). No depende del zoom,
  los píxeles físicos ni la orientación del teléfono. Correr: 216. Remar/turbo: 82/205,
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

**Ya no hay detección de modalidad, y esa es la mejor parte del mando nuevo.** Aquí
se describía una estimación con `pointer: coarse`, `any-pointer: fine` y
`maxTouchPoints`, corregida después por la entrada real, para decidir si se pintaba
el joystick. Con el mapa de mando la pregunta desaparece: un dedo, un ratón y un
lápiz arrastran igual, así que no hay nada que adivinar, ningún destello que evitar
y ningún estado que pueda quedarse mal. `input-modality.js` y sus dos comprobaciones
se erradicaron enteros.

| Módulo/dato | Responsabilidad |
| --- | --- |
| behaviors/*.json + rules.js | Reacciones y recetas declarativas; sin ramas por misión en interact |
| resource-nodes.json + resources.js | Registro estable de recogidas; un bit por nodo y ciclo por región |
| cat-encounters.js | Visión, cobertura, patrulla, persecución, transporte y salida segura locales |
| input.js / map-gestures.js | Teclado, cámara y EL MANDO: el dedo es un joystick invisible que solo anda —arrastrar el mapa ya NO planta destino, se retiró el 19-sep-2026— y el toque suelto sigue yendo e interactuando |
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
Se alinean en cada costura a 32 tiles de anchura, con centro en x=112 (la rejilla del
20-sep-2026 desplazó los tres tramos 64 casillas al este) y tramos rectos de enlace; entre
costura y costura el cauce serpentea entre x=99 y x=116. La única excepción es la cabecera de
`river-roots`, que no tiene vecina por arriba y nace con anchura cero: es el manantial, no una
costura mal cuadrada. El contrato de navegación y pruebas de casco
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

Seguridad, límites, migración y operación: [API.md#save-protocol-and-server-authority](API.md#save-protocol-and-server-authority).
La autorregulación social es una dirección de diseño; las modificaciones ajenas
siguen cerradas en esta primera entrega hasta tener evidencia para abrirlas.

## El bosque se cuida solo (19-sep-2026)

Decisiones, reglas y qué medir: [AUTOMANTENIMIENTO.md](AUTOMANTENIMIENTO.md). En corto: **el
precio sube con lo pisado** (`densityMultiplier` en `construction-layout.js`, gemelo PHP con
paridad), **la bombita** se pone con la mano sobre una pieza ajena y la tenaza la desactiva
(`community.useTool`, `maintenance.js`), y **la hierba vuelve** por los extremos de los caminos
que nadie pisa (reloj de presencia de la zona, `steps` por tramo, hierba pintada desde la mitad
del presupuesto). Reglas puras en `maintenance.js`; pruebas `check-construction-density`,
`check-forest-overgrowth`, `check-forest-bomb`, `check-bomb-balance`.

### El almacén del constructor (19-sep-2026, decisión del dueño)

Una regadera humana antigua recuperada por los Magikitos, en el rincón nocturno junto al lago
de la pradera (`warehouse-door`, protegido en `construction.json` para que nadie tape su puerta).
Dentro, la escena `almacen`: un interior DIBUJADO (`interior.artwork`, el motor estampa la sala y
el contorno manda en la colisión), mostrador, expositores, sacos y **Cebolino, el constructor**
(`warehouse-keeper`, arte `warehouse-keeper-*`, una entidad con botones de trueque, no un
residente). **Todo se paga en setas, nunca en setines** (los setines son reputación):

| Trueque | Setas | Regla |
| --- | ---: | --- |
| Saco de gravilla (`gravilla` ×10, `bundle`) | 5 | tope 60 en el saco; el camino cuesta una gravilla por celda |
| Bombita | 6 | solo sin bombita en el saco |
| Tenaza | 2 | solo sin tenaza en el saco |

**Nada se regala** (20-sep-2026, decisión del dueño): la gravilla solo sale del trueque con
Cebolino, que atiende junto al mostrador (`interactAs` desde el mostrador), y fuera hay un cartel
(`warehouse-sign`) que dice quién vive en la regadera y qué cambia.

Las setas se cortan con cuchillo en el bosque y **rebrotan a las ocho horas** por jugador
(`harvest.renewMs`, regiones `harvest-*-28800000` en `resource-nodes.json`). Las vallas siguen
costando palitos; el resto de piezas, lo que ya costaban. Lo vigila `check-bomb-balance.cjs`.

## Arte y animación del picnic

Guía de autoría vigente; ubicaciones y recogibles están en las escenas.
Manta y comida son piezas independientes: tortilla, nachos triangulares,
guacamole, bebidas y altavoz. Navaja y mechero son herramientas; la botella del
suelo aparece junto a la papelera al cocinar la primera brocheta. Los humanos y
la manta desaparecen entonces; los utensilios no recogidos siguen disponibles.
El gato permanece y se suma otro. Brizno y la barbacoa están junto a su casa,
cerca del muelle. Recorrido y pistas: [SHARED-FOREST.md](SHARED-FOREST.md).

### Source art and prompts

Generated with the **built-in image_gen tool**, not CLI/API fallback. The original
project picnic sheet was the identity/style reference for the two human pose sheets;
the earlier knife illustration was the design reference for its readability edit.

**Exact prompts, input roles and every saved output path:**
[`data/aventura/art/picnic-polish/prompts.json`](../data/aventura/art/picnic-polish/prompts.json).

Seven isolated object masters are retained in `data/aventura/art/woodland-kit/`:
`knife-taramundi-readable.png`, `picnic-lighter-coral.png`,
`picnic-guacamole.png`, `picnic-potato-chips.png`, `picnic-lemonade.png`,
`picnic-orange-soda.png`, `picnic-speaker.png`.

Two four-pose masters are retained in `data/aventura/art/picnic-polish/`:
`picnic-smoker-poses.png` and `picnic-friend-poses.png`.
The earlier knife and picnic originals are also retained.

The owner-authorised local pipeline only prepares alpha/cutouts and native packing,
not a replacement design. Existing alpha is preserved; generated magenta mattes are
removed with the shared cutout helper. Source hashes accompany the prepared PNGs.
No source-resolution image is included in the static release.

### Animation contract

- `assets/picnic-humans.json` owns all eight frames in one scene-lazy package.
- `preserveCanvas: true` keeps a fixed source registration rectangle before native
  baking. Independent silhouette fitting must not resize or recenter each pose.
- Each actor uses one native size and anchor across all poses; atlas trimming adjusts
  the anchor without changing the actor's world position.
- `ambient-actors.js` declares durations, independent phases and the smoke interval.
  It chooses a frame from render time, without timers, canvas allocation or pixel readback.
- The idle lower body is clipped below an authored waist seam; the active upper pose
  is clipped above it using the shared `drawArtwork` native transform. This prevents
  tiny generated drawing differences from making seated feet slide.
- Reduced motion uses the still idle pose and no smoke. Collision never depends on
  animation. The previous manually shifted head/painted-mouth rig has been removed.
- The browser raster test checks **pixel-identical lower bodies** across every pose.

### Reproduce and inspect

```sh
php scripts/prepare-picnic-actors.php
php scripts/prepare-woodland-cutouts.php knife-taramundi-readable picnic-lighter-coral picnic-guacamole picnic-potato-chips picnic-lemonade picnic-orange-soda picnic-speaker
npm run art:catalog
npm run build
php scripts/review-picnic-art.php
npm run test:picnic-animation
npm run test:picnic
npm run install:local
```

QA output (untracked): `.local/picnic-review/native-art.png`,
`rendered-poses.png`, `animation-report.json`, `studio-gallery.png`.
Scene/device captures: `.local/woodland-review/picnic.png` and `picnic-mobile.png`.

Verificar con `npm test`, `test:picnic-animation`, `test:picnic` y `test:gallery`.
Resultados de publicación: [RELEASE.md](RELEASE.md).
