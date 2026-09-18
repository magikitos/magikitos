# Arte: fuentes y pipeline

Política vigente: [2× integrado y movimiento selectivo](../../docs/art-direction/DEFINITION-MOTION.md).
Maestros a buena resolución, texturas preparadas offline. Nunca descargar originales
ni escanear píxeles al arrancar. Textura 2× no duplica tamaño en el mundo: escala,
recorte y cuerpo físico son controles distintos.

## Fuentes de verdad

- [Kit del bosque](art/woodland-kit/prompts.json): casas, vegetación y muebles.
- [Pipeline y familias](../../docs/WOODLAND-KIT.md): alfa, anclas y variantes.
- [Ascua](../../docs/art-direction/DUENDES.md) y [cien NPC](../../docs/RESIDENTS.md).
- [Picnic](../../docs/PICNIC-POLISH.md): humanos animados y elementos de la manta.
- Gatos: `art/cats/`; botella, remos y río: `art/river/catalog.json`.
- Barca independiente: `art/river/vessels.json` y
  `php scripts/prepare-vessel-art.php`. Contrato vigente: **casco vacío sin
  asiento ni remos**; punto de encaje invisible dentro del hueco. El personaje
  nunca se pinta dentro del maestro de la barca: sus poses `row` incluyen el
  cuerpo sentado, pies hacia delante y los remos en las manos. El paquete vigente
  es `vessel-bottle` (8 vistas), con fondo cóncavo de plástico continuo: vacío
  de ocupantes/muebles, **no abierto por abajo**. El compuesto antiguo está retirado del manifest.
  Los maestros anteriores con remos/asiento se conservan fuera del atlas.
- Seguimiento de protagonistas y auditoría de arte pendiente:
  [ART-DUENDES.md](../../ART-DUENDES.md).
- [Prompts anteriores](ART-PROMPTS.md): procedencia, no guía para reintroducir
  mecánicas o diseños descartados.

`assets/*.json` define los módulos. `bake-adventure-atlas.php` genera paquetes
con hash y metadatos de ancla/recorte. El manifest decide qué se sirve: conservar
un maestro o pose archivada no obliga a descargarlo. No sustituir maestros por
sus derivados ni borrar la biblioteca NPC. Cambiar familias en
`element-families.json`, ejecutar `npm run art:catalog`, revisar diff y `npm test`.
Los prompts específicos viven junto a su colección, no en informes de entrega.

## Composición de navegación

`rowing.json` separa dos contratos, en coordenadas lógicas relativas a la pelvis:

- **Barca / vista:** `rim` recorta el cuerpo con el alfa real del borde delantero;
  `farMask` oculta el remo lejano al pasar detrás del casco. `far` identifica ese
  remo (0/1, o `null` si ambos quedan a los lados). Son datos de la barca, no del
  personaje. Ambas máscaras se intersectan con el alfa del casco: sus esquinas
  vacías no borran remos que están fuera del casco. Los ocho puntos de encaje
  se registran offline en `vessels.json`; `rowerScale` y `rowerOffset` ajustan el
  ocupante alrededor de su pelvis, sin alterar ni duplicar el maestro del remero.
- **Personaje / vista / fase:** dos remos completos en la imagen y sus puntos
  medidos `[manoX, manoY, puntaX, puntaY, radio, largoPala]`.
  Son coordenadas del remero **antes** del ajuste de la barca. El extremo sumergido se recorta
  durante las fases activas; nunca se borran palas del maestro para encajarlas.
  `player-art.json` relaciona cada personaje habilitado con su rig medido.
  `bodies[rig][vista]` protege la silueta del ocupante cuando el remo lejano
  pasa por detrás de su cuello/torso. Es un polígono medido del personaje, no
  una excepción por nombre ni una máscara de la botella.

La orientación de los remos se revisa aparte del recorte: de perfil, uno queda
en primer plano y otro al fondo, **no uno a proa y otro a popa**. En subida
diagonal, cuerpo, piernas y remos comparten la perspectiva trasera de tres
cuartos. El remo lejano no puede saltar al lado cercano durante el ciclo.

`vessel-art.js` pinta casco → personaje con oclusión → contacto con el agua.
El remo cercano se excluye de la máscara del borde, sin repintar el personaje
ni acumular su alfa. El lejano usa la máscara de la vista y el alfa del casco.
Esa oclusión excluye el interior de `bodies` mediante un `Path2D` invertido:
una línea proyectada detrás del cuerpo nunca corta su cuello. La inmersión
protege ese cuerpo también y sigue el lado de la punta, incluso cuando el remo
lejano se proyecta hacia arriba en pantalla.
La inmersión corta la punta completa con una línea de agua nítida, no una elipse
semitransparente encima de parte de la pala. El alfa del casco se resta también
de la máscara de inmersión y de las pequeñas ondas: **nunca agua sobre el casco**.
Las fases 0/3 quedan secas; 1/2 sumergen progresivamente la pala. La inmersión no
afecta a cabeza, manos ni torso. La imagen completa
del remero sigue siendo reutilizable con otro casco.

Dos superficies auxiliares fijas 2× de **512 KiB en total**, compartidas por todos los remeros,
evitan crear texturas para cada combinación personaje×barca. Los `Path2D` se
cachean por paquete decodificado y se liberan con él (WeakMap). No hay lectura
de píxeles ni extracción de alfa durante el juego. El presupuesto de sprites
sigue siendo independiente de los lienzos. Visibilidad y recorte consideran
el rectángulo conjunto del casco y personaje, no solo su cuerpo.

Para añadir una barca: maestro de casco vacío, ocho anclas, ocho máscaras,
prefijo/paquete y parámetros de inmersión. Para añadir un remero: hoja de 32
poses con ambos remos, registro de pelvis estable y puntos de cada pala. No
añadir condiciones por nombre al motor. Revisar las 32 composiciones reales
antes de habilitarlo, incluyendo las diagonales y ambas vistas de perfil.

La flota de reserva se registra igual que la botella, pero `defaultVessel` sigue
siendo `bottle`: no añadir objetos, recetas ni desbloqueos por preparar un casco.
Cada paquete `vessel-*` contiene solo ocho vistas y se carga cuando se solicita,
no al entrar en el juego. `vesselLayers(actor, fase, id)` compone cualquier casco
registrado sin volver a generar el remero. La selección pública y persistente de
barcas no forma parte de esta preparación de arte.

Para revisar un casco reservado sin modificar la partida ni el valor por defecto:

```sh
node scripts/check-vessel-browser.cjs --variant=100 --vessel=willow --label=willow
node scripts/check-vessel-browser.cjs --variant=100 --vessel=willow --browser=webkit --label=willow-webkit
GAME_VESSEL=willow node scripts/check-rowing-motion-browser.cjs
node scripts/check-vessel-fleet.cjs --variant=100 --motion
```

`GAME_VESSEL` solo existe en la herramienta de revisión: recompila el dato del
casco por defecto en una página de prueba aislada, con el motor real sin mocks de
movimiento/render. Nunca modifica el artefacto instalado ni una partida real.

Una corrección parcial se declara como `overrides` dentro de la hoja de acción
en `art/residents/actions/catalog.json`: fuente/prompt/hash propios, `grid`,
`directions`, recortes y anclas medidos. El horneado sustituye exclusivamente
esas poses existentes en **el mismo paquete**. No añade peticiones ni lógica
de parches al cliente. `--sheet` incluye sus correcciones automáticamente;
rechaza direcciones desconocidas/repetidas y conserva las demás definiciones.
Brezo alba mantiene `row-long-clean` para las cuatro vistas aprobadas y usa
`row-perspective-clean` solo en `right`, `up-right`, `up-left`, `left`.

Pruebas: `check-vessel-art.cjs` (fuentes/anclas), `check-rowing-contract.cjs`
(personajes completos y máscaras válidas), `check-vessel-browser.cjs` (píxeles,
oclusiones y memoria auxiliar), `check-river-browser.cjs` (juego real en tres
pantallas). El chequeo de píxeles solo existe en la herramienta de revisión.

Revisión de cada nuevo protagonista:

- `php scripts/review-resident-action.php --variant=101 --action=row --source=… --registration=…`
  permite probar anclas medidas desde un JSON de trabajo sin declarar aceptada
  una hoja todavía. Solo admite campos de registro, no cambios de identidad.
  `sourceRects[fase][dirección]` admite separaciones irregulares del maestro con
  ventanas explícitas; cada figura conserva margen, escala común de referencia
  (`sourceCellWidth`) y pelvis medida. No ajustar cada pose a su propia caja de
  remos ni relajar márgenes para hacer pasar una figura cortada. `--measure`
  informa medidas sin aceptar la hoja ni saltarse la validación del horneado.
- `node scripts/check-vessel-browser.cjs --variant=101` comprueba las 32
  composiciones, cada pala contra sus píxeles originales, contacto **fuera** del
  casco, cero alteraciones sobre plástico opaco, cero parches semitransparentes
  dentro de la punta sumergida, fondo cerrado y superficies auxiliares acotadas.
  Compara el cuerpo contra el mismo render sin oclusión y reproduce como
  prueba negativa el corte del cuello al desactivar su protección. Un margen
  de un píxel de textura cubre el antialias del límite del path, no una banda
  borrosa dentro de la pala.
  Guarda las 32 capturas individuales, contacto y medidas con
  `--label=nombre` en `.local/vessel-art-reviews/ID/nombre/`; el rig anotado queda
  en `.local/vessel-art-reviews/rig-ID.png`. `--measure` propone puntos para revisión
  offline; no modifica fuentes, datos ni el motor y no equivale a pasar la prueba.
  `--browser=webkit --label=webkit` ejecuta las mismas comprobaciones de píxeles
  con el motor de Safari (requiere `npx playwright install webkit`). La revisión
  del primer conjunto pasa tanto en Chrome como en WebKit; no sustituye probar
  la aplicación en un dispositivo iOS físico.
- `GAME_PLAYER_VARIANT=101 node scripts/check-river-browser.cjs` (también
  `check-ascua-browser`, `check-mobility-browser`, `check-cats-browser` y
  `check-forest-browser`) prueba las acciones con el motor real y su entrada,
  sustituyendo solo la apariencia predeterminada en el bundle de prueba.
  La entrada comprueba que se está usando esa variante. No valida el futuro
  selector ni su persistencia y nunca cambia partidas reales.
- `node scripts/check-rowing-motion-browser.cjs` captura desde el lienzo real las
  cuatro fases en ocho direcciones, a 1440×900/DPR1, 768×1024/DPR2 y 390×844/DPR3;
  también verifica las ocho vistas inmóviles con movimiento reducido. No congela
  el motor, no cambia su renderer y no utiliza cuentas reales. Evidencia en
  `.local/vessel-art-reviews/100/game/`. `GAME_PLAYER_VARIANT=101` permite repetir
  exactamente el recorrido para otro personaje completo, sin cambiar el
  protagonista predeterminado ni la partida del dueño.
  Los contactos `*-all-32.png` se regeneran desde esas capturas en cada ejecución;
  no deben reutilizarse mosaicos de una revisión anterior.

## Prompts fundacionales conservados por procedencia

Prototipos históricos: el protagonista vigente lleva gorro; no usa las proporciones
ni el diseño sin gorro de abajo. Estos prompts reproducen los originales antiguos,
no describen el arte actual.

## Forest prompt

Use case: stylized-concept. Asset type: production sprite atlas for an original cozy top-down browser pixel-art adventure, 1536x1024 PNG, genuinely transparent background. EXACT GRID: 3 columns by 2 rows of equal 512x512 cells, no dividers, no text. One isolated fully visible object CENTERED in each cell with at least 48px transparent margin on every edge. TOP LEFT: broad round lush oak with layered clustered foliage and short visible trunk, TOP MIDDLE: tall leafy hornbeam with rounded tapering crown and visible trunk, TOP RIGHT: low rounded leafy shrub with a few tiny cream flowers. BOTTOM LEFT: charming hollow old tree stump with moss, BOTTOM MIDDLE: cluster of three rounded mossy stones, BOTTOM RIGHT: cluster of three apricot-brown capped mushrooms with cream stems. True carefully crafted chunky 16-bit pixel art as if authored on 64x64 pixels per cell and nearest-neighbor enlarged 8x, crisp pixel squares and stair-step contours, no antialias, no painterly fine detail. Warm forest palette limited to deep teal-green shadows, moss green, golden lime sunlit leaves, warm umber trunks, cream highlights and terracotta. View is overhead three-quarter top-down 2D adventure perspective, looking down onto the foliage but seeing trunk front. Light from upper left, harmonized palette and pixel scale across every asset. No ground patches, no bases, no cast shadows, NO background illustration, no characters, no interface, no labels, no logos. Objects must be disconnected by real transparent space so each exact cell can be used independently as a game sprite. Lovingly detailed silhouette, inviting relaxing magical forest atmosphere, original artwork.

## Character prompt

Use case: stylized-concept. Asset type: original playable character sprite sheet, transparent PNG 1024x1024. A beautifully designed tiny friendly woodland duende for a cozy top-down 16-bit pixel adventure. Exact 4-column by 4-row grid, sixteen isolated full-body sprites, each centered in its 256x256 cell with feet on the same baseline and consistent head and body sizes. COLUMN 1 faces camera (south), COLUMN 2 faces right (east), COLUMN 3 faces away (north), COLUMN 4 faces left (west). ROW 1 idle standing, ROW 2 walking left leg forward with opposite arm swing, ROW 3 neutral walking passing pose, ROW 4 walking right leg forward with opposite arm swing. In all frames the same character: pointed elf ears extending sideways, soft round cheeky smiling face, warm peach skin, a tousled curved cinnamon auburn hair tuft with golden tips, NO hat, NO hood, NO weapons, teal short coat with little brass buttons, mustard neckerchief, brown satchel on back, plum trousers, little dark brown walking boots. Head roughly half the character height, expressive dark brown eyes, rounded silhouette, slim little body. Art direction: meticulously hand-pixelled GBA-era RPG sprite quality, 24px wide x32px high logical pixel character, crisp stepped pixels enlarged to the sheet, rich but tightly controlled 24-color palette, warm outline rather than solid black, charming clean shading, lit from upper left. View is slightly overhead 3/4 top-down adventure game perspective, not flat frontal portrait. TRUE TRANSPARENT BACKGROUND, no floor, no ground, no shadow, no scenery, no grid lines, no text. No resemblance to any existing named character, completely original Magikitos design. Must be usable directly as an animation atlas.
