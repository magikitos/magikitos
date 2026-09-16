# Arte: fuentes y pipeline

Política vigente: [2× integrado y movimiento selectivo](../../docs/art-direction/DEFINITION-MOTION.md).
Maestros a buena resolución, texturas preparadas offline. Nunca descargar originales
ni escanear píxeles al arrancar. Textura 2× no duplica tamaño en el mundo: escala,
recorte y cuerpo físico son controles distintos.

## Fuentes de verdad

- [Kit del bosque](art/woodland-kit/prompts.json): casas, vegetación y muebles.
- [Pipeline y familias](../../docs/WOODLAND-KIT.md): alfa, anclas y variantes.
- [Ascua](../../docs/art-direction/DUENDES.md) y [cien NPC](../../docs/ISLET-AND-RESIDENTS.md).
- [Picnic](../../docs/PICNIC-POLISH.md): humanos animados y elementos de la manta.
- Gatos: `art/cats/`; botella, remos y río: `art/river/catalog.json`.
- [Prompts anteriores](ART-PROMPTS.md): procedencia, no guía para reintroducir
  mecánicas o diseños descartados.

`assets/*.json` define los módulos. `bake-adventure-atlas.php` genera paquetes
con hash y metadatos de ancla/recorte. El manifest decide qué se sirve: conservar
un maestro o pose archivada no obliga a descargarlo. No sustituir maestros por
sus derivados ni borrar la biblioteca NPC. Cambiar familias en
`element-families.json`, ejecutar `npm run art:catalog`, revisar diff y `npm test`.
Los prompts específicos viven junto a su colección, no en informes de entrega.

## Prompts fundacionales conservados por procedencia

Prototipos históricos: el protagonista vigente lleva gorro; no usa las proporciones
ni el diseño sin gorro de abajo. Estos prompts reproducen los originales antiguos,
no describen el arte actual.

## Forest prompt

Use case: stylized-concept. Asset type: production sprite atlas for an original cozy top-down browser pixel-art adventure, 1536x1024 PNG, genuinely transparent background. EXACT GRID: 3 columns by 2 rows of equal 512x512 cells, no dividers, no text. One isolated fully visible object CENTERED in each cell with at least 48px transparent margin on every edge. TOP LEFT: broad round lush oak with layered clustered foliage and short visible trunk, TOP MIDDLE: tall leafy hornbeam with rounded tapering crown and visible trunk, TOP RIGHT: low rounded leafy shrub with a few tiny cream flowers. BOTTOM LEFT: charming hollow old tree stump with moss, BOTTOM MIDDLE: cluster of three rounded mossy stones, BOTTOM RIGHT: cluster of three apricot-brown capped mushrooms with cream stems. True carefully crafted chunky 16-bit pixel art as if authored on 64x64 pixels per cell and nearest-neighbor enlarged 8x, crisp pixel squares and stair-step contours, no antialias, no painterly fine detail. Warm forest palette limited to deep teal-green shadows, moss green, golden lime sunlit leaves, warm umber trunks, cream highlights and terracotta. View is overhead three-quarter top-down 2D adventure perspective, looking down onto the foliage but seeing trunk front. Light from upper left, harmonized palette and pixel scale across every asset. No ground patches, no bases, no cast shadows, NO background illustration, no characters, no interface, no labels, no logos. Objects must be disconnected by real transparent space so each exact cell can be used independently as a game sprite. Lovingly detailed silhouette, inviting relaxing magical forest atmosphere, original artwork.

## Character prompt

Use case: stylized-concept. Asset type: original playable character sprite sheet, transparent PNG 1024x1024. A beautifully designed tiny friendly woodland duende for a cozy top-down 16-bit pixel adventure. Exact 4-column by 4-row grid, sixteen isolated full-body sprites, each centered in its 256x256 cell with feet on the same baseline and consistent head and body sizes. COLUMN 1 faces camera (south), COLUMN 2 faces right (east), COLUMN 3 faces away (north), COLUMN 4 faces left (west). ROW 1 idle standing, ROW 2 walking left leg forward with opposite arm swing, ROW 3 neutral walking passing pose, ROW 4 walking right leg forward with opposite arm swing. In all frames the same character: pointed elf ears extending sideways, soft round cheeky smiling face, warm peach skin, a tousled curved cinnamon auburn hair tuft with golden tips, NO hat, NO hood, NO weapons, teal short coat with little brass buttons, mustard neckerchief, brown satchel on back, plum trousers, little dark brown walking boots. Head roughly half the character height, expressive dark brown eyes, rounded silhouette, slim little body. Art direction: meticulously hand-pixelled GBA-era RPG sprite quality, 24px wide x32px high logical pixel character, crisp stepped pixels enlarged to the sheet, rich but tightly controlled 24-color palette, warm outline rather than solid black, charming clean shading, lit from upper left. View is slightly overhead 3/4 top-down adventure game perspective, not flat frontal portrait. TRUE TRANSPARENT BACKGROUND, no floor, no ground, no shadow, no scenery, no grid lines, no text. No resemblance to any existing named character, completely original Magikitos design. Must be usable directly as an animation atlas.
