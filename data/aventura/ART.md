# Arte: fuentes y pipeline

Política vigente: [2× integrado y movimiento selectivo](../../docs/art-direction/DEFINITION-MOTION.md).
Maestros a buena resolución, texturas preparadas offline. Nunca descargar originales
ni escanear píxeles al arrancar. Textura 2× no duplica tamaño en el mundo: escala,
recorte y cuerpo físico son controles distintos.

## Fuentes de verdad

- [Kit del bosque](art/woodland-kit/prompts.json): casas, vegetación y muebles.
- [Pipeline y familias](../../docs/WOODLAND-KIT.md): alfa, anclas y variantes.
- [Ascua](../../docs/art-direction/DUENDES.md) y [110 NPC](../../docs/RESIDENTS.md).
- [Picnic](../../docs/SHARED-FOREST.md#arte-y-animación-del-picnic): humanos animados y elementos de la manta.
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
  [docs/art-direction/DUENDES.md](../../docs/art-direction/DUENDES.md).
- [Prompts anteriores](#prompts-de-animación-y-detalle-1213-de-septiembre-de-2026): procedencia, no guía para reintroducir
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

## Prompts de animación y detalle (12–13 de septiembre de 2026)

Built-in image generation tool. Originals retained in `art/generated/`; never downloaded by the browser.

### Player

Use case: identity-preserve.
Asset type: production animation sprite sheet for our original Magikitos top-down pixel adventure.
Image 1 is an identity and pixel-art style reference; redraw ONLY its FIRST ROW character, the young chestnut-haired duende in teal coat, ochre scarf, brown trousers and boots. Preserve his friendly big sideways pointed ears, round nose, warm palette and proportions. ADD a clearly visible tall conical POINTED OCHRE FELT HAT with a little bent tip. The ears remain visible. No weapon.
Create exactly TWENTY isolated sprites on a genuinely transparent background, exact regular grid FOUR COLUMNS by FIVE ROWS, equal cells. Full body in every cell, consistent size and baseline within each row, ample transparent gutters; no overlap, no labels, no dividers.
The FIVE ROWS are facing directions:
row 1: SOUTH, facing the viewer.
row 2: SOUTHEAST, three-quarter front, nose and both feet pointing down-right.
row 3: EAST, strict right profile, nose and boots pointing right.
row 4: NORTHEAST, three-quarter back, nose barely visible to the right, boots pointing up-right.
row 5: NORTH, fully back-facing, no face visible.
The FOUR COLUMNS are WALK CYCLE POSES in the direction of that row:
column 1 neutral standing, both boots resting.
column 2 left foot forward with right arm forward, other foot back.
column 3 passing step, left heel raised and right knee forward.
column 4 right foot forward with left arm forward, other foot back.
Articulate the legs and arms convincingly: boots actually change position and orientation, not four copies of the same pose. Keep head, ears, hat, clothes and body dimensions absolutely consistent across the walk cycle. Standing and walking are upright, never floating or lying diagonally. The diagonal is a 3D change in facing direction, NOT a rotation of the flat sprite.
View is slightly overhead 3/4 top-down 2D adventure perspective. Carefully authored crisp 16-bit pixel art, warm dark contours, each sprite designed to read at about 26x36 native pixels. NO antialiasing, no fuzzy painterly detail. Real transparent alpha, no ground or shadows, no text, no props, no logos, original design.

#### Direction correction / alpha request

Use case: background-extraction. Image 1 is the exact edit target. Remove the gray and white checkerboard from around all twenty sprites, replacing it with REAL transparent PNG alpha, not a painted background. Preserve every duende and its crisp outlines. Keep exactly four columns and five rows. No floor, no backdrop, no checkerboard, no shadow. Correct ONLY row four as an additional directional correction: show each same duende in THREE QUARTER BACK-RIGHT view (northeast), not straight back: right cheek/nose barely visible on right edge of head, right ear smaller than left, satchel offset left. The bottom row remains completely BACK facing. Keep the same character and walk cycle, all hats and palettes unchanged. Save an alpha-channel RGBA image.

### Elder

Use case: identity-preserve.
Asset type: production animation sprite sheet for our original Magikitos top-down pixel adventure.
Image 1 is an identity and pixel-art style reference; redraw ONLY its SECOND ROW character, the older silver-haired duende with moustache, russet waistcoat, cream sleeves and moss trousers. Preserve the friendly big sideways pointed ears, round nose, warm palette and proportions. ADD a clearly visible tall conical RUST-RED FELT HAT with a little bent tip. The ears remain visible. No weapon.
Create exactly TWENTY isolated sprites on a genuinely transparent background, exact regular grid FOUR COLUMNS by FIVE ROWS, equal cells. Full body in every cell, consistent size and baseline within each row, ample transparent gutters; no overlap, no labels, no dividers.
The FIVE ROWS are facing directions:
row 1: SOUTH, facing the viewer.
row 2: SOUTHEAST, three-quarter front, nose and both feet pointing down-right.
row 3: EAST, strict right profile, nose and boots pointing right.
row 4: NORTHEAST, three-quarter back, nose barely visible to the right, boots pointing up-right.
row 5: NORTH, fully back-facing, no face visible.
The FOUR COLUMNS are WALK CYCLE POSES in the direction of that row:
column 1 neutral standing, both boots resting.
column 2 left foot forward with right arm forward, other foot back.
column 3 passing step, left heel raised and right knee forward.
column 4 right foot forward with left arm forward, other foot back.
Articulate the legs and arms convincingly: boots actually change position and orientation, not four copies of the same pose. Keep head, ears, hat, clothes and body dimensions absolutely consistent across the walk cycle. Standing and walking are upright, never floating or lying diagonally. The diagonal is a 3D change in facing direction, NOT a rotation of the flat sprite.
View is slightly overhead 3/4 top-down 2D adventure perspective. Carefully authored crisp 16-bit pixel art, warm dark contours, each sprite designed to read at about 26x36 native pixels. NO antialiasing, no fuzzy painterly detail. Real transparent alpha, no ground or shadows, no text, no props, no logos, original design.
IMPORTANT: Real cutout PNG alpha output required. Never draw a gray checkerboard. The fourth row MUST face NORTHEAST visibly differently from the fifth: 3/4 back-right, a sliver of the right cheek and nose visible at the RIGHT outline of the face.

### Neighbor

Use case: identity-preserve.
Asset type: production animation sprite sheet for our original Magikitos top-down pixel adventure.
Image 1 is an identity and pixel-art style reference; redraw ONLY its THIRD ROW character, the brown-skinned curly dark-haired duende in plum jacket, cream shirt and ochre trousers. Preserve the friendly big sideways pointed ears, round nose, warm palette and proportions. ADD a clearly visible tall conical PLUM FELT HAT with a little bent tip. The ears remain visible. No weapon.
Create exactly TWENTY isolated sprites on a genuinely transparent background, exact regular grid FOUR COLUMNS by FIVE ROWS, equal cells. Full body in every cell, consistent size and baseline within each row, ample transparent gutters; no overlap, no labels, no dividers.
The FIVE ROWS are facing directions:
row 1: SOUTH, facing the viewer.
row 2: SOUTHEAST, three-quarter front, nose and both feet pointing down-right.
row 3: EAST, strict right profile, nose and boots pointing right.
row 4: NORTHEAST, three-quarter back, nose barely visible to the right, boots pointing up-right.
row 5: NORTH, fully back-facing, no face visible.
The FOUR COLUMNS are WALK CYCLE POSES in the direction of that row:
column 1 neutral standing, both boots resting.
column 2 left foot forward with right arm forward, other foot back.
column 3 passing step, left heel raised and right knee forward.
column 4 right foot forward with left arm forward, other foot back.
Articulate the legs and arms convincingly: boots actually change position and orientation, not four copies of the same pose. Keep head, ears, hat, clothes and body dimensions absolutely consistent across the walk cycle. Standing and walking are upright, never floating or lying diagonally. The diagonal is a 3D change in facing direction, NOT a rotation of the flat sprite.
View is slightly overhead 3/4 top-down 2D adventure perspective. Carefully authored crisp 16-bit pixel art, warm dark contours, each sprite designed to read at about 26x36 native pixels. NO antialiasing, no fuzzy painterly detail. Real transparent alpha, no ground or shadows, no text, no props, no logos, original design.
IMPORTANT: Real cutout PNG alpha output required. Never draw a gray checkerboard. The fourth row MUST face NORTHEAST visibly differently from the fifth: 3/4 back-right, a sliver of the right cheek and nose visible at the RIGHT outline of the face.

### Guardian

Use case: identity-preserve.
Asset type: production animation sprite sheet for our original Magikitos top-down pixel adventure.
Image 1 is an identity and pixel-art style reference; redraw ONLY its FOURTH ROW character, the red-haired duende in ochre coat, teal scarf and dark trousers. Preserve the friendly big sideways pointed ears, round nose, warm palette and proportions. ADD a clearly visible tall conical TEAL FELT HAT with a little bent tip. The ears remain visible. No weapon.
Create exactly TWENTY isolated sprites on a genuinely transparent background, exact regular grid FOUR COLUMNS by FIVE ROWS, equal cells. Full body in every cell, consistent size and baseline within each row, ample transparent gutters; no overlap, no labels, no dividers.
The FIVE ROWS are facing directions:
row 1: SOUTH, facing the viewer.
row 2: SOUTHEAST, three-quarter front, nose and both feet pointing down-right.
row 3: EAST, strict right profile, nose and boots pointing right.
row 4: NORTHEAST, three-quarter back, nose barely visible to the right, boots pointing up-right.
row 5: NORTH, fully back-facing, no face visible.
The FOUR COLUMNS are WALK CYCLE POSES in the direction of that row:
column 1 neutral standing, both boots resting.
column 2 left foot forward with right arm forward, other foot back.
column 3 passing step, left heel raised and right knee forward.
column 4 right foot forward with left arm forward, other foot back.
Articulate the legs and arms convincingly: boots actually change position and orientation, not four copies of the same pose. Keep head, ears, hat, clothes and body dimensions absolutely consistent across the walk cycle. Standing and walking are upright, never floating or lying diagonally. The diagonal is a 3D change in facing direction, NOT a rotation of the flat sprite.
View is slightly overhead 3/4 top-down 2D adventure perspective. Carefully authored crisp 16-bit pixel art, warm dark contours, each sprite designed to read at about 26x36 native pixels. NO antialiasing, no fuzzy painterly detail. Real transparent alpha, no ground or shadows, no text, no props, no logos, original design.
IMPORTANT: Real cutout PNG alpha output required. Never draw a gray checkerboard. The fourth row MUST face NORTHEAST visibly differently from the fifth: 3/4 back-right, a sliver of the right cheek and nose visible at the RIGHT outline of the face.

### Woodland details

Use case: stylized-concept.
Asset type: decorative sprite atlas to enrich an original cozy top-down 16-bit village adventure.
Image 1 is ONLY an art style / palette reference, NOT an edit target. Match its warm clustered foliage, teal shadows, moss/lime greens, umber wood and cream highlights. New art must have GENUINELY TRANSPARENT ALPHA around each object; do NOT reproduce the reference's colored haze.
Exactly TWELVE separate full-object sprites in a regular 4-column x 3-row equal-cell grid. Each sprite centered in its cell, ample transparent gutters, full object visible, no text, no labels, no grid borders, no ground patches, no scenery.
Row 1 left-to-right: (1) light-barked small birch tree with airy asymmetrical crown, (2) crooked old oak with two irregular lobes of foliage and visible bent trunk, (3) young rounded conifer with three distinct leafy tiers, (4) low bush with a few bright red berries.
Row 2: (1) delicate curled fern cluster, (2) a fallen mossy log with one tiny mushroom growing on it, (3) a tuft of lakeside reeds and two cattails, (4) terracotta planter with white daisies.
Row 3: (1) small stack of two wooden crates with a folded cloth, (2) wooden easel with an unfinished cheerful leaf painting, (3) short rustic lantern on a wooden post, (4) small basket of colorful yarn balls next to a spool.
View is slightly overhead three-quarter top-down pixel adventure perspective, matching the reference. Each tree readable at about 50x62 native pixels; small props at 22x28 native pixels. Crisp intentional stepped pixel edges, tightly controlled warm 16-bit palette, no smooth rendering or painterly microdetail. Light from upper left. Original charming handmade world, no characters, no logos or existing franchise elements. Transparent background, no artificial checkerboard.

### Neighbors and puzzle props — 12 September 2026

Reference: the existing original Magikitos neighbor sheet, not external game artwork.
Player design unchanged. Generated sources retained under art/generated/.

#### moss-neighbor

Use case: stylized-concept. Generate a NEW production character animation sheet. Image 1 is STYLE ONLY, not an edit target. Match its crisp pixel-art detail, large pointed ears, friendly duende proportions and slightly overhead adventure perspective. Keep each sprite readable at native 28x40 pixels. Exactly 20 isolated full-body sprites in a regular FOUR COLUMN by FIVE ROW grid, each centered in its cell, equal cell sizes, large empty gutters, baseline and character size identical across all frames.
Rows are five facing directions: row1 SOUTH/front, row2 SOUTHEAST/three-quarter front-right, row3 EAST/right profile, row4 NORTHEAST/three-quarter BACK-right with sliver of cheek on right and backpack visible, row5 NORTH/back. Columns are neutral standing, left foot forward opposite arm forward, passing step, right foot forward opposite arm forward. Articulate boots, arms and knees visibly; do not rotate a flat sprite or copy the same pose. Same person in all 20 frames. Real transparent PNG background, no shadows, no ground, no checkerboard, no text, no weapons. Original design, no named franchise character. Character: a dark mahogany-skinned cheerful duende, curly silver hair, emerald green tall slender POINTED HAT with a distinct corkscrew bent tip and narrow brim; lilac waistcoat, cream shirt, dark indigo trousers, chestnut boots. Different from the protagonist's ochre hat and teal coat. Preserve warm lively eyes and rounded friendly nose.

#### ivory-neighbor

Use case: stylized-concept. Generate a NEW production character animation sheet. Image 1 is STYLE ONLY, not an edit target. Match its crisp pixel-art detail, large pointed ears, friendly duende proportions and slightly overhead adventure perspective. Keep each sprite readable at native 28x40 pixels. Exactly 20 isolated full-body sprites in a regular FOUR COLUMN by FIVE ROW grid, each centered in its cell, equal cell sizes, large empty gutters, baseline and character size identical across all frames.
Rows are five facing directions: row1 SOUTH/front, row2 SOUTHEAST/three-quarter front-right, row3 EAST/right profile, row4 NORTHEAST/three-quarter BACK-right with sliver of cheek on right and backpack visible, row5 NORTH/back. Columns are neutral standing, left foot forward opposite arm forward, passing step, right foot forward opposite arm forward. Articulate boots, arms and knees visibly; do not rotate a flat sprite or copy the same pose. Same person in all 20 frames. Real transparent PNG background, no shadows, no ground, no checkerboard, no text, no weapons. Original design, no named franchise character. Character: a pale freckled cheerful duende with rosy cheeks, black bob hair, a wide-brim IVORY POINTED HAT whose long floppy tip leans sideways; brick-red short jacket, moss trousers, chestnut boots. Hat silhouette is broad and slanted, clearly different from a straight cone. Different from the protagonist's ochre hat and teal coat.

#### puzzle-props

Use case: stylized-concept. Generate a new production sprite sheet for a warm cozy original top-down pixel adventure. Image 1 is an art style and palette reference only. Match its 16-bit crisp pixel art, cream highlights, umber wood and warm outlines. FOUR isolated objects, exact TWO COLUMNS by TWO ROWS on genuinely transparent background. Equal square cells, broad transparent margins, no grid lines, no text or labels.
Top left: an open magical book on a low wooden reading lectern, cream pages with decorative ink squiggles NOT readable writing, dark raspberry leather cover, a turquoise leaf-shaped clasp, inviting human-house object seen from slightly overhead.
Top right: a tiny reusable BRASS POCKET LIGHTER standing upright, lid open, striking wheel visible, small warm flame, copper and cream highlights. Not a lantern or match.
Bottom left: a little ROASTED MUSHROOM, golden-brown cap with two tasty dark char marks, cream stem, no plate, no ground.
Bottom right: a plump canvas drawstring INVENTORY SACK tied with a green cord, flax beige cloth and brown leather bottom, inviting readable silhouette.
Native target sizes lectern 36x40, lighter14x22, mushroom18x18, sack26x30. Deliberate crisp stepped pixels, limited warm palette, no painterly haze, no shadows, no scenery. Transparent cutouts not a painted backdrop.

### Modular expansion — 12 September 2026

Built-in imagegen, one call per sheet; no CLI fallback. Style references only:
`art/woodland-cutout.png` for harbor, shore-garden and skewer-items;
`art/neighbor-cutout.png` for picnic-neighbor. Originals retained unchanged.

#### harbor

Saved source: `data/aventura/art/generated/harbor.png`.
Prepared build input: `data/aventura/art/harbor-cutout.png`.

```text
Use case: stylized-concept. Asset type: original pixel-art sprites for a cozy top-down browser duende adventure, harbor asset module. Image 1 is STYLE REFERENCE ONLY for pixel density, warm outlined shapes and overhead viewpoint; do not edit that image. Generate a genuinely transparent PNG with EXACT 2 columns by 2 rows of disconnected sprites, generous empty margin within each equal cell, no background scene, no text or labels. TOP LEFT: a charming little wooden ferry viewed slightly overhead, bow pointing RIGHT, wide side-on silhouette, curved chestnut hull with visible interior, two small benches, very short mast and folded cream-and-teal striped canopy, a tiny brass lantern on bow; NO passengers, NO water or shadow, NO wake, entire hull visible. TOP RIGHT: weathered wooden jetty end viewed overhead three-quarter, horizontal planks, four stout round mooring posts, rope coil, no boat or water, usable as an isolated 72x36 logical pixel prop. BOTTOM LEFT: cozy small stone-ring charcoal barbecue with iron cooking grid over glowing coals, three-quarter top-down, no food, no floor. BOTTOM RIGHT: same stone barbecue with cold dark coals and identical shape and perspective. Crisp native-looking 16-bit pixel clusters, warm brown outlines, rich carefully controlled forest palette; asset appearance must survive nearest-neighbor downscaling to 90x56 boat, 72x36 jetty, 32x30 barbecues. No antialias, no blur, no typography, no existing game characters. Truly transparent background, NOT a painted checkerboard.
```

#### picnic-neighbor

Saved source: `data/aventura/art/generated/picnic-neighbor.png`.
Prepared build input: `data/aventura/art/picnic-neighbor-cutout.png`.

```text
Use case: stylized-concept. Asset type: original quest NPC sprite pair for a cozy top-down duende adventure. Image 1 is STYLE REFERENCE ONLY; keep the same world perspective and crisp pixel scale, not this exact person. Exact TWO columns ONE row, equal cells, both entire sprites isolated on genuinely transparent background, generous margins. Same elderly friendly duende seated on a low wooden stump in both sprites, huge sideways pointy ears, brown skin, round rosy nose, grey curly sideburns, tall plum-red pointed floppy hat, cream shirt with moss-green waistcoat, dark boots dangling, visible knees and feet, no weapons. LEFT: comically hungry, one hand on tummy, tiny cartoon tear under eye and trembling pout, sympathetic not distressed or frightening. RIGHT: satisfied smile, eyes joyfully closed, both hands patting round belly. Both seated facing slightly downward toward camera, overhead 3/4 cozy adventure viewpoint, matched size and baseline. Whole hat, stump and boots inside cell. Lovingly crafted crisp 16-bit pixel art readable at 32x44 logical pixels per sprite. No scenery, no captions, no shadow, no existing game character likeness. Actual alpha transparency, not a checkerboard illustration.
```

#### shore-garden

Saved source: `data/aventura/art/generated/shore-garden.png`.
Prepared build input: `data/aventura/art/shore-garden-cutout.png`.

```text
Use case: stylized-concept. Asset type: original coastal woodland scenery module for the same cozy duende adventure. Image 1 is STYLE REFERENCE ONLY for top-down perspective, warm pixel clusters and scale, no edits to reference. EXACT 3 columns by 2 rows of six fully isolated sprites on genuinely transparent background; generous padding within each cell, no grid marks. Top row left: graceful leaning willow tree, visible bent trunk and draping blue-green foliage, wider asymmetric silhouette. Top row middle: squat twisted fruit tree with thick bark and warm gold-orange small fruits, distinct from willow. Top row right: tuft of soft coastal grasses with small lilac flowers and a few seedheads. Bottom row left: low cluster of smooth sandstone beach boulders with tiny moss patch, no floor. Bottom row middle: three pretty small spiral sea shells with peach and cream stripes, no sand patch. Bottom row right: small sturdy wicker collecting basket, open rim and folded blue cloth, empty inside. All sprites consistent slightly overhead three-quarter view, crisp 16-bit pixel-art clusters, warm brown outlines, no photoreal textures or antialias. Trees readable at about 58x62 logical pixels, other props 20-30 pixels. No characters, no water, no ground tiles, no shadow, no text, no logos. Actual transparent background, not checkerboard paint.
```

#### skewer-items

Saved source: `data/aventura/art/generated/skewer-items.png`.
Prepared build input: `data/aventura/art/skewer-items-cutout.png`.

```text
Use case: stylized-concept. Asset type: inventory item sprites for original cozy pixel-art duende exploration game. Image 1 is STYLE REFERENCE ONLY for pixel clusters and warm colors. Exactly THREE columns ONE row on genuinely transparent background. Left: single slender forked wooden twig, whole stick, diagonal. Middle: delicious cooked mushroom skewer with THREE round golden-brown grilled mushrooms pierced on one slender wooden stick, pale golden stalks and reddish toasted caps, appetizing small char marks, no plate. Right: a single whimsical golden brass coin embossed with a tiny sock silhouette, no text or numerals. Each entire object isolated in its own equal cell, lots of empty padding, clear silhouette, no shadow, no background, no checkerboard. Top-down 3/4 16-bit pixel-art style, dark warm outlines, limited gold/brown/cream palette. Readable at 20x24 logical pixels per object, no antialias, no existing game assets.
```


### Rolling and doorway pass — 12 September 2026

Mode: built-in image generation tool (no CLI/API fallback). The image skill guided
reference inspection, identity preservation, separate sprite delivery and prompt recording.
Originals retained at `art/generated/roll.png` and `art/generated/building-doors.png`.
Build inputs: `art/roll-cutout.png`, `art/building-doors-cutout.png`, prepared by the
previously authorized offline PHP/GD cutout; source pixels/design are retained.
The built-in outputs had a painted checkerboard; only neutral edge-connected
background was removed in the local build pipeline. No runtime alpha processing.

#### Roll — final prompt
Reference: `art/player-cutout.png`, identity/style only (not an edit target).
Archived action: no runtime package. The original and prompt are kept for provenance.

```text
Use case: stylized-concept. Asset type: production pixel-art forward somersault animation sheet for an original top-down adventure game.
Input image 1 is a character identity and pixel-art style reference, NOT an edit target. Create a new sprite sheet of that exact orange pointed-hat duende: brown hair, pointy ears, teal coat, mustard scarf, brown boots, little tan satchel. Keep proportions and outfit. Genuine transparent background.
Composition: exactly 4 columns by 5 rows, 20 separate sprites, generous clear space between cells, equal-size cells. No letters, labels, grid lines, ground shadows, scenery or particles.
Each row shows a FORWARD TUCKED SOMERSAULT in its own world direction, not a standing sprite rotated in the picture plane. Rows top to bottom: moving DOWN towards viewer; moving DOWN-RIGHT; moving RIGHT side profile; moving UP-RIGHT away; moving UP away from viewer. Left directions will be mirrored by the engine.
Columns left to right form the action: (1) crouch deeply and reach forward, (2) dive headfirst and tuck chin/knees, (3) roll onto rounded back with boots going overhead and hat folding with body, (4) feet land forward and low crouch recovering. Character compact during roll. Clearly different silhouettes per frame, proper foreshortening per direction, face hidden when back points to camera. Consistent character scale; every full sprite including hat and boots contained inside its cell. Crisp warm outlined pixel art matching reference, readable reduced to about 28x40 pixels. Do not depict ordinary walking or a lateral cartwheel. Orange pointed hat stays on head throughout.
```

#### Building doors — final prompt
Edit target: `art/buildings.png`. Only five doorway-state variants are consumed;
the unchanged original cottage-open and fountain assets are retained.

```text
Use case: precise-object-edit. Asset type: corrected doorway variants of original top-down pixel-art buildings.
Image 1 is the EDIT TARGET. Preserve all six building designs, sheet positions (3 columns x 2 rows), camera, pixel-art style, sizes, roofs, windows, props and colors. Change only door states:
UPPER LEFT red-roof cottage: replace dark open hole with a visibly CLOSED brown wooden plank door and tiny brass knob.
LOWER LEFT blue-roof fisher cottage: visibly CLOSED brown wooden plank door and knob.
UPPER MIDDLE tavern with barrel: wooden door is OPEN, door leaf tucked to side, dark welcoming visible entrance within existing stone arch.
UPPER RIGHT golden-roof workshop: turquoise door OPEN, teal leaf tucked against side of frame, dark visible entrance in its place.
LOWER MIDDLE large grey-roof human house: brown door OPEN, leaf tucked to side, dark visible entrance.
LOWER RIGHT fountain: absolutely unchanged.
Genuine transparent background outside all buildings, no checkerboard, no glow, no text, no new props. Preserve original colors and silhouettes carefully.
```

### Voyage, body actions and broad-leaf props — 13 September 2026

Mode: built-in imagegen, no CLI/API fallback. The imagegen skill guided inspection
of this project's own references, identity preservation, separate modular sheets
and this exact-prompt record. No copyrighted game artwork was used as a reference.
Generated neutral/checkerboard backgrounds were removed with the previously
authorized offline PHP/GD cutout; originals preserved. The character remains clothed.

Reference roles:
- needs-poses: `art/player-cutout.png`, protagonist identity and world style.
- needs-props: `art/woodland-cutout.png`, scale/palette/perspective only.
- ferry-aboard: `art/harbor-cutout.png`, boat design; `art/player-cutout.png`,
  passenger identity; `art/neighbor-cutout.png`, ferryman design/style.

#### needs-poses

Original: `data/aventura/art/generated/needs-poses.png`.
Prepared build input: `data/aventura/art/needs-poses-cutout.png`.

```text
Use case: stylized-concept. Asset type: sprite animation sheet for an original cozy top-down pixel-art adventure.
Image 1 is identity/style reference only: the established adult fantasy woodland duende with orange pointed hat, pointed ears, brown hair, teal coat, mustard scarf, brown trousers and boots, small tan satchel. Not a child. Preserve that design, palette and proportions exactly.
Create exactly 4 columns x 2 rows, 8 isolated full-body sprites in equal cells with generous blank margins. All sprites viewed three-quarter from behind facing UP-RIGHT in world space. Transparent background, no scenery, labels, grids, particles, shadows or lettering.
Top row: a goofy, nonsexual toilet-break pee animation. Frame1 stops and places hands at waist; frame2 leans back slightly, feet apart, elbows bend forward at waist; frame3 shoulders relax and head tips back; frame4 finishes adjusting belt and stands upright. Clothing hides all anatomy; no visible genitals or nudity. No urine stream in sheet: engine draws a small pixel stream.
Bottom row: nonsexual outdoor poop-and-wipe animation. Frame1 crouches low, boots planted, long coat tails completely cover bottom and private parts; frame2 deep squat with hunched shoulders and funny strained body language; frame3 still crouching, reaches behind with a LARGE GREEN LEAF to wipe, clearly visible leaf at side; frame4 rises, pulls clothing straight, relieved stance. No nudity, no genitals, no explicit anatomy. No excrement in sheet; separate tiny game prop used. Hat always stays on. Real distinct bodily poses, not reused standing frames.
Crisp warm outlined pixel art matching reference, coherent scale and fixed planted-foot baseline, readable at 30x40 native pixels. No lateral camera rotation, no extra people.
```

#### needs-props

Original: `data/aventura/art/generated/needs-props.png`.
Prepared build input: `data/aventura/art/needs-props-cutout.png`.

```text
Use case: stylized-concept. Asset type: original modular top-down cozy pixel-art game props.
Image 1 is style reference only: our existing woodland sprite sheet. New exact 3 columns x 2 rows of 6 separate isolated props, generous transparent space around each. Genuine transparent background. No text, labels, grid lines, people, floor patches, or shadows.
TOP LEFT: distinctive low woodland plant with five enormous broad soft heart-shaped leaves, lush jade and lime green with clear pale veins, a little curled young leaf; recognizable harvestable toilet-leaf plant, not a tree or fern.
TOP MIDDLE: ONE detached broad soft green leaf with short stem, inventory icon, same species.
TOP RIGHT: small simple warm wooden bedside TABLE, clear EMPTY tabletop, four squat legs, no bowls or objects.
BOTTOM LEFT: small ceramic flower VASE with three cheerful white daisies, slim and compact to sit on table.
BOTTOM MIDDLE: tiny non-graphic cartoon brown poop pile, simple rounded lumpy shape, no face, no disgust/gore, a humorous outdoor game prop.
BOTTOM RIGHT: tiny pale golden pee puddle, flat irregular oval, discreet stylized pixel mark.
Warm outlined pixel art in existing art language, 3/4 top-down game camera. Deliberate crisp chunky native-scale details, no painterly blur. Props only, separated, each wholly within its cell.
```

#### ferry-aboard

Original: `data/aventura/art/generated/ferry-aboard.png`.
Prepared build input: `data/aventura/art/ferry-aboard-cutout.png`.

```text
Use case: stylized-concept. Asset type: animated occupied ferry sprite for original top-down cozy pixel-art adventure.
Reference image1: exact boat design (upper left boat only, ignore other objects).
Reference image2: passenger identity, orange pointed hat adult duende, teal coat, mustard scarf, tan satchel.
Reference image3: ferryman identity, burgundy pointed hat adult duende, warm brown skin, burgundy coat, mustard trousers, gold earring.
Create exact 2 columns x 2 rows animation sheet, FOUR same-scale boat sprites. Every frame has the same boat facing RIGHT in 3/4 top-down game perspective and BOTH duendes visibly seated INSIDE, lower bodies hidden correctly by the hull. Passenger sits still, distinctive orange hat and face visible. Ferryman sits near stern and ROWS with an oar, burgundy hat visible. Keep cream/teal striped small canopy, wood hull, bow lantern of reference. Enlarge open seating space just enough to show two distinct hats and faces above the gunwale. Both duendes belong to the boat, not floating beside it or standing on water.
Frames left-to-right then top-to-bottom form a clear rowing stroke: reach oar forward, dip, pull aft, recover. Boat and passenger scale/position constant, only arms/oar motion changes subtly. No water or wake, no jetty, no shadows, no background, no text or grid. Genuine alpha transparency and generous blank margins in every cell. Warm crisp pixel art matching references, readable when each boat is rendered about 100x78 pixels. No extra passengers, no redesign of costumes.
```

## Arte de construcción: almacén, gravilla y constructor (19 de septiembre de 2026)

Entrega gráfica del 19 de septiembre de 2026. **Independiente de `AUTOMANTENIMIENTO.md`.**

**Integrado el 19-sep-2026**: atlas `warehouse-exterior`, `warehouse-interior`, `warehouse-props` y `warehouse-keeper` en `data/aventura/assets/`, escena `almacen`, puerta `warehouse-door` en la pradera, constructor como entidad de trueque (ver [SHARED-FOREST.md](../../docs/SHARED-FOREST.md#el-almacén-del-constructor-19-sep-2026-decisión-del-dueño)). El sheet del constructor se registró con el prefijo `warehouse-keeper-*`; el variant 111 sigue siendo de `castana-bruma`.

### Ver la entrega

- **[Galería local con las ocho direcciones animadas del constructor](art/construction/review/index.html)**.
  Se puede abrir directamente como archivo en Chrome; no necesita servidor ni llama a la API.
- **[Lámina de conjunto](art/construction/review/overview.png)**: exterior, escala del
  NPC, montaje del interior y las 32 poses.
- **[Interior amueblado de referencia](art/construction/review/warehouse-furnished.png)**.
  Es un montaje de revisión, **no el fondo que debe usarse en el juego**: no hornear al NPC ni los
  objetos interactivos dentro del escenario.

### Dirección artística

El almacén está dentro de **una regadera humana antigua**, recuperada por los Magikitos:
hojalata verde petróleo envejecida, asa grande, rociador, puerta doble de madera abierta,
rampa corta para las cargas, tejadillo de hojas y corteza, cuerdas y polea. No es una casa humana.
Musgo y flores pequeñas unen la base con el bosque, sin una isla de tierra pintada alrededor.

El interior corresponde al mismo recipiente: planta redondeada, pared metálica curva, refuerzos
de madera, ventana lateral de luz cálida y salida al sur. Su centro queda despejado. Las paredes,
suelo, iluminación pintada y estanterías empotradas vacías forman el fondo estático; los sacos,
el mostrador, los expositores de material y el NPC son piezas separadas y recolocables.

Los **saquitos de gravilla** son de arpillera cálida, cuerda y parche verde cosido. Hay una
versión abierta —se ven las piedrecitas claras— y otra atada. El icono de inventario se deriva
del mismo máster, no de un diseño diferente. Para hacer grupos de sacos se colocan varias
instancias: no es necesario descargar otra ilustración de una pila.

Todo mantiene el acabado ilustrado/pixel art definido del juego, con textura **2× y reducción
integrada**. Se utilizó imagegen integrado para el dibujo; los recortes alfa, escalas y atlas se
prepararon offline con el pipeline local autorizado. Originales y prompts conservados.

### Archivos y sprites

Carpeta: [`data/aventura/art/construction/`](art/construction/).

| Recurso | Máster | Sprite | Tamaño lógico recortado |
| --- | --- | --- | --- |
| Exterior de la regadera | [warehouse-exterior.png](art/construction/sources/warehouse-exterior.png) | `warehouse-watering-can` | 264 × 237 |
| Interior vacío/modular | [warehouse-interior.png](art/construction/sources/warehouse-interior.png) | `warehouse-watering-can-interior` | 480 × 469 |
| Saquito abierto | [gravel-sack-open.png](art/construction/sources/gravel-sack-open.png) | `gravel-sack-open` | 23 × 26 |
| Saquito atado | [gravel-sack-tied.png](art/construction/sources/gravel-sack-tied.png) | `gravel-sack-tied` | 23 × 26 |
| Icono de gravilla | El mismo máster del saco abierto | `gravel-sack-icon` | 50 × 56 |
| Mostrador/banco de trabajo | [warehouse-counter.png](art/construction/sources/warehouse-counter.png) | `warehouse-counter` | 88 × 45 |
| Expositor de materiales | [warehouse-stock-rack.png](art/construction/sources/warehouse-stock-rack.png) | `warehouse-stock-rack` | 81 × 76 |
| NPC constructor | [resident-111.png](art/residents/sources/resident-111.png) | `person-resident-111-*` — prefijo de autoría | 32 celdas de 48 × 48 |

El archivo del constructor está en la ubicación canónica de residentes, **sin duplicar el máster**
en la carpeta de construcción. Su recorte preparado está en
[`construction/cutouts/resident-111.png`](art/construction/cutouts/resident-111.png).

#### Packs independientes

| Pack PNG + JSON | Contenido | PNG |
| --- | --- | ---: |
| [warehouse-exterior](art/construction/packs/warehouse-exterior.json) | Edificio exterior | 111.668 bytes |
| [warehouse-interior](art/construction/packs/warehouse-interior.json) | Fondo interior sin NPC ni objetos sueltos | 321.216 bytes |
| [warehouse-props](art/construction/packs/warehouse-props.json) | Sacos, icono, mostrador y expositor | 33.844 bytes |
| [resident-111](art/construction/packs/resident-111.json) | Quieto y caminar en ocho direcciones | 62.793 bytes |

Cada JSON tiene al lado su PNG del mismo nombre. **529.521 bytes de PNG en total**, divididos para
poder cargar el interior únicamente al necesitarlo. Los tamaños RGBA y hashes exactos están en
[`manifest.json`](art/construction/manifest.json); el peso comprimido no equivale a
memoria de textura. No enviar másteres, prompts, recortes de autoría ni capturas al navegador.

También se entregan [PNG individuales](art/construction/sprites/) de los 39 sprites.
Son una alternativa al atlas y sirven para inspección: no descargar ambas representaciones.

### Constructor — residente 111

Duende maduro y robusto, piel tostada natural, nariz ancha, bigote oscuro y expresión simpática.
Gorro terracota de pico caído con parche verde; camisa clara arremangada, peto índigo remendado,
delantal corto de cuero, herramientas sujetas al cinturón y botas de trabajo. Manos libres para
hablar y caminar. Orejas puntiagudas, una por lado; sin duplicar puntas en los perfiles.

#### IMPORTANTE: número de archivo e identificador del motor NO son lo mismo

**`resident-111.png` es el nuevo residente solicitado. No asignarle automáticamente el variant
numérico `111`.** En el catálogo actual ese variant ya pertenece a `castana-bruma`, cuyo máster es
`resident-012`. No sobrescribirlo ni sustituir ninguno de los NPC existentes.

Esta entrega deja `runtimeVariant: null` y usa nombres de autoría `person-resident-111-*`.
El agente de integración debe elegir un variant libre, registrar el nuevo perfil y adaptar ese
prefijo al generar el pack activo. Aquí no se ha modificado `residents/catalog.json` ni se ha
añadido un protagonista elegible.

#### Contrato del sheet

- Grid **8 columnas × 4 filas = 32 poses**.
- Columnas: `down`, `down-right`, `right`, `up-right`, `up`, `up-left`, `left`, `down-left`.
- Fila 0: quieto. Filas 1, 2 y 3: pasos alternos y fase de paso intermedia.
- Claves: `person-resident-111-{dirección}` y `person-resident-111-{dirección}-walk-{1|2|3}`.
- Lienzo lógico común: **48 × 48**; ancla común: **[24, 46]**; altura de referencia: **40**.
- Textura por celda: **96 × 96**, porque `pixelRatio = 2`.
- **[Grid registrado para revisar](art/construction/review/resident-111-grid.png)**:
  768 × 384 píxeles, mismas celdas/registro que el atlas, sin escalado por pose que haga cambiar
  el tamaño del personaje.
- La galería ilustra el ciclo `1 → 2 → 3 → 2`. Es una demostración gráfica, no una modificación
  del controlador de animación.

Es un **NPC de almacén**, no un nuevo protagonista completo. No se han solicitado ni generado
poses de correr, remar, necesidades, llevar por un gato, etc. No reutilizarlo para esas acciones
suponiendo que existen.

### Indicaciones para la integración, todavía pendiente

1. **No cambiar la textura de los caminos por estos dibujos.** El saco representa el material;
   la economía y el acabado del camino son decisiones del sistema de construcción. Los nombres
   de sprite no añaden por sí solos un recurso al contrato de inventario.
2. La puerta del exterior está abierta: al colocar este edificio, hay que conectar su acceso al
   interior y permitir volver andando. El arte no implementa portales ni colisiones.
3. Exterior e interior se entregan por separado. El fondo interior tiene una salida inferior
   clara; definir la zona transitable sobre el suelo, no sobre la caja rectangular completa del
   PNG. Paredes y estantes no son transitables. Sus máscaras, colisiones y orden de oclusión
   requieren la revisión del agente que construya la escena.
4. Los muebles y sacos se colocan como entidades aparte, con la colisión e interacción que les
   correspondan. La imagen `review/warehouse-furnished.png` solo enseña una composición posible.
5. [`authoring.json`](art/construction/authoring.json) contiene `reviewLayout` con
   posiciones para reproducir ese montaje y referencias aproximadas de ambas entradas.
   **No son una escena, portales ni colisiones aprobadas.** El ancla del exterior se sitúa cerca
   del umbral; el fondo interior se coloca desde su esquina superior izquierda.
6. Los JSON de atlas usan el formato existente: `x/y` en píxeles de textura; `w/h`, `anchor`,
   `trim` y `bounds` en unidades lógicas. Con ratio 2, leer `[x, y, w*2, h*2]` de la textura y
   dibujar `[-anchor[0], -anchor[1], w, h]` respecto al punto de colocación. No volver a duplicar
   la escala del mundo ni usar el icono grande como saco del escenario.
7. No hay nombres de tienda, precios, cantidades, textos ni letreros horneados: la localización
   y los comportamientos pueden añadirse sin rehacer el dibujo.

### Reproducir y verificar el arte

```sh
php data/aventura/art/construction/prepare.php
```

Requiere PHP con GD. Es una herramienta offline de autoría; reutiliza los módulos existentes
`adventure-cutout.php`, `adventure-actor-registration.php` y `adventure-sprite-packer.php`.
Solo escribe recortes, packs, sprites y pruebas visuales dentro de `art/construction/`; no toca
catálogos activos, escenas, `public/`, guardados, API ni producción. Los originales no se alteran.

- [Prompts completos](art/construction/prompts/): las siete generaciones y sus
  referencias de estilo. Edificio inspirado en el acabado de la bota; NPC nuevo, no recolor de otro.
- [Definiciones de sprites](art/construction/sprite-definitions.json): para el
  empaquetador existente, **sin registrar todavía en `data/aventura/assets/`**.
- [Informe QA](art/construction/review/qa.json): hashes, recortes alfa, 32 poses
  medidas, márgenes estrictos por celda, ancla común y ausencia de celdas vacías/recortadas.
- Revisión visual: exterior, interior compuesto y todas las direcciones/fases del constructor.
- Galería comprobada en Chrome a **1280 × 1100, 834 × 1112 y 390 × 844**: imágenes cargadas, ocho
  direcciones animadas, sin errores ni desbordamiento horizontal, y movimiento reducido respetado.
  Capturas: [escritorio](art/construction/review/desktop.png),
  [tablet](art/construction/review/tablet.png),
  [móvil](art/construction/review/mobile.png).

**La entrega de arte está preparada. El almacén y el constructor no están puestos en el juego:
la instalación y sus pruebas funcionales corresponden al otro agente.**

## Entregas de arte integradas

Las carpetas de autoría (`art/*/`) conservan fuentes, prompts y `authoring.json`; sus notas de
entrega se recogen aquí una vez integradas, para que la carpeta hable de arte y no de planes.

### Protagonistas 101–110 (integrados el 19-sep-2026 como 200–209)

19-sep-2026. Los diez diseños están aprobados y registrados como protagonistas
200–209. El dueño pidió después integrar «Yo», unificar las tarjetas de los 18
y reutilizar la postura agachada para orinar en protagonistas femeninas.
La activación y sus pruebas se registran en `docs/RELEASE.md` (raíz del repo).
No se han alterado las identidades de los 100 NPC ni de los ocho protagonistas anteriores.

### Integración lista en local; producción a cargo del otro agente

Última instrucción del dueño: **no desplegar esta entrega**. Integración en el
commit `f3be956` (fuentes de arte aprobadas en `aeb9e72`). Copia de trabajo aislada:
`../magikitos-game-cast-release`, rama `cast-release-20260919`. Se evita tocar
los cambios de navegación en curso en la copia principal.

Artefacto local probado e instalado en DDEV: `f93b61c6d932e6f21f87`, 773 archivos.
SHA-256 de `release.json`: `d86eb6bdae74c96d06fc7d56de4f92c34533b09355d2ff02a4e30a2eb686f52a`.
El puntero de la web está cambiado **solo localmente**, no publicado ni commiteado.
No hay modificaciones de backend, migraciones, cuentas, partidas ni datos de producción.

Verificaciones: `npm test` completo; 126/126 hojas de acciones para 18 personajes;
contrato de 156 poses y comparación de siluetas horneadas de los diez nuevos;
invariancia de cuerpos/agarres y máscaras de remada; selección de los 18 y
persistencia en 1440×900, 768×1024 y 390×844; receta/hallazgos con movimiento
normal y reducido; frontera web/API y montaje DDEV en los seis idiomas.
Las cards se revisaron renderizadas, con lienzo completo, alfa gradual y gorros/pies
sin recorte. Son tres páginas, 2.638.400 bytes PNG en total y 5.971.968 bytes RGBA;
se prestan al abrir «Yo», no se descargan todas las acciones de los 18.

Para la publicación conjunta: integrar el commit, reconstruir y probar el artefacto
con los cambios del otro agente. El contrato deriva automáticamente los IDs 200–209
y su sexo; **reiniciar `bosque-vivo.service` al activar la release** para que la
presencia acepte el nuevo elenco. Seguir `docs/RELEASING.md`; no basta con copiar PNG.

Abrir [la galería local](art/playable-cast/review-101-110/index.html) directamente en el navegador.
Funciona sin servidor ni API: elegir duende/acción, animar o pausar y recorrer
fases. Los tiempos de ese visor son de inspección, no los del juego. Dentro
están las hojas completas, comparación de escalas, card y capturas de barcas.

### Entregables y contrato único

El manifiesto [approved-101-110.json](art/playable-cast/approved-101-110.json) identifica las diez
fuentes y sus keys. `resident-101` es un número de imagen, **no** el retirado
actor 101/Brezo bruma. Los IDs registrados son **200–209**.
El nuevo Avellano usa la key `avellano-cobre`: `avellano-alba` ya pertenece al
NPC 125, cuya identidad se conserva. No cambian su dibujo ni el número de fuente 107.

| Acción | Rejilla final | Frames | Lienzo lógico / ancla |
|---|---|---|---|
| andar/quieto | 8×4 | 32 | 48×48 / 24,46 |
| correr | 8×4 | 32 | 48×48 / 24,46 |
| remar | 8×4 | 32 | 64×56 / 32,40 |
| empujar | 4×4 | 16 | 48×48 / 24,46 |
| trabajar | 4×4 | 16 | 48×48 / 24,46 |
| llevado por gato | 8×2 | 16 | 48×48 / 24,4 |
| necesidades | 4×2 | 8 | 48×48 / 24,46 |
| hallazgo | 4×1 | 4 | 48×48 / 24,46 |

**156 frames por protagonista; 1.560 en esta entrega.** Mismas cantidades que
los ocho anteriores, comprobadas también en sus paquetes horneados actuales.
D8: abajo, abajo-derecha, derecha, arriba-derecha, arriba, arriba-izquierda,
izquierda, abajo-izquierda. D4: abajo, derecha, arriba, izquierda.
En andar la fila cero es reposo y las otras tres pasos; en necesidades la fila
cero es `pee-0…3` y la segunda `poop-0…3`. No se inventan poses adicionales.
Las correcciones parciales reemplazan celdas, nunca añaden fases al contrato.

Cada `<key>/` contiene:

- `authoring.json`: fuentes seleccionadas, prompts exactos, escalas por acción,
  pelvis y pivotes de manos medidos. Es la receta vigente; no escoger el PNG
  con el número mayor ni el primer intento de `sources/`.
- `sources/`, `prompts/`: originales de **imagegen integrado** y sus ediciones,
  sin sustituir el diseño aprobado. Los descartados no son entregables runtime.
- `review/{walk,run,row,push,work,carried,needs,discover}.png`: ocho maestros
  finales, siempre celdas de **384×384**. No publicar esos PNG grandes.
- `review/*-atlas.png` y JSON: prueba de la exportación a **2× con reducción
  integrada**, usando las funciones reales de registro y reducción.
- `review/row-fixed-bodies.png`: ocho cuerpos sentados sin remos, una fila D8.
  El sheet final de remada añade los remos a esas mismas imágenes invariantes.
- `review/row-rig-source.json`, `row-body-source.json`: agarres/palas y contornos
  corporales, en coordenadas del master respecto de pelvis `[192,270]`.
- `review/portrait.png`: card de 240×320, alfa real; personaje recortado del
  original aprobado, ambiente al 16% y halo suave al 24%. No rediseña la cara.
  `portrait.json` guarda hashes, rectángulo y escala; `portrait-backgrounds.png`
  muestra la misma card sobre tres fondos.
- `review/review.json`: registro, medidas, hashes y rig escalado para esta
  exportación. `browser-{chrome,webkit}/` contiene pruebas y capturas de barcas.

### Atención al integrar: escala, IDs y cards

1. `register-playable-art.cjs --character=KEY --enable` valida el manifiesto
   aprobado, impide colisiones de IDs y registra la base más las siete acciones.
   Los nuevos perfiles tienen `playableOnly: true`: no alteran el reparto NPC.
   Guarda las referencias normalizadas sin modificar los originales aprobados.
2. **Usar ancho nominal 384 tanto para andar como para las siete acciones.**
   Si andar se mide con 384 y las acciones se importan con 256, las acciones
   salen un 50% mayores. El visor/validador ya usa 384 en todas. Mantener las
   escalas medidas: no ajustar cada fotograma por su propia altura ni cambiar
   el tamaño corporal al correr/agacharse. Los ocho personajes previos conservan
   sus recetas, no aplicarles este cambio globalmente.
3. Mantener pelvis, oclusiones de palas lejanas y soporte sobre casco conforme
   a [ROWING-ART.md](../../docs/ROWING-ART.md). Ocho cuerpos constantes,
   cuatro fases de remos sincronizados; casco independiente. Escalar rig y
   máscaras con el mismo ratio que los píxeles, no offsets especiales por barca.
4. Cards con alfa: **no marcar `opaque: true`** ni hornearlas sobre un rectángulo
   de fondo. La política vieja de retratos opacos no sirve para estas cards.
   Los 18 retratos se paginan en atlas de hasta ocho tarjetas, menos de 4 MiB
   RGBA por textura. No descargar todas las acciones al abrir el selector.
5. Publicar únicamente atlas reducidos y manifiestos necesarios. El visor,
   prompts, fuentes, intentos y capturas se quedan como herramientas de autoría.
   Los diez conjuntos de PNG de revisión, cards incluidas, suman aproximadamente
   13,8 MB; eso **no** es una recomendación de descarga inicial. Medir los packs
   definitivos, memoria decodificada y liberación al cambiar de personaje.
6. Probar selección persistente, representación remota de otros jugadores y
   acciones reales en DDEV. `check-relief-art.cjs` comprueba postura femenina,
   orina y contabilidad intacta; `check-cast-browser.cjs` selecciona todos los
   personajes a tres tamaños. La prueba de arte aislada no sustituye estas puertas.

### Reconstrucción y comprobaciones

Desde la raíz del repo, sustituyendo la key por cualquiera de las diez:

```sh
php data/aventura/art/brezo-repair/prepare-row.php
php scripts/prepare-playable-master.php --character=zarza-sol
php scripts/prepare-playable-row.php --character=zarza-sol
php scripts/prepare-playable-review.php --character=zarza-sol
php scripts/prepare-playable-card.php --character=zarza-sol
php scripts/check-playable-row-master.php --character=zarza-sol --review-only
php scripts/check-playable-sheet-contract.php --all-approved
node scripts/check-playable-review-browser.cjs --character=zarza-sol
node scripts/check-playable-review-browser.cjs --character=zarza-sol --webkit
php scripts/prepare-playable-gallery.php
node scripts/check-playable-gallery.cjs
node scripts/register-playable-art.cjs --character=zarza-sol --enable
node scripts/build-woodland-kit.cjs
node tools/build.cjs
```

La generación de imágenes no es determinista. La reconstrucción **desde las
fuentes PNG seleccionadas** sí es offline y reproducible. El pipeline limpia
matte/alfa, separa siluetas sin cortar gorros, aplica una escala por acción y
compone los remos. Las correcciones de anatomía/ropa se hicieron con imagegen,
no borrando o inventando extremidades por código.

Resultados: los diez pasan el contrato (80 controles negativos de fase ausente),
invariancia de cuerpo/agarres al remar y render de las nueve barcas: 32 vistas
por casco × 10 personajes × 2 navegadores = **5.760 composiciones**. Agua/palas
producen recortes distintos y se respeta el buffer temporal de 512 KiB. También
se renderizan las 156 poses de cada uno a 1440×900, 768×1024 y 390×844, sin errores
JS ni desbordamiento. La galería recorre las 1.560 poses en ambos navegadores.

Estos tests garantizan formato, registro y composición; **no certifican por sí
solos anatomía, identidad ni calidad de animación**. Las hojas/contactos se han
revisado visualmente por separado y se dejan accesibles para la aprobación del
dueño. La prueba de arte por sí sola no acredita el despliegue: consultar el
registro de entregas. No queda world art pendiente en el alcance de esta tanda.

### Candidatos residentes 101–110

19-sep-2026. Diez identidades nuevas, **todas aprobadas por el dueño como protagonistas**.
**No hay integración, altas de NPC, cambios de catálogo, build ni despliegue.**
Esta carpeta conserva la selección visual original; las acciones completas y las
cards se entregan aparte en `../../../playable-cast/`. Estado y reconstrucción:
[entrega 101–110](#protagonistas-101110-integrados-el-19-sep-2026-como-200209).

Abrir [index.html](art/residents/candidates/101-110/index.html) en un navegador. [Resumen de diez](art/residents/candidates/101-110/review/overview.png).
Cada número designa un **archivo de residente**, no un ID de variante runtime (el antiguo
actor 101/Brezo bruma NO es el nuevo archivo resident-101).

### Diseños

| Fuente | Apodo provisional | Identidad visual |
|---|---|---|
| [101](art/residents/candidates/101-110/sheets/resident-101.png) | Rizo | Pelirrojo pecoso, cara afilada y sonrisa pícara; gorro mostaza y chaquetilla petróleo. |
| [102](art/residents/candidates/101-110/sheets/resident-102.png) | Chispa | Pelo blanco corto, piel tostada, cara angular y sonrisa con carácter; turquesa y ladrillo. |
| [103](art/residents/candidates/101-110/sheets/resident-103.png) | Tizon | Bajito y ancho, nariz redonda, cejazas y barba oscura; gorro teja y peto de artesano. |
| [104](art/residents/candidates/101-110/sheets/resident-104.png) | Nispera | Cara redonda madura, hoyuelos y sonrisa risueña; gorro coral largo y vestido ciruela. |
| [105](art/residents/candidates/101-110/sheets/resident-105.png) | Trebol | Anciano delgado, cara alargada y perilla plateada; gorro espiral salvia y chaleco naranja. |
| [106](art/residents/candidates/101-110/sheets/resident-106.png) | Mimbrera | Rostro anguloso, nariz marcada y trenza gris; gorro azul asimétrico y abrigo ocre. |
| [107](art/residents/candidates/101-110/sheets/resident-107.png) | Avellano | Mandíbula ancha, patillas pelirrojas y sonrisa desdentada; gorro violeta y peto azul. |
| [108](art/residents/candidates/101-110/sheets/resident-108.png) | Oria | Pómulos y ceja marcada, mirada de granuja; gorro corto canela con pluma y ropa teal. |
| [109](art/residents/candidates/101-110/sheets/resident-109.png) | Silo | Nariz prominente, gafitas y curiosidad de inventor; gorro beige curvado y abrigo rosa viejo. |
| [110](art/residents/candidates/101-110/sheets/resident-110.png) | Zarza | Complexión fuerte, piel oscura y sonrisa abierta; gorro largo burdeos, collar y bolsa tejida. |

### Qué incluye esta ronda

Diez grids de ocho columnas × cuatro filas: reposo y tres pasos, 32 vistas por
identidad. Orden D8: abajo, abajo-derecha, derecha, arriba-derecha, arriba,
arriba-izquierda, izquierda, abajo-izquierda. Son los originales de identidad;
las hojas finales de las ocho acciones están en `playable-cast/<key>/review/`,
con 156 frames por personaje, card alfa y comprobaciones independientes.

Estilo mate y ropa remendada coherentes con el arte original. Rasgos faciales,
siluetas de gorros, edades y complexiones distintos; tonos de piel naturales.
Collares, broches, bolsitos y decoraciones acotados, legibles al reducir.

Corrección expresa: cada oreja tiene un solo contorno y una sola punta; no debe
haber una segunda punta de piel entre oreja, pelo y gorro. Los primeros intentos
101/103 requirieron una edición específica. El primer 102 se sustituyó por una
identidad facial más diferenciada. No usar los intentos antiguos como referencia.

### Archivos reproducibles

- `prompts/`: prompts exactos, incluidos refinamientos y corrección de orejas.
- `sources/`: originales de imagegen integrado; se conservan los ensayos.
- `selection.json`: cuál es el original vigente de cada propuesta.
- `sheets/`: grids seleccionados con el matte de recorte limpiado, sin redibujar.
- `review/`: recortes frontales, resumen y hashes de procedencia.
- `candidates.json`: fichas de autoría iniciales; no es el catálogo del juego.
- `prepare-review.php`: presentación offline, sin registrar nada en el motor.

```sh
php data/aventura/art/residents/candidates/101-110/prepare-review.php
```

La selección del generador y el recorte local son procesos distintos: las
correcciones anatómicas se hacen con imagegen, NO borrando partes de la oreja
por código. La preparación local solo limpia alfa/matte, recorta vistas y
compone la hoja comparativa. Los originales no se sobrescriben.

Los avisos de margen quedan registrados en `review/provenance.json`: son
maestros para **elegir diseños**, no certificación de atlas listos para runtime.
La preparación posterior está medida y revisada en `playable-cast/`; no sustituir
sus maestros por estos grids de selección. Seguir la entrega específica y
`docs/ROWING-ART.md` al integrar. Los PNG de autoría no se envían al navegador.

### Pareja protagonista

Encargo del dueño, 18-sep-2026: mantener únicamente los dos protagonistas
activos, uno hombre (slot 100) y una mujer claramente diferente (slot 101).
Corregir la identidad/anatomía variable entre andar, correr y otras acciones.

**Decisión posterior explícita: UN SOLO SHEET con TODO por duende.** Cada PNG
se genera como hoja completa, no se entregan paquetes separados por acción.
La propuesta anterior de separar la producción queda descartada. Solo se
recortarán ampliaciones para revisión, no como assets alternativos de entrega.

### Coordinación con el agente de código

Esta carpeta contiene arte candidato, prompts y revisión. **No la consume el
motor automáticamente.** No se modifican JS/PHP, scripts, catálogos activos,
manifest, selección de avatares, partidas, barcos ni despliegues desde este
trabajo. No hornear el catálogo entero ni sobrescribir originales publicados.
El otro agente conserva el control de integración y publicación.

La aceptación anterior de los dos Brezos no resuelve el defecto observado por
el dueño: andar y correr tienen distinta anatomía. No usar el número de frames
o el encaje del pie como prueba de consistencia visual.

### Dirección visual fijada

- Referencia de estilo confirmada por el dueño: `residents/sources/resident-001.png`.
  El acabado redondeado/brillante de `brezo-alba-run-stride.png` está rechazado:
  no usarlo como referencia artística ni considerar arreglado el problema al
  igualar solamente alturas. Conservar el trazo fino, textura mate, cara y
  proporciones del original también en las acciones nuevas.
- **100 / Brezo, hombre:** duende joven adulto esbelto, orejas puntiagudas,
  rizos negros, nariz expresiva y sonrisa pícara. Gorro alto verde junco con
  pico doblado y remiendo óxido cosido; camisa ocre de puños de lino crudo,
  chaleco corto remendado, pantalones verdes con remiendos y botas marrones.
- **101 / Bruma, mujer:** duende joven adulta aventurera, orejas puntiagudas,
  piel humana cálida con pecas y trenza cobriza. Gorro ciruela de pico más
  lateral/doblado con remiendo mostaza, chaqueta corta turquesa remendada,
  pantalones oscuros cortos, medias y botines marrones. Ni cambio de color del
  hombre ni disfraz de princesa: silueta, pelo, cara y ropaje propios.
- Mismo lenguaje de dibujo y cámara elevada de tres cuartos. Detalle de píxel
  definido, sin plástico/brillos 3D. Los parches y costuras pertenecen a la
  ropa y no cambian de sitio entre frames. Sin armas ni accesorios nuevos.
- Cabeza, ancho del torso, longitud de brazos/piernas y volumen corporal son
  constantes. Correr cambia la pose, no convierte el duende en otro más gordo.
- Remero y sus dos remos, **sin casco ni asiento**. Conservar los ocho ángulos
  y su perspectiva; no reutilizar máscaras de otro cuerpo sin revisarlas.

### Alcance de cada set

Base: 8 direcciones × (quieto + 3 pasos). Acciones: correr 32, remar 32,
empujar 16, trabajar/cocinar 16, llevado por gato 16, necesidades 8 y hallazgo 4.
Total: **156 poses por personaje, 312 para la pareja**, incluidas las bases que
deben concordar con las acciones. Solo estos dos; no iniciar el elenco de 30.

Estado: **tanda detenida; las tres pruebas están RECHAZADAS**. El dueño rechaza
explícitamente la calidad. No importar estos PNG al catálogo ni usarlos como
referencia de estilo para la mujer. Cero protagonistas nuevos aprobados en esta
revisión. Los originales publicados siguen intactos.

### Resultado de las pruebas completas

Generación con la herramienta integrada `image_gen`; prompts exactos en
`prompts/`. Son pruebas fallidas, no entregables finales:

- `sources/100-complete-candidate-01.png`: 793 × 1983. Omite filas/fases,
  altera el estilo y no resuelve la postura llevado por gato.
- `sources/100-complete-candidate-02.png`: segunda prueba vertical; vuelve a
  omitir fases y no alcanza el trazo ni la anatomía del original.
- `sources/100-complete-candidate-03.png`: 1586 × 992. Prueba horizontal;
  incumple columnas/direcciones, pierde detalle y tampoco se acepta.
- `review/100-existing-pose-layout.png`: guía de distribución hecha con
  recortes del arte existente, incluida la carrera que el dueño ha rechazado.
  **No es arte nuevo ni una corrección de estilo**, solo una guía de poses.

La referencia original tiene 1774 × 887 para 32 poses; las generaciones han
devuelto aproximadamente la misma cantidad total de píxeles intentando incluir
156. No son los másteres de alta resolución solicitados. Ampliarlas no recupera
detalle ni corrige la deriva de diseño. No marcar fases como terminadas solo
porque haya dibujos en la hoja. La entrega pedida sigue siendo un solo sheet
por personaje; la producción necesita revisión antes de continuar.

### Distribución solicitada del único sheet

8 columnas × 20 filas, 160 celdas cuadradas, 156 poses y 4 celdas vacías.
Direcciones de ocho vistas: abajo, abajo-derecha, derecha, arriba-derecha,
arriba, arriba-izquierda, izquierda, abajo-izquierda.

| Filas (desde 1) | Contenido |
|---|---|
| 1 | Quieto, ocho direcciones |
| 2–4 | Andar: tres pasos, ocho direcciones |
| 5–8 | Correr: cuatro fases, ocho direcciones |
| 9–12 | Remar: cuatro fases, ocho direcciones |
| 13 | Empujar fases 0 y 1, cada una abajo/derecha/arriba/izquierda |
| 14 | Empujar fases 2 y 3, mismo orden |
| 15 | Trabajar fases 0 y 1, cada una abajo/derecha/arriba/izquierda |
| 16 | Trabajar fases 2 y 3, mismo orden |
| 17–18 | Llevado por gato: dos fases, ocho direcciones |
| 19 | Mear 0–3; cagar 0–3. Poses cómicas vestidas, sin anatomía explícita |
| 20 | Hallazgo 0–3 en columnas 1–4; columnas 5–8 vacías |

Esta es la distribución PEDIDA al generador. Se contrasta contra los píxeles
obtenidos antes de entregar; no asumir que el modelo respeta una cuadrícula.

### Brezo alba: corrección de correr y remar

Receta de la corrección aprobada de `run` y `row` del personaje 100.
Conservar andar/quieto, empujar, trabajar, llevado por gato, necesidades y
hallazgo. El elenco jugable se documenta en `docs/art-direction/DUENDES.md`; esta receta no lo modifica.
El contrato común está en `docs/ROWING-ART.md`. Los intentos de hoja completa en
`protagonist-pair` siguen rechazados; no se integran.

Se usa imagegen integrado para editar el dibujo tomando el original
`residents/sources/resident-001.png` como referencia de identidad y estilo.
Preparación local autorizada: recortes, alfa y registro, sin rediseñar mediante
filtros ni modificar el motor. Prompts exactos en `prompts/` y generaciones
inmutables en `sources/`. `review/` conserva comparativas y montajes de autoría;
solo los maestros seleccionados en `residents/actions/sources/` se hornean.

### Estado

- Carrera y remada terminadas e instaladas en DDEV: `e223116731b5acaa6b84`.
- Petición vigente: **un solo cuerpo sentado por dirección, idéntico en las
  cuatro fases**, incluidos manos, cara, ropa y posición. Solo se animan los
  remos alrededor de sus agarres fijos. Sustituye la anterior conservación de
  las otras 28 poses. Se mantiene oculto el remo lejano en `up-right/0`,
  `up-right/3`, `up-left/0`, `up-left/3`. Referencias anteriores conservadas:
  `review/row-owner-approved.png` y `review/row-before-fixed-body.png`.
- Remada ensamblada offline desde ocho cuerpos fijos, cabeza original, pala
  ilustrada y agarres medidos. Es un único paquete de remero con los remos,
  separado del casco. Atlas: `actor-100-row-e0f8cfd89c08.png`, 59.612 bytes.
- Asiento de la botella retrasado: `right` = `[-4,2]`, `left` = `[4,2]`,
  `down-right` = `[-3,-1]`, `down-left` = `[3,-1]`. Es configuración de esa barca,
  válida para cualquier remero; no un desplazamiento oculto en la anatomía del actor.
- Revisión final: `.local/vessel-art-reviews/100/fixed-body/all-32.png` y
  `fixed-body-webkit/all-32.png`. Ambos navegadores pasan la comprobación completa,
  no solo `--measure`. El ciclo real pasa en 1440×900, 768×1024 y 390×844,
  incluyendo movimiento reducido. DDEV sirve el atlas nuevo con el mismo hash
  que el archivo local; no hay errores JS/HTTP. Pasan las pruebas de integridad
  del elenco, los nueve cascos y el contrato de remada. Carrera y los demás
  paquetes no cambian en esta ronda.
- El recorte sigue nítido, sin opacidad parcial de palas bajo el agua. Las dos
  diagonales traseras conservan la fase 2 pasando sobre el casco, aprobada por el
  dueño: no se ha abierto su trayectoria. `hullSupportedOars` obliga a QA a medir
  solapamiento real con el casco, en vez de exigir inmersión a una pala elevada.
- `occludedOars` identifica únicamente las cuatro oclusiones secas; QA exige cero
  madera fuera de la máscara corporal. No debilita el contacto de las palas visibles.
- No se cambia el motor JS/PHP, otros personajes ni partidas. Se actualizan
  imágenes, datos de arte, sus pruebas y documentación. No publicar esta ronda.

### Maestros y reproducción

- Carrera: `../residents/actions/sources/brezo-alba-run-matte.png`.
- Remada: `../residents/actions/sources/brezo-alba-row-matte.png`.
- `php data/aventura/art/brezo-repair/prepare-run.php` reproduce la carrera en `review/`.
- `php data/aventura/art/brezo-repair/prepare-row.php` reproduce la remada en `review/`.
- `php data/aventura/art/brezo-repair/verify-refinement.php` verifica los píxeles
  corporales invariantes fuera de la cobertura de los remos, los agarres fijos,
  la correspondencia exacta del rig con la ilustración y las posiciones de asiento.
  Un control negativo altera una cara y comprueba que la prueba lo detecta.

La receta prepara cada cuerpo **fuera del bucle de fases**. Las cuatro vistas
laterales usan la primera postura de `row-empty-hands`; las cuatro restantes,
la primera postura de `row-matte-base-01`, separando sus remos mediante siluetas
de autoría. Se conserva el arte corporal original, sin nueva generación.
`review/row-fixed-bodies.png` guarda las ocho posturas; `row-oar-coverage.png`
delimita los únicos píxeles que pueden cambiar; `row-rig-source.json` conserva
los agarres/puntas medidos en píxeles fuente. El rig runtime es ese dato por
la escala de registro del actor, redondeado a dos decimales. Estos archivos
de autoría/prueba **no se descargan en el juego**.

Para revisar mientras otro agente o Studio construye, fijar el artefacto:
`node scripts/check-vessel-browser.cjs --variant=100 --vessel=bottle --label=fixed-body --release=<id>`.
Así no se mezcla una máscara nueva con un atlas anterior por cambios concurrentes
del puntero `current.json`.

Las recetas NO instalan ni sobrescriben los maestros seleccionados. Tras aprobar
un montaje nuevo, copiarlo a su fuente, actualizar su hash en el catálogo y usar
`prepare-adventure-cast.php --sheet brezo-alba-run-matte` / `brezo-alba-row-matte`;
después hornear y construir por el flujo normal. No cambiar los PNG antiguos:
siguen siendo procedencia de otros personajes. Los paquetes horneados anteriores
se sustituyen, pero fuentes, git y releases previas permiten recuperarlos.

Generación original: herramienta imagegen integrada, prompts exactos en `prompts/`.
Esta última corrección no ha usado nuevas generaciones: solo composición y anclas.

No declarar terminado por haber generado un PNG: revisar alternancia de piernas,
caras, siluetas, límites de celda y animación a escala de juego. El tamaño de
cuerpo no se normaliza por altura de cada pose agachada.

### Woodland kit: colección local de fuentes

Built-in image generation, one call per sprite/variant. 71 sprites plus one context
illustration. No CLI fallback. The owner explicitly authorised local matte removal;
all masters are preserved and their SHA-256 hashes are checked by the test suite.

See [the complete implementation and review](../../docs/WOODLAND-KIT.md).
`prompts.json` is the exact style/subject/native-size/anchor manifest.
`cutouts/` holds prepared alpha and provenance; `previews/` holds native QA sheets.

The fixed camera is retained. The archived UI labs that argued it were deleted on 17-sep-2026; the decision is the part that mattered.
No production writes, deployments or database imports.
