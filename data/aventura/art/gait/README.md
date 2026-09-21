# Contactos de marcha — 21-sep-2026

Las fases laterales y diagonales originales de varios protagonistas repetían la
pierna cercana delante. Cambiar los FPS no podía crear el apoyo contrario.

## Fuentes y alcance

- `sources/<variant>-opposite.png`: originales generados con `image_gen`, conservados
  sin modificación. Dos columnas (andar/correr), tres filas (derecha,
  abajo-derecha, arriba-derecha). Solo se utiliza el dibujo bajo la cintura.
- `opposite-contact.prompt.txt`: prompt consolidado para reconstruir la corrección.
  La identidad se referencia desde el residente original; `100-opposite.png` solo
  indica el apoyo de las piernas, nunca el diseño de otros personajes.
- `catalog.json`: SHA-256, caderas normalizadas por celda y encaje por protagonista.
  Los números son coordenadas de arte, no excepciones en el motor. La anchura del
  paso se registra contra el primer apoyo original de cada dirección; no se impone
  una anatomía común al duende robusto y al delgado.
- Antes de componer, una ganancia RGB limitada iguala el tono medio de las nuevas
  piernas al contacto original, sin modificar las luces/sombras pintadas ni la parte
  superior. Evita un pantalón más claro únicamente durante el segundo apoyo.
- `cutouts/`: composición reproducible a 8x y ficha de procedencia/medidas. El
  exportador final sigue siendo 2x con reducción integrada, **48×48 lógicos y
  ancla [24,46]**. Estos originales de trabajo no se descargan durante el juego.

Se sustituye `walk-3` / `run-2` en las seis vistas con componente horizontal:
216 contactos entre los 18 protagonistas. Quieto, arriba/abajo, remada, acciones,
retratos y los otros NPC no se redibujan. Para mirar hacia la izquierda se refleja
solo el recorte de piernas; cara, gorro, manos y torso proceden de la vista izquierda
original. Por eso no se invierten los accesorios de todo el personaje.

Algunas hojas de carrera empiezan por el cruce en vez del apoyo. `run.order`
registra su reordenación **solo en estas seis vistas**, antes de corregir el apoyo
contrario. El motor sigue leyendo cuatro fases comunes. La anatomía necesita
revisión visual además de los tests: un fichero distinto no prueba que cambie el pie.

## Reconstrucción

`php scripts/prepare-adventure-cast.php` aplica automáticamente estas correcciones
desde los maestros originales. Para una identidad se puede usar `--sheet=<source>`
para su hoja residente y `--sheet=<run-master>` para su carrera, según los catálogos
de residentes y acciones. **No alimentar el compositor con su propia salida.**

Después: `npm run build`, `node scripts/check-gait-art.cjs`,
`php scripts/check-gait-art.php`, `npm run test:gait` (preview offline en 47838).
`php scripts/review-gait-art.php` genera los ciclos ampliados de todas las
direcciones en `.local/gait-review/contacts`; acepta una dirección para limitarlo.
La composición se hace offline: no hay máscaras, procesamiento de imagen, texturas
más grandes ni fotogramas adicionales en el navegador.

### Encaje entre paseo y carrera

Las cuatro poses de carrera de una dirección comparten el mismo desplazamiento
horizontal, medido respecto al cuerpo que camina (no al borde de un gorro, mano o
pie). `horizontalOffsets` en `residents/actions/catalog.json` se aplica durante
el registro offline de la hoja. No mueve al jugador, su sombra, el ancla, los pies
en vertical ni la cámara, y no redibuja ni deforma las piernas aprobadas.

La revisión de los 18 protagonistas / ocho direcciones detectó descentrados
frontales en siete hojas. Brezo necesitaba +2,5 px lógicos hacia la derecha al
correr hacia abajo; las otras correcciones están entre +0,5 y +2,5 px. Las vistas
laterales/diagonales conservan su inclinación y dibujo aprobados, sin normalizar
cada fotograma por su silueta (lo que introduciría temblores).

`php scripts/check-gait-alignment.php` comprueba los píxeles de los atlas exportados:
anclas comunes en las ocho direcciones y eje medio cara/torso frontal/trasero al
cambiar de marcha. Una prueba negativa detecta el salto original de Brezo. Esta
medida acotada permite la oscilación natural; no exige congelar el cuerpo.
La cobertura de navegador incluye 5.472 pasos de cambio paseo → carrera → paseo
en las cuatro fases del ciclo, ocho direcciones y los tres tamaños de pantalla,
además de los 912 casos de marcha: posición física, fase continua y ancla común.

QA: SHA de fuentes y recortes, receta vigente, 32 fases por pack, 6 contactos por
corrección, pies en y=46 y margen de lienzo; comparación de píxeles opacos del
gorro/cabeza/torso con su pose original. Las pruebas del motor cubren velocidades,
orientación, paradas, colisiones, cambio de marcha y jugadores remotos, pero no
sustituyen mirar los ciclos a escala real y ampliada.

Verificación de esta entrega: suite general completa; 912 casos del motor a
1440×900, 768×1024 y 390×844; movilidad en esos tres tamaños; ocho cruces seguidos
con el daemon local real y cero rechazos; 216 contactos inspeccionados en láminas.
Los 36 packs mantienen exactamente sus dimensiones de textura y número de poses.
Publicado el 21-sep-2026 como `82a321d87cc9d16beca7`; verificaciones, cambios del
contrato de velocidad y límites de las pruebas en [el registro de entrega](../../../../docs/RELEASE.md).
