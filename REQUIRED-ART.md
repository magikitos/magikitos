# Arte de la vida del bosque

## Estado · 23 de septiembre de 2026

**Todo lo encargado está integrado y en el juego. No falta ningún dibujo.**

| Entrega | En el juego |
| --- | --- |
| Huerto: 4 cultivos nuevos y las etapas de los 8 | Crecen con el reloj compartido (brote, joven, listo) en el huerto del sauce y en el huerto de cocina del restaurante |
| Sentarse: 18 personajes | Se sientan de verdad en bancos, taburetes y butacas, pintados delante del asiento |
| Pesca: 6 personajes y la salpicadura | Pescan con su caña dibujada y el sedal sale de la punta. También los pescadores fijos del Studio, si su cara tiene hoja |
| Bocadillos: 7 iconos | Charla, canturreo, siesta, «¡pica!», saludo, cariño y lectura |
| Diario: libro, hojas que pasan y panel | El libro está sobre su mesa en la plaza del restaurante y el panel es el libro que se lee y en el que se escribe (ver [`DIARIO.md`](DIARIO.md)) |

Solo pueden sentarse, cavar y pescar las caras que tienen su hoja: no se finge ninguna postura.
Las demás pasean, charlan, duermen la siesta, se calientan en la hoguera, se juntan en las mesas y
leen el diario.

## Dónde vive y cómo se vuelve a hornear

- Las hojas preparadas son [`data/aventura/art/forest-life/sheets/`](data/aventura/art/forest-life/sheets/)
  y su catálogo es [`catalog.json`](data/aventura/art/forest-life/catalog.json). Los originales
  de alta resolución (`sources/`) no viajan nunca al navegador.
- `node scripts/prepare-forest-life.cjs` convierte el catálogo en un paquete por hoja (cada cara
  carga solo su hoja, y solo cuando va a sentarse o a pescar) y copia a `data/aventura/life.json`
  las puntas de caña. Después, `php scripts/bake-adventure-atlas.php` hornea los paquetes.
- Las celdas entran tal cual, sin reajustar ni recentrar: el registro es el del diseñador.
- El panel del diario se cuantizó una vez en su hoja (`pngquant`, calidad 85–98): se ve igual y el
  paquete pesa 149 KB en vez de 326.

## Para el próximo encargo (opcional)

Nada de esto hace falta para que el bosque funcione; solo daría más vida.

1. **`sit` y `work` para más caras.** Hoy se sientan y cavan los 18 personajes con acciones. Los
   vecinos fijos de cada escena tienen otras caras y no lo hacen. Si se amplía, empezar por los que
   más se ven en la pradera y el sauce. Misma receta: rejilla 4×4, `down`, `right`, `up`, `left` ×
   `sit-0..3` (o `work-0..3`), celdas de 96×96 px, pies en `[24,46]` y cadera en `[24,34]`.
2. **`fish` para más caras.** Hay 6 pescadores. Con 2 o 3 más, los pescadores fijos del sauce y
   la pradera también pescarían con dibujo propio. Receta: 2×4, `left`, `right` × `fish-0..3`,
   con `rodTip` en el catálogo.

Convención para cualquier hoja nueva: pixel art del bosque Magikitos a 2× (dos píxeles de textura
por unidad del mundo), fondo transparente, sin sombra propia, celdas registradas por los pies, y
una entrada por fotograma en el catálogo con `rect`, `size` y `anchor`.
