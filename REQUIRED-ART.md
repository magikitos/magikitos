# Arte pendiente del bosque

## Encargo abierto · 23 de septiembre de 2026: la bienvenida

**Cinco láminas para la presentación que ve una persona la primera vez que entra al bosque.**

### Qué es y por qué

Hoy quien llega al juego pulsa «Explorar», aparece en la pradera junto al pícnic y nadie le dice
nada. Lo medido: la mayoría se va sin hacer ni una acción. La bienvenida resuelve eso con cinco
pasos cortos, **solo la primera vez** (nunca vuelve a salir, tampoco en otro aparato con cuenta).

- Sale **encima del mundo**, con el mismo panel que ya usan los cuentos y los chistes dentro del
  juego: la lámina arriba, en su marco de papel crema ligeramente girado, y el texto debajo.
- Botones: «Siguiente» en los cuatro primeros, «¡A explorar!» en el último, y «Saltar» siempre.
- El texto lo pone el juego, en seis idiomas. **La lámina no lleva ni una letra.**
- Se plantea como un **escape room**, que la gente ya sabe lo que es.

### Los cinco pasos (el texto va debajo de cada lámina)

| # | Título | Texto | Qué tiene que contar la lámina |
| --- | --- | --- | --- |
| 1 | **Explora** | Este es tu duende y este es tu bosque. Anda por donde quieras y toca todo, que casi nada está de adorno. | Un duende pequeño, de espaldas o de tres cuartos, asomado al borde de la pradera mirando un bosque enorme que se abre delante: árboles, un caminito, humo de una chimenea a lo lejos. Sensación de «todo esto es para mí». |
| 2 | **Escape room** | ¡Como un escape room, pero bosquero! Cada objeto sirve para algo y cada vecino sabe una pista. | El guiño del escape room hecho bosque: un tocón o una puertecita en un árbol con un candado de raíces, y alrededor tres o cuatro objetos sueltos que claramente encajan en algo (una llave de ramita, una seta, una navaja, un mechero). El duende rascándose la cabeza delante. |
| 3 | **Interactúa** | Habla con los vecinos y recoge lo que encuentres. Lo que llevas en el saco es la llave de algo. | Dos duendes charlando (uno con su bocadillo de charla, el icono de siempre), y el nuestro con el saco abierto enseñando lo que lleva. Complicidad, trueque, «ah, ¡esto era para ti!». |
| 4 | **Descubre** | Al principio solo llegas a la pradera. Cada acertijo que resuelves te abre un camino nuevo, primero el río y luego la otra orilla. | Un mapa del bosque visto desde arriba: la pradera iluminada y con color, el resto cubierto de niebla, y una franja de río que se está destapando con una barca y sus remos en la orilla. Es la idea de «el mapa se desbloquea» y tiene que leerse sin texto. |
| 5 | **Relájate** | Aquí no hay prisa y no se pierde nunca. Tu partida se guarda sola, así que vuelve cuando quieras. | El duende tumbado en una hamaca o sentado junto a su casa-seta al atardecer, una taza humeando. Calma total, cierre cálido. |

**Lo que NO puede salir en ninguna lámina**: cuentos, chistes, el diario, el restaurante ni la
tienda. Son sorpresas que la persona tiene que encontrar sola, y la bienvenida no las destripa.
Tampoco setines, monedas ni nada que parezca una puntuación: el bosque no va de eso.

### Formato

- **Estilo**: el del propio juego, pixel art del bosque Magikitos a **2×** (dos píxeles de
  textura por unidad del mundo), con la misma paleta y la misma luz que las escenas. Tiene que
  parecer una viñeta del mundo, no una ilustración de otra casa.
- **Duendes**: con la cara y la ropa del elenco del juego (`data/aventura/art/cast/`). El duende
  «nuestro» es el mismo en las cinco láminas, para que se lea como una historia.
- **Tamaño**: **760 × 570 px**, proporción **4:3**, fondo opaco (no transparente: va dentro de un
  marco de papel). Se pinta a unos 380 × 285 px en pantalla, o sea exactamente la mitad.
- **Encuadre**: lo importante en el centro. El marco se come unos 8 px por lado y en el teléfono
  la lámina se reduce, así que nada que tenga que leerse pegado al borde.
- **Sin texto, sin letras, sin números** dentro del dibujo.
- **Paleta cerrada**: como máximo 256 colores por lámina (es lo que exige el empaquetador).
- **Entrega**: PNG, uno por paso, en `data/aventura/art/welcome/sources/` con estos nombres:
  `welcome-1-explora.png`, `welcome-2-escape-room.png`, `welcome-3-interactua.png`,
  `welcome-4-descubre.png`, `welcome-5-relajate.png`.

### Mientras no estén

La bienvenida funciona ya sin ellas: donde irá cada lámina se pinta un marco neutro de papel
vacío. Cuando lleguen, se hornean en un paquete propio que solo se descarga si la persona está
viendo la bienvenida, así que no pesan nada a quien ya la ha visto. No hace falta cambiar código.

---

## Lo ya entregado

**Todo lo encargado antes está integrado y en el juego.**

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

### Dónde vive y cómo se vuelve a hornear

- Las hojas preparadas son [`data/aventura/art/forest-life/sheets/`](data/aventura/art/forest-life/sheets/)
  y su catálogo es [`catalog.json`](data/aventura/art/forest-life/catalog.json). Los originales
  de alta resolución (`sources/`) no viajan nunca al navegador.
- `node scripts/prepare-forest-life.cjs` convierte el catálogo en un paquete por hoja (cada cara
  carga solo su hoja, y solo cuando va a sentarse o a pescar) y copia a `data/aventura/life.json`
  las puntas de caña. Después, `php scripts/bake-adventure-atlas.php` hornea los paquetes.
- Las celdas entran tal cual, sin reajustar ni recentrar: el registro es el del diseñador.
- El panel del diario se cuantizó una vez en su hoja (`pngquant`, calidad 85–98): se ve igual y el
  paquete pesa 149 KB en vez de 326.

### Para más adelante (opcional)

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
