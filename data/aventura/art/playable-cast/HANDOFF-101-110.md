# Protagonistas 101–110 · entrega de arte

19-sep-2026. Los diez diseños están aprobados y registrados como protagonistas
200–209. El dueño pidió después integrar «Yo», unificar las tarjetas de los 18
y reutilizar la postura agachada para orinar en protagonistas femeninas.
La activación y sus pruebas se registran en `docs/RELEASE.md` (raíz del repo).
No se han alterado las identidades de los 100 NPC ni de los ocho protagonistas anteriores.

Abrir [la galería local](review-101-110/index.html) directamente en el navegador.
Funciona sin servidor ni API: elegir duende/acción, animar o pausar y recorrer
fases. Los tiempos de ese visor son de inspección, no los del juego. Dentro
están las hojas completas, comparación de escalas, card y capturas de barcas.

## Entregables y contrato único

El manifiesto [approved-101-110.json](approved-101-110.json) identifica las diez
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

## Atención al integrar: escala, IDs y cards

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
   a [ROWING-ART.md](../../../../docs/ROWING-ART.md). Ocho cuerpos constantes,
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

## Reconstrucción y comprobaciones

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
# Tras revisar, registro y build (no publican por sí mismos):
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
