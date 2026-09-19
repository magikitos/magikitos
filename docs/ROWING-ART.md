# Remada: cuerpo fijo, remos móviles, casco independiente

Decisión aprobada por el dueño el 18-sep-2026. Referencia visual: **Brezo alba**.
Este contrato sirve para todos los protagonistas y todos los cascos. No generar
una combinación distinta de duende y barca para cada pareja.

## Las tres piezas

1. **Duende sentado:** ocho imágenes, una por dirección. Cuerpo, cara, gorro,
   manos y punto de apoyo son invariables en las cuatro fases de esa dirección.
   Pies hacia delante, rodillas dobladas, manos sujetando los agarres. Sin barca,
   asiento visible ni remos en este maestro corporal.
2. **Remos del duende:** una pala ilustrada se compone offline alrededor de cada
   agarre. Ambos remos avanzan/retroceden juntos: nunca estilo piragua alternado.
   Cuatro fases: entrada, tracción, salida, recuperación. El agarre no se mueve.
3. **Casco:** ocho vistas independientes, con fondo cerrado y hueco central;
   sin remos, duende ni banco/asiento. Cada casco define dónde apoya la pelvis
   y sus máscaras. Cambiar de casco NO obliga a regenerar el personaje.

Orden de direcciones: `down`, `down-right`, `right`, `up-right`, `up`, `up-left`,
`left`, `down-left`. La tira corporal final es **8 × 1**. Una generación de
autoría puede distribuir esos ocho cuerpos en 4 × 2 para tener más definición;
se recolocan sin cambiar la dirección ni reflejar ropa asimétrica.

## Lo que se genera y lo que descarga el navegador

Se preparan ocho cuerpos, no 32 interpretaciones del mismo personaje. Al hornear,
se repite cada cuerpo exactamente y se añaden sus dos remos en cuatro ángulos.
El resultado sigue siendo **8 × 4 = 32 fotogramas**, en un atlas del remero.
No se superponen cuerpos ni se redibuja anatomía durante el ciclo.

El juego descarga solo el atlas optimizado del protagonista elegido y el casco
que usa. Los cuerpos grandes, prompts, PNG de autoría y máscaras de comprobación
no forman parte de la descarga. No aumentar el trabajo del servidor ni añadir
generación/composición de hojas al arranque del navegador.

## Registro y clipping

- El personaje se registra por la **pelvis**, no por la punta cambiante del remo
  ni normalizando la altura de cada postura. El tamaño se relaciona con su hoja
  original de andar; sentarse no agranda cabeza, manos o ropa.
- Cada dirección tiene dos agarres fijos y cuatro pares de puntas. El rig guarda
  `[gripX, gripY, tipX, tipY, bladeRadius, bladeLength]` en coordenadas lógicas
  relativas al asiento. Las medidas salen de la ilustración, no a ojo en runtime.
- `data/aventura/rowing.json` contiene rigs de personajes, protecciones corporales
  y propiedades de cascos. `player-art.json` enlaza cada protagonista a su rig.
- Cada casco tiene `rowerOffset`/escala, borde frontal, máscara del remo lejano
  y configuración de inmersión. El motor reutiliza las rutas y superficies de
  trabajo; no se crean imágenes/canvases nuevos por fotograma.
- El borde puede tapar piernas/parte del remo, pero nunca cuello o cabeza. El
  agua corta limpiamente la pala sumergida: **no vuelve la madera semitransparente**
  ni pinta agua por encima del fondo opaco de la barca.
- En Brezo, el remo lejano de `up-right` y `up-left` se oculta completamente en
  fases 0/3 porque queda tras la cabeza. Se conserva su rig físico y se omite su
  tinta en la composición. No borrar remos arbitrariamente de otras vistas.
- Las diagonales traseras en fase 2 pasan sobre el casco; la prueba mide ese
  solapamiento real. No forzar inmersión donde la pala está sobre el plástico.

## Reconstruir la referencia aprobada

Para los nuevos protagonistas, la misma técnica está generalizada en
`scripts/prepare-playable-row.php --character=<key>`. Lee ocho cuerpos sin remos
y sus pelvis/agarres medidos en `playable-cast/<key>/authoring.json`. Escribe la
tira corporal, las 32 composiciones, cobertura de remos, rig y silueta corporal
de revisión. `check-playable-row-master.php --character=<key>` comprueba cuerpo
invariable, agarres y correspondencia exacta de rig/arte, con control negativo.
No habilita personajes, no cambia cascos ni instala el resultado por sí solo.

Registro reproducible de un nuevo protagonista, tras revisar sus maestros:

```sh
php scripts/prepare-playable-master.php --character=sauco-sol
php scripts/prepare-playable-row.php --character=sauco-sol
node scripts/register-playable-art.cjs --character=sauco-sol
php scripts/check-playable-row-master.php --character=sauco-sol
```

El registrador copia únicamente los siete maestros seleccionados, conserva su
procedencia y vuelve a medir la escala antes de escribir su rig y protección
corporal. Repetirlo reemplaza sus entradas, no añade duplicados. No toca el NPC
original, ningún casco ni partidas; tampoco instala o publica. `--enable` añade
la entrada al elenco local para hornear y hacer la revisión navegando. No usarlo
como sustituto de la revisión visual ni para personajes fuera del elenco elegido.

Desde la raíz del repo del juego, con PHP GD y dependencias JS locales:

```sh
php data/aventura/art/brezo-repair/prepare-row.php
php data/aventura/art/brezo-repair/verify-refinement.php
```

La receta **no instala nada**. Escribe en `data/aventura/art/brezo-repair/review/`:

- `row-fixed-bodies.png`: ocho cuerpos sin remos, 3072 × 384.
- `row-oar-coverage.png`: píxeles en que pueden variar los remos; prueba offline.
- `row-rig-source.json`: agarres/puntas/radios medidos en píxeles de autoría.
- `brezo-alba-row-matte.png`: maestro compuesto 8 × 4, 3072 × 1536.

La prueba compara el maestro seleccionado en `residents/actions/sources/` con
los cuerpos fijos, comprueba los agarres y el rig escalado, y contiene un control
negativo que altera una cara para asegurarse de detectar una regresión.

Tras revisar un maestro nuevo: conservar la fuente anterior, copiar el aprobado
a `residents/actions/sources/`, actualizar su SHA-256/procedencia en el catálogo,
prepararlo, hornear y construir. No cambiar hashes para ocultar una diferencia.

```sh
php scripts/prepare-adventure-cast.php --sheet brezo-alba-row-matte
node tools/build.cjs
node tools/install-local.cjs
```

El último comando instala **solo en DDEV** y conserva releases anteriores.
No despliega en producción ni modifica partidas. La receta específica y prompts
originales están en `data/aventura/art/brezo-repair/README.md`.

## Comprobación visual obligatoria

Con el servidor local de preview en 47834 (`node tools/preview.cjs --no-build --offline`):

```sh
node scripts/check-vessel-browser.cjs --variant=100 --vessel=bottle --label=review --release=ID
node scripts/check-vessel-browser.cjs --variant=100 --vessel=bottle --label=review-webkit --browser=webkit --release=ID
GAME_PLAYER_VARIANT=100 node scripts/check-rowing-motion-browser.cjs
node scripts/check-vessel-fleet.cjs --variant=100
```

`ID` es el identificador de 20 caracteres de un artefacto local, no texto literal.
Fijarlo impide revisar accidentalmente otro atlas si Studio u otro agente está
construyendo. La prueba de flota requiere no avanzar el puntero durante la prueba.

Revisar las 32 composiciones, agarres, oclusiones secas, contacto real con agua,
protección de cabeza, fondo del casco y ciclo navegando en escritorio/tablet/móvil.
No basta con que exista un PNG o pase el chequeo de tamaños.

## Añadir un protagonista o una barca

**Nuevo protagonista:** mantener su NPC original; preparar ocho cuerpos sentados
de esa misma identidad; medir pelvis/manos; componer remos sincronizados; revisar
los 32 fotogramas y registrar su propio rig. No copiar un rig ajeno sin comprobar
que sus agarres y palas coinciden. Solo hacerlo elegible cuando sus siete acciones
estén completas, horneadas y revisadas.

**Nuevo casco:** preparar sus ocho vistas vacías con fondo, registrar asiento y
máscaras, reutilizar los atlas de los protagonistas. Probar el casco con figuras
de varias complexiones antes de ofrecerlo. No incrustar un remero en su imagen.

Los nueve cascos actuales se conservan: botella, madera elegante, madera pintada,
nuez, hoja, corteza de abedul, corcho, lata y calabacita. Que exista un casco
preparado no implica que se ofrezca al jugador en esta fase de la aventura.
