# Arte que falta para la vida del bosque

El bosque ya vive con el arte que hay: los vecinos pasean por los caminos, caminan en pareja,
charlan con bocadillos, se echan la siesta en la hamaca, se sientan en los bancos, cuidan el huerto,
se calientan en la hoguera y pescan en la orilla (`public/assets/js/adventure/life.js`). Donde falta
un dibujo, el juego usa un apaño que funciona, y el dibujo lo sustituye **solo, sin tocar código**,
en cuanto entra en un paquete con el nombre de esta lista.

Estilo y formato, igual que lo que ya está en el juego:

- Pixel art del bosque Magikitos, mismo trazo, paleta y luz que `garden`, `woodland-bench` y los
  actores `actor-105` y compañía.
- **Densidad 2×**: se entrega al doble del tamaño en el mundo (un recuadro de 48×48 del mundo son
  96×96 px en el PNG). Fondo transparente y sin sombra propia (la sombra la pinta el juego).
- Personajes con los pies en el mismo punto de anclaje que su hoja de andar (48×48 del mundo, pies
  a 24,46).

Ordenado por lo que más vida da por cada dibujo.

## 1. Huerto: cuatro verduras nuevas y el crecimiento (prioridad alta)

Hoy hay zanahorias, coles, remolachas y hierbas, siempre en su punto. Faltan tomates, berenjenas,
cebollas y patatas, y que el huerto **crezca**: con las etapas, cada bancal pasa por sembrado,
creciendo y listo en un ciclo de 1,5 a 3 horas con el reloj compartido. Todos los jugadores lo ven
en la misma etapa a la vez.

| Sprite | Qué es | Tamaño en el mundo |
| --- | --- | --- |
| `garden-tomatoes` | bancal de tomateras con tutores y tomates rojos | 64×45 |
| `garden-eggplants` | bancal de berenjenas moradas | 64×45 |
| `garden-onions` | bancal de cebollas asomando | 64×42 |
| `garden-potatoes` | bancal de patatas: matas y alguna patata a la vista | 64×42 |
| `garden-<cultivo>-sprout` | el mismo bancal recién sembrado: tierra removida y brotes | igual que su bancal |
| `garden-<cultivo>-young` | a medio crecer, sin fruto | igual que su bancal |

`<cultivo>`: `carrots`, `cabbages`, `beets`, `herbs`, `tomatoes`, `eggplants`, `onions` y `potatoes`.
En total son **4 bancales nuevos y 16 etapas (20 dibujos)**, en una sola hoja con los que ya hay.
La caja y el ancla de cada etapa tienen que ser las de su bancal final, para que no salte al crecer.
Los bancales nuevos los coloca el dueño con el Studio donde quiera: el juego ya sabe que se cuidan.

## 2. Sentarse (prioridad alta)

Solo una cara tiene dibujo de sentado. Mientras tanto, el juego sienta a los demás con un truco:
el cuerpo de pie sobre el asiento y las piernas tapadas por el banco. Con dibujo propio se ve de
verdad sentado y se balancea un poco (el ciclo de `seating.js` ya existe).

- Acción `sit` para los **18 personajes que ya tienen acciones**, los de
  `data/aventura/art/residents/actions/catalog.json` `variants` (100, 120, 135, 142, 166, 172, 194,
  198 y 200 a 209).
- Rejilla de **4 direcciones × 4 fotogramas**: `down`, `right`, `up`, `left` × `sit-0` (quieto),
  `sit-1` (parpadeo), `sit-2` (contento) y `sit-3` (parpadeo contento). La dirección que más se ve
  es `down`, sentado de cara a la cámara.
- Nombres: `person-<id>-<dir>-sit-<n>`, como `person-12-*-sit-*`, que ya existe.
- Cadera a la altura de un asiento de 12 px del mundo sobre el suelo, pies colgando y sin banco
  dibujado: el banco es otro sprite.

Son 16 celdas por personaje, 288 en total. Es la receta de `work`, con una línea más en
`catalog.json` (`"sit": { "grid": [4, 4], "directions": ["down","right","up","left"] }`).

## 3. Trabajar el huerto para todos (prioridad media)

La acción `work` ya existe para esos 18 personajes y el huerto la usa: quien la tiene cava con su
propio dibujo. El resto hace un vaivén y le saltan hojitas. La población nueva ya se reparte
preferentemente entre esos 18. Si se quiere que cualquier vecino cave, es la misma acción `work`
para más caras, y conviene empezar por las familias que más salen en los sauces y la pradera.

## 4. Pesca con caña (prioridad baja)

Hoy la caña, el sedal y el corcho se dibujan con líneas, y cuando pica salen un «¡!» y unas ondas.
Funciona y se lee bien. Con dibujo propio:

- Acción `fish` para **4 a 6 personajes**: no hace falta para todos, porque solo pescan unos pocos a
  la vez. Rejilla de **2 direcciones (`left`, `right`) × 4 fotogramas**, llamados
  `person-<id>-<dir>-fish-0` (esperando), `-1` (tirón), `-2` (recogiendo) y `-3` (pez en alto). La
  caña va en el dibujo; el sedal y el corcho los sigue pintando el juego.
- `fish-splash-0`, `-1` y `-2`: salpicadura en el corcho, 16×16.

## 5. Opcional: bocadillos más bonitos

Los bocadillos se dibujan con píxeles en el propio juego. Si se quieren con más personalidad, una
hoja de **6 iconos de 12×14** con el bocadillo incluido: `emote-talk` (charla «…»), `emote-note`
(canturreo), `emote-zzz` (siesta), `emote-bang` (¡pica!), `emote-wave` (saludo con la mano) y
`emote-heart` (cariño).

## 6. El Diario del Bosque (prioridad alta cuando se construya)

Un libro gordo abierto encima de una mesa de la pradera, donde cualquiera deja una página al día
(el plan entero está en [`DIARIO.md`](DIARIO.md)). La mesa ya existe (`table`); el libro va encima
como sprite aparte, para poder ponerlo en cualquier mesa.

| Sprite | Qué es | Tamaño en el mundo |
| --- | --- | --- |
| `forest-diary` | libro grande abierto, lomo de cuero verde, un tintero y una pluma al lado | 32×20 |
| `forest-diary-flip-0`, `-1`, `-2` | una hoja pasando sola con la brisa (se reproduce de vez en cuando) | igual que `forest-diary` |
| `forest-diary-panel` | la doble página vista de cerca, vacía, para el panel de leer y escribir: papel crema, lomo en el centro y bordes gastados, con un margen limpio de 16 px por dentro para el texto. Se escala entero (sin estirar), así que tiene que leerse bien a 1× y a 3× | 320×200 (se entrega a 2×) |
| `emote-book` | icono de bocadillo: un librito abierto, para quien está leyendo | 12×14, en la hoja de §5 |

Son **6 dibujos**. El ancla del libro es el centro de su base, para que caiga sobre el tablero de
cualquier mesa. Mientras no lleguen, el juego pinta un rectángulo de papel sobre la mesa y el
panel con los colores de la casa: funciona igual.

## No hace falta

- **Tumbarse en la hamaca:** el juego gira 90° el cuerpo de pie y lo mece en la tela; se ve bien y
  no pixela.
- **Más muebles o sitios:** bancos, taburetes, sillas, hamacas, bancales, mesas y hogueras ya se usan
  solos allí donde se coloquen (`data/aventura/life.json` `kinds`). Un elemento nuevo entra con una
  línea en esa tabla.
