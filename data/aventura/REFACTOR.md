# Contratos de la aventura

## Alcance

Solo /aventura y sus traducciones. La web normal, sus URLs, SEO, formularios,
consultas y permisos siguen independientes. Local exclusivamente; no producción.
El concurso y el admin están fuera de esta adaptación.

## Responsabilidades

| Pieza | Responsabilidad |
| --- | --- |
| catalog.json | Objetos, banderas, zonas de contenido, tarifas y recompensas |
| scenes/*.json | Geometría y colocaciones; se descubren por archivo, sin lista PHP fija |
| behaviors/*.json | Reacciones, acciones y visuales reutilizables de cada aventura |
| world.php | Compilador de datos: compone comportamientos y valida destinos/tarifas |
| adventure-geometry.php | Umbral y llegada compartidos entre mapas e interiores redimensionados |
| assets/*.json | Un módulo de arte por personaje, edificio o familia de elementos |
| locales/*.json | Un catálogo completo por idioma |
| rules.js | Evaluación pura de condiciones y propuesta atómica de estado |
| timers.js | Plazos reales declarativos por nombre; validación, caducidad y efectos atómicos |
| economy.js | Monedero de prueba, tarifas, límites y recompensas únicas |
| scenes.js | Preparar escenario y recursos antes de confirmar un viaje |
| sprites.js | Manifiesto, cargas deduplicadas, caché acotada y dibujo de sprites/iconos |
| terrain.js | Suelo y puentes, chunks nativos con caché LRU |
| water.js | Ondas suaves solo en agua visible, fuera de la caché del terreno |
| sequence.js | Línea temporal finita con RAF, sin temporizadores adicionales |
| river-navigation.js / river.js | Física del casco, corrientes, remado, atraques y conexiones; sin tarifas |
| homestead-layout.js / homestead.js | Parcela única, stock, accesos protegidos y edición; visitas de solo lectura |
| river-neighbors.js | Direcciones públicas en embarcaderos; sin presencia ni polling |
| cloud-save.js | Guardado API con revisiones, reintentos idempotentes y recuperación |
| needs.js | Plazos reales, prioridad, consumo atómico y trazas temporales validadas |
| self.js | Panel Yo y presentación del alivio, sin reglas de inventario duplicadas |
| renderer.js | Profundidad, cámara, personajes, iluminación y ambiente |
| entity-art.js | Transformaciones y capacidades compartidas por juego/editor; ancla, dibujo e hit-test |
| experience.js | Opción B, galería y controles; medios/comercio conservan sus motores |
| geometry.js | Tile, huella común, costas, agua y operaciones geométricas puras |
| placement.js | Vegetación determinista y exclusiones de las colocaciones manuales |
| navigation.js | A*, conexiones desde posiciones entre celdas y comprobación de tramos |
| model.js | Modelo de escena, terreno estático y ocupación por entidades |
| movement.js | Subpasos, contacto y distancia realmente recorrida |
| characters.js | Ocho orientaciones y fase de pisada |
| save.js | Un registro local estable y validación del estado actual |
| inventory.js | Saco, monedero visible y objeto seleccionado |
| neighbors.js | Autores sin duplicados y visitantes ficticios |
| rooms.js / site.js / media.js | Zonas, ciclo de vida de fichas y único reproductor |
| input.js | Prioridad modal/diálogo/mundo, teclado y doble clic/toque sin detectar dispositivo |
| locomotion.js | Voltereta finita, orientación fija, impulso independiente del frame rate |
| pickups.js | Animación de deltas ya confirmados hacia el saco, sin modificar estado |
| dialogue.js | Interpolación declarativa de precios y premios |
| game.js | Coordinación, sin decisiones por ID de misión |
| api.js / API documentada | DTO JSON del backend independiente; sin capturar HTML ni CSS de la web |
| tools/adventure-studio | Composición local, una única propuesta, snapshots y exportaciones; nunca aplicación en vivo |

## Una aventura es un dato, no una rama del motor

La escena coloca una entidad y referencia un comportamiento:

```json
{"id":"picnic-neighbor","behavior":"picnic-neighbor","x":22.5,"y":69.5}
```

El comportamiento vive en `behaviors/picnic.json`. Puede usarse en otra escena sin
copiar su lógica. La colocación puede ajustar sprite, cuerpo o destino. Un atraque
comparte `river-dock` y referencia un punto de `navigation.landings`. La barca
amarrada se deriva de ese punto y usa `interactAs` hacia el atraque.
El compilador valida que exista, tenga reglas y no cree cadenas de referencias.

Las reglas se ordenan por prioridad. Se aplica la primera que coincide.
Acción por defecto: `interact`; también puede ser una lista como `["cook","use"]`.

- `when.flags`: igualdad de booleanos.
- `when.items`: cantidades mínimas.
- `when.maxItems`: cantidades máximas (cero significa no llevar ese objeto).
- `when.timers`: booleano: el plazo está activo (`true`) o ya venció/no existe (`false`).
- `when.using`: objetos aceptados al usar algo del saco.
- `when.navigation`: modo `foot` o `boat`; el efecto `navigation` prepara el embarque.
- `when.landing`: atraque actual; evita que una barca aparezca en varios muelles a la vez.
- `when.funds`: referencia a tarifa en el JSON fuente; el compilador la resuelve
  a un mínimo numérico, utilizable por cualquier evaluador de condiciones.
- `hiddenWhen`, `visibleWhen`, `solidWhen`, `interactWhen` y `visuals` reutilizan condiciones.
  `interactWhen` permite que la mesa deje de remitir al mechero una vez recogido;
  la mesa mantiene su cuerpo, aunque ya no tenga una interacción.
- `actions`: botones al final del diálogo. Una acción con `fare` muestra el precio
  desde el catálogo; no repite importes en seis traducciones.

Efectos de estado: `flag`, `item`, `reward`, `spend`, `timer`.
El efecto `timer` referencia `catalog.timers[nombre].hours`; guarda una fecha absoluta
por nombre, nunca un historial. El evaluador permite `context.now` en pruebas.
`expireTimers` poda plazos vencidos en el ciclo del juego, refresca colisiones/UI y
marca el guardado: no hay polling de servidor ni un intervalo por personaje.
Brizno usa `picnicFed` para recordar la primera entrega y `timers.picnic` para la
saciedad actual. Son estados distintos: volver a tener hambre no trae a los humanos.
Recoger/cocinar consulta cantidades, no banderas permanentes de ingrediente.
La segunda entrega reinicia cinco horas sin volver a cobrar la recompensa inicial.
Efectos de presentación: `dialogue`, `sound`, `travel`, `content`.

```json
{
  "action":"give",
  "when":{"items":{"skewer":1},"flags":{"picnicFed":false}},
  "effects":[
    {"type":"item","item":"skewer","amount":-1},
    {"type":"flag","flag":"picnicFed"},
    {"type":"reward","reward":"picnic"},
    {"type":"dialogue","key":"picnicThanks"}
  ]
}
```

`planReaction` devuelve una propuesta y no modifica el estado recibido. Desconocer
una bandera, consumir una herramienta reutilizable, superar límites, repetir una
recompensa única o gastar sin fondos anula toda la operación. No hay medias recetas.

Si hay viaje: preparar destino → cargar sus paquetes → presentación opcional → confirmar estado y escena.
La interacción queda bloqueada durante esa preparación. Un error conserva inventario,
saldo y posición; se permite reintentar. No se cobra antes de saber que se puede entrar.
Cambiar de escena conserva el punto de regreso por la misma puerta.
`travel.presentation` referencia `catalog.transports`; no se decide por ID de misión.
La barca usa una secuencia finita de RAF y el mismo casco que el embarcadero.
`boat-art.js` dibuja a ambos personajes en asientos definidos por datos, con recorte
bajo la borda; no hay un actor jugable independiente dentro del casco.
Movimiento, voltereta, acciones y saco quedan bloqueados hasta terminar.
Recargar a mitad no cobra: el plan no se ha confirmado. La pestaña oculta suspende
la presentación; no hace avanzar un barco invisible mediante timers.
El ancla del casco fija la línea de flotación durante toda la presentación.
No se guarda una secuencia incompleta.

## Monedero local, no reputación de la web

`economy.scope = local-preview`. La UI lo dice expresamente. El saldo no viaja a
`awardSetines`, `users` ni `setines_transactions`. El estado local es manipulable;
no es una prueba de haber ganado dinero y no debe emplearse para autorizar SQL.

Las tarifas tienen un único origen: `economy.fares`. Una recompensa puede declarar
un importe fijo o una referencia `fare` con `trips` entero positivo (por defecto 1).
Picnic paga dos trayectos; conchas paga uno. `dialogueTokens` referencia esas mismas
definiciones para interpolar `:price` y `:reward`, sin importes ni misiones en el motor.
El monedero guarda únicamente `{balance, claimed}`. No hay revisiones, premios
compensatorios ni referencias a misiones concretas dentro de `economy.js`.
`once` marca premios únicos y `wallet.claimed` impide reclamarlos otra vez.
Las conchas son repetibles porque se consumen al entregarlas y reaparecen sin llenar
un historial de eventos. Solo se guardan saldo, cantidades y premios únicos acotados.

La conexión a cuentas reales queda pendiente de una decisión de producto: los setines
actuales son reputación. Si se adopta una moneda gastable real, se necesitarán
validación de acción, transacción y débito atómico en servidor, autenticación,
idempotencia y reglas explícitas para anónimos. Nunca confiar en el cliente.

## Necesidades: tiempo de pared, no eventos

`catalog.needs` reúne plazos, duraciones, objeto de limpieza y límites de trazas.
`needs.js` es puro; permite inyectar hora y azar para probarlo sin modificar el reloj.
Guarda únicamente `{last,due}` por necesidad. Valida rangos y conserva fechas vencidas:
una recarga no sortea plazos ni acumula necesidades atrasadas.
`needStatus` devuelve un solo estado, dando prioridad a cagar. Al cagar se reinician
ambos relojes; al mear solo el suyo. Se valida al iniciar y se confirma al terminar;
si durante una meada vence el plazo de cagar, la meada termina sin aplazar esa caca.

`self.js` controla el diálogo nativo y una secuencia de poses del protagonista.
No cobra al botón: al completar, `completeRelief` devuelve otro estado con el plazo,
el consumo de una hoja si corresponde y la marca; se refresca el mundo y se guarda.
El motor no contiene condiciones por planta o misión para esta mecánica.
`behaviors/leaves.json` reutiliza recolección ordinaria, límites y feedback del saco.

Trazas: `{kind,scene,x,y,expires}`, máximo 48. Validación de escena, coordenadas y TTL;
lo vencido no se dibuja y se poda al cargar o confirmar una acción. No colisiones,
historial de eventos, polling ni escrituras a SQL. Todo manipulable localmente,
inadecuado como prueba de una recompensa económica real.
Los nuevos plazos se persisten al inicializar, aunque el usuario no llegue a moverse.
No se expone una API mutable de depuración en el cliente publicado; la vista manual
de QA usa un perfil desechable con un guardado preparado.

## Paquetes gráficos y memoria

Cada JSON de `assets/` produce un PNG y metadatos independientes. Hay paquetes por
familia de elementos y por personaje; las animaciones se expanden desde una plantilla de cinco
vistas y cuatro poses. Añadir otra casa no obliga a editar un atlas monolítico.

El manifiesto asocia nombres de sprite con paquetes. El preparador deriva necesidades
de entidades, variantes visuales, vegetación, puentes, vecinos, saco y actores especiales.
Carga las poses completas de los personajes presentes. Los objetos del saco son un
paquete pequeño compartido, incluso cuando se cambia de escena.

Los nombres contienen un hash de PNG + metadatos. Una modificación no invalida
paquetes ajenos. Las cargas concurrentes del mismo paquete se deduplican y los fallos
no envenenan la caché. Solo se confirman escenas con recursos completos.

Memoria acotada: cuatro modelos de mundo; 24 chunks de suelo; paquetes activos más
caché caliente (máximo de 12 o activos + 2). Un paquete activo nunca se expulsa.
Los originales no están bajo public/ y no se procesan en el navegador.

Actualmente el catálogo de geometría de seis escenas es pequeño y se entrega en el
HTML; los gráficos ya son diferidos. Si crece a decenas de escenas, el siguiente paso
es cargar también sus JSON a través del mismo preparador, no añadir ifs al motor.

## Geometría y composición

Tiles de 16 px. El ancla de pies es compartida por dibujo e hit-test.
El módulo gráfico puede declarar un `anchor` propio (por ejemplo, línea de flotación).
`entity.offset` desplaza solo dibujo e hit-test, en píxeles nativos, no el cuerpo:
así el mechero se ve encima de la mesa pero se recoge desde el borde transitable.
Cuerpos estáticos discretizados y vecinos pequeños móviles. `FOOTPRINT` define
una única huella de 12 × 10 px para protagonista y vecinos, más 2 px de margen
frente al agua. No se decide por el centro de una casilla: se comprueba el perímetro
de los pies contra la geometría continua. Una fase geométrica conservadora evita
comprobar cada punto cuando toda la huella está claramente en tierra.
El movimiento se
subdivide para no atravesar objetos y las patitas avanzan por distancia, no por reloj.

Las puertas declaran `portal:true`; el compilador deriva su umbral y la llegada.
Las barcas no son puertas: requieren confirmar un pasaje. Un viaje en sus reglas
no convierte automáticamente una entidad en un portal gratuito.
Los umbrales interiores cubren todo el hueco visible hasta el límite transitable:
acercarse lateralmente por debajo del centro también sale. Cada subpaso del impulso
comprueba umbrales, evitando saltarlos. La voltereta no se guarda ni cruza escenas.
Al recalcular una ruta se omite el centro de la casilla inicial si el segmento al
siguiente punto es transitable; así un doble toque no hace girar hacia atrás.

`waters` son estanques cerrados; `rivers` son cauces; `baseWater + islands` define islas.
`coasts` define costas abiertas con `side: "east" | "west"` y puntos `[x,y]` ordenados
por Y ascendente. `coastX` interpola suavemente cada tramo y prolonga los extremos.
La misma curva pinta el agua y decide las colisiones: nunca duplicar una orilla
solo en el renderer. Los puntos deben cubrir la altura de la escena.

La máscara física estática contiene confines y troncos. `navigationTerrain` guarda
los centros donde cabe la huella completa; se calcula una vez por escena.
`refresh` solo superpone los cuerpos activos: coger una hoja no reconstruye el mapa.
A* comprueba también los tramos entre centros; desde el borde de una celda costera
puede conectar con un centro cercano seguro. Los vecinos móviles se comprueban
al desplazarse, no se estampan para siempre en la cuadrícula.
`bridges` crea suelo transitable sobre agua y usa un sprite, también para embarcaderos.
Render y colisiones emplean la misma geometría. El puente inicial nunca depende del hambre.
Las plantaciones y decoraciones son deterministas, contextuales y de densidad acotada;
las colocaciones importantes se excluyen de la vegetación aleatoria.

## Guardado y textos sin capas de prototipos

`SAVE_KEY` se declara solo en `save.js`: `magikitos.adventure`. Las pruebas y
herramientas de QA importan esa constante. El DTO actual contiene escena, posición,
entrada, banderas, inventario, monedero, música, necesidades, trazas y posiciones de objetos.
No hay campo de versión, lista de claves anteriores ni reposición de objetos de
misiones retiradas. `cleanSave` es validación de datos no fiables, no una migración.
Si la posición ya no es válida, se usa el punto inicial seguro de su escena.
Las partidas de QA deben empezar en puntos transitables, nunca dentro de un prop.

Cada idioma usa un catálogo plano. Una clave identifica una sola cosa: por ejemplo,
`fountain` es la etiqueta y `fountainWish` la frase. Un diálogo corto es un string;
varias páginas se escriben como un array explícito, nunca mediante separadores en
una cadena. `lines` resuelve las páginas y `dialogueText` sustituye precios/recompensas.
No hay fallback a diccionarios de nombres/frases antiguos. Los textos de las voces
publicadas no se reescriben: esta guía se aplica al reparto y la UI del juego.

En español: humor andaluz amable, «ea», «quillo» o «apañar» cuando encajen, sin
sobrecargar. Pistas concretas, una caja habitual, sin ordenar al jugador una misión.
En los demás idiomas se adapta la broma y el tono. Etiquetas y controles claros;
«Ok» cierra, «Embarcar» confirma un pago. Los tokens deben coincidir entre idiomas.

## Extender sin spaghetti

1. Crear o reutilizar módulos de arte en assets/; conservar originales y hornear.
2. Añadir escena o colocaciones, con entradas seguras y caminos despejados.
3. Declarar comportamientos, objetos, banderas, tarifas o premios en sus datos.
4. Traducir etiquetas, descripciones y conversaciones en los seis idiomas.
5. Probar órdenes alternativos, repetición, errores, retorno y recorrido real.
6. Revisar escritorio, tablet, móvil táctil y coste de los paquetes solicitados.

No introducir un lenguaje de scripting general sin una mecánica concreta que lo necesite.

## Contenido público y ciclo de vida

Cuentos junto a la hoguera, chistes en la taberna, expresiones en el libro del refugio de hojas.
Los demás vecinos solo conversan. Autores representados de forma diferida, sin sockets
ni polling. Selección del backend público mediante content pulse, sin duplicar consultas.

El endpoint solo adapta lecturas. Formularios, auth, votos y permisos conservan sus
motores originales. Una zona del cliente es una regla de juego, no una barrera de
seguridad para material público. No hay navegación de posición por URL.
`world:unmount` cancela tareas y listeners; `world:mount` inicializa la siguiente ficha.
Cerrar o caminar cancela solicitudes para que una respuesta tardía no vuelva a abrirla.

## Verificación

`check-adventure.cjs`: recorridos, ocho direcciones, paquetes, doce combinaciones de
recogida/encendido, transacciones, premios únicos, pasajes, regreso repetible y guardados.
`check-adventure-controls.cjs`: impulso en ocho direcciones y tres tasas de frames,
colisiones, umbrales por los lados, gesto doble y validación de saldo sin bonificaciones.
`check-adventure-geography.cjs`: huella compartida, orillas, costa sin retorno a pie,
puntos transitables secos, diagonales/volteretas, confluencia y clave única de guardado.
`check-world-controls.cjs`: teclado y puntero reales, prioridad de diálogo, barqueros,
ida/vuelta inmediata, recogida y layouts desktop/tablet/mobile/reduced motion.
`check-adventure-life.cjs`: plazos reales, prioridad, recolección, atomicidad, TTL,
ondas sutiles y secuencias con tres tasas de frames.
`check-world-life.cjs`: animaciones, bloqueo, interrupciones, ambos trayectos y layouts.
`preview-adventure-life.cjs`: Chrome desechable para jugar estas situaciones sin esperar horas.
`check-adventure-assets.cjs`: deduplicación, caché acotada, descarga diferida y reintentos.
`check-adventure-locales.php`: paridad, referencias y tokens de sustitución en seis idiomas.
`check-view-presentation.php`: captura, scopes anidados y limpieza de excepciones.
`check-world.cjs`: navegador local, incluyendo fallo provocado de carga y saldo intacto.
Detalles y límites de la verificación: [README.md](README.md).

## Presentación B y editor local

La experiencia nativa y la lectura detallada son dos presentaciones del mismo contexto.
El endpoint entrega una primera interacción pequeña, el cuerpo de lectura y, en las entradas
de catálogo, el primer destino sugerido por los datos existentes. La navegación de búsqueda
sigue abriendo catálogos; no redirige siempre a una pieza ni modifica la URL de aventura.
El contexto de audio se construye una vez y se comparte. La voz solicitada se selecciona
exclusivamente entre las voces públicas cargadas por el controlador, manteniendo la atribución.

`WorldSite` conserva los nodos de la experiencia al entrar en lectura, no reproduce páginas
completas como primera pantalla. Desmonta/monta componentes al cambiar de presentación.
`WorldMedia` sigue siendo propietario del único audio: la galería, el texto y la cámara no reinician
su reproducción. El minirreproductor aparece al salir al mundo. Las áreas de contenido declaran
`focus` por ID de entidad; los expositores enfocan su producto.

El studio reutiliza Renderer, World, SpriteLibrary y geometría, sin instanciar Adventure,
sin jugador, device ID, cuenta, eventos ni almacenamiento de partida. Su única propuesta vive
fuera de public y no se aplica automáticamente. El contrato de diff valida antes/después y
la base por hash; el revisor es solo lectura. Véase [su documentación](../../tools/adventure-studio/README.md).

La colocación explícita opcional `scene.scenery` evita regenerar todo el bosque al recolocar
entidades en una propuesta del studio. Sin ella, se mantiene el generador actual.
Dibujo, hit-test y colisiones usan el mismo ancla, reflejo, escala y giro; el editor solo ofrece
transformaciones compatibles. Los chunks se alinean en píxeles de dispositivo para no abrir
costuras al ampliar. El juego conserva su caché de 24 chunks; el editor admite 128 al ver el mapa completo.

## Woodland family and movable-object contract (current)

See [WOODLAND-KIT.md](../../docs/WOODLAND-KIT.md) for the reviewed art pipeline,
family/variant grammar, source metadata, crops, organic room footprints and tests.
`elements.js` resolves visuals for both game and Studio; `movables.js` owns pushing,
position validation and local persistence; `obstacles.js` owns contact release and
small-prop edge assistance. `room-shape.js` defines the shared physical/visual floor.
`ambient-actors.js` adds restrained native gestures without moving physical bodies.
No mission-ID branch, DB write or generic scripting language was added.
# Ascua additions · current contract

Presentation remains separate from state. A rule may emit a `presentation` effect
with `sequence: work|toss|discover`, duration, props/result or sprite. The generic
`Presentation` module stages art, plays the foreground `Sequence`, and releases its
temporary pins. It cannot mutate inventory or wallet. `Game.interact` commits the
pure reaction plan only after preparation/animation; discovery is derived from
positive inventory deltas. Recipe-specific branches do not belong to the renderer.

`keepsake` effects increment a scene/entity counter only for authored containers.
`cleanKeepsakes` bounds and validates saved counters; deterministic points place
small sprites inside the declared bowl ellipse. Fountain `enabledWhen` is a UI
affordance only: rules independently validate funds before spending. The existing
local wallet remains the only source of game money; no server events or account
ledger writes are added.

Texture `pixelRatio: 2` is independent of native/logical size. Rendering and
Studio crops share this contract. `ink` is the visible logical rectangle used for
icons/portraits. Explicit actor frame definitions replace implicit mirrored rows.
Pushing resolves actual movement at `PUSH_SPEED_RATIO`, including saved object
coordinates and collision substeps; presentation never moves a physical object.
