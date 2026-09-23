# Arte del bosque · encargos y entregas

## Arte entregado · 23 de septiembre de 2026: la bienvenida

**Cinco láminas para la presentación que ve una persona la primera vez que entra al bosque.**

**Entregadas e integradas.** Salen en el juego la primera vez que alguien entra (ver
«Estado de integración», más abajo). No falta ningún dibujo.

### Archivos finales

Todos son PNG indexados de **760×570 px**, opacos, **256 colores**, proporción 4:3,
para mostrarlos a 380×285 px (densidad 2×). No llevan texto ni el marco de papel de la UI.

| Paso | PNG listo para hornear | Peso |
| --- | --- | --- |
| 1 · Explora | [welcome-1-explora.png](data/aventura/art/welcome/sources/welcome-1-explora.png) | 335,4 KiB |
| 2 · Escape room | [welcome-2-escape-room.png](data/aventura/art/welcome/sources/welcome-2-escape-room.png) | 347,4 KiB |
| 3 · Interactúa | [welcome-3-interactua.png](data/aventura/art/welcome/sources/welcome-3-interactua.png) | 325,9 KiB |
| 4 · Descubre | [welcome-4-descubre.png](data/aventura/art/welcome/sources/welcome-4-descubre.png) | 308,9 KiB |
| 5 · Relájate | [welcome-5-relajate.png](data/aventura/art/welcome/sources/welcome-5-relajate.png) | 320,5 KiB |

Total de los cinco PNG: **1.677.460 bytes, 1,60 MiB** antes del empaquetado.

### Referencias y comprobaciones de la entrega

- **Ascua es el mismo protagonista en las cinco láminas**: gorro naranja remendado, pelo
  castaño, chaqueta azul petróleo, camiseta ocre, pañuelo naranja y pantalón marrón de parches.
  Referencia: [ascua-walk.png](data/aventura/art/cast/cutouts/ascua-walk.png), variante 0 del
  elenco. Es el hilo narrativo de estas ilustraciones; no cambia el avatar elegido en el juego.
- El vecino de la tercera es **Brizno**, basado en
  [brizno-seated.png](data/aventura/art/cast/cutouts/brizno-seated.png).
  Su bocadillo solo contiene los tres puntos gráficos previstos, sin palabras.
- Se han usado el roble, la casa-seta y la botella del juego como referencias de materiales
  y siluetas. La barca aparece sin asiento y con los dos remos separados en la orilla.
  Las láminas son viñetas narrativas, no un plano literal ni coordenadas navegables del mapa.
- Revisadas juntas a [380×285 px](data/aventura/art/welcome/reviews/contact-380.png)
  y a [280×210 px](data/aventura/art/welcome/reviews/contact-280.png): protagonistas,
  pistas, barca y hamaca legibles. Los rótulos de estas hojas de revisión **no** están
  incluidos en los PNG finales. Son copias de revisión locales, excluidas de Git según
  la política existente del repositorio. Los cinco PNG finales, másteres y prompts sí
  quedan en rutas no excluidas. Los motivos principales quedan a salvo del recorte de 8 px.
- [delivery.json](data/aventura/art/welcome/delivery.json) contiene dimensiones, colores,
  comprobación de opacidad, pesos, hashes y las rutas exactas de fuentes y referencias.
  Es documentación de arte, **no un manifiesto registrado en el motor**.
- Generación con la herramienta integrada **imagegen**. Se conservan los
  [cinco prompts](data/aventura/art/welcome/prompts/) y los
  [másteres originales](data/aventura/art/welcome/masters/) de 1448×1086 px, sin modificar.
  Cada uno usa el mismo nombre base que su PNG final.
- Preparación offline: reducción de área al tamaño final, sin recorte ni deformación;
  cuantización con `pngquant 3.0.3`, 256 colores, `--speed 1 --nofs --quality 0-100 --strip`.
  La paleta es una reducción con pérdida revisada visualmente; los másteres conservan
  todos los colores. No se aplica tramado Floyd–Steinberg para evitar ruido en los detalles.

**Para integrar:** en este encargo los archivos de `welcome/sources/` son ya los finales
a 2×. Los originales de `masters/` son solo de archivo: no deben ir al navegador.
No volver a duplicar el tamaño de los finales. Conservar el encuadre completo y añadir marco,
texto traducido y botones desde
la UI existente. No hay ningún asset pendiente de las cinco láminas.

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

### Estado de integración

Integradas el 23 de septiembre de 2026 (`public/assets/js/adventure/welcome.js`, prueba
`npm run test:welcome`).

- **Un paquete por lámina** (`data/aventura/assets/welcome-*.json`): se pide solo al llegar a
  esa lámina, y la siguiente de antemano. A quien ya la ha visto no le cuesta ni un byte.
- **Hojas preparadas en `welcome/sheets/`**: las de `sources/` cuantizadas una vez a **255**
  colores (`pngquant 255 --speed 1 --nofs --strip`). El atlas lleva un margen transparente,
  que es el color 256; con 256 en el dibujo el empaquetador no podía guardar paleta exacta y
  cada paquete salía a ~1 MB. Así pesan 318-355 KB, y se ven igual.
- `sources/` y `masters/` no viajan al navegador. Si el diseñador cambia una lámina, se
  sustituye en `sources/`, se vuelve a cuantizar a `sheets/` y se hornea
  (`php scripts/bake-adventure-atlas.php`).

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
