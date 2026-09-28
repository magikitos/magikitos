# Avelino, el mago del molino

Avelino tiene 678 años y es el más sabio de los Magikitos. Su molino está en la
primera escena, en la orilla occidental del río, al este de la fuente. Un cartel
cerca del inicio y las primeras pistas de los vecinos llevan hasta él. Se entra
por la puerta; Avelino y su mesa están dentro, a la vista también en horizontal.

La primera conversación abre directamente el panel centrado: la presentación completa
y el botón de empezar aparecen juntos. No se encadenan bocadillos ni hace falta volver
a saludar para acceder al reto. Las visitas posteriores ofrecen continuar con las cartas.
**La memoria del molino** tiene ocho cartas: seta, ramita, conchas y helecho.
Se descubren de dos en dos, sin tiempo límite ni penalizaciones. Las cuatro
parejas dan una llave. El cofre junto al camino, a la izquierda de la entrada,
se abre con ella y contiene una nota de Avelino. La llave se conserva en el saco;
no se adelanta todavía su siguiente uso. El reto puede repetirse por gusto sin
volver a entregar la recompensa.

## Diseño y progreso

El puzzle usa `WorldSite`, `ContentRooms` y el mismo panel de los cuentos y el
Setómetro. Las cartas son botones con nombres accesibles, foco visible y control
con teclado, ratón o toque. La cara oculta no revela el símbolo al lector de
pantalla. Los aciertos se anuncian en una región de estado; las animaciones
respetan movimiento reducido. Se puede salir con el botón visible o Escape.
Cerrar cancela los temporizadores y devuelve el control al mundo.

Las parejas, la presentación, el reto completado y el cofre abierto son marcas
del guardado existente. Cada acierto pasa por las reglas de Avelino y la cola
durable de acciones. El contrato que acompaña al artefacto permite al servidor
validar las dependencias y entregar una sola llave, incluso si se pierde una
respuesta o se juega desde otro aparato. La llave no es una moneda ni un material
de construcción. El memory se resuelve en el cliente; las marcas no constituyen
una prueba criptográfica de haber jugado y no deben canjearse por premios competitivos
o bienes de pago.

`catalog.challenges` es la secuencia ordenada. Un nuevo reto declara su escena,
personaje, título, marca de finalización, acción y recompensa; `advance()` exige
que los anteriores estén completos. Las reglas viven en `behaviors/avelino.json`.
Otro tipo de puzzle necesita su propia vista y su validación de resultado.
Los seis idiomas se escriben juntos en `locales/core.json` y los paquetes de
escena. No hay una pantalla externa ni una nueva API.

## Arte original

Generado con la herramienta integrada de imágenes, usando las casas, el almacén
y un habitante existentes como referencias de estilo. Los originales con
alfa y los prompts exactos están en [art/avelino](../data/aventura/art/avelino/).
El [registro de prompts](../data/aventura/art/avelino/prompts.json) conserva las
referencias relativas al repo. No incluye instrucciones ni ficheros privados.

El molino de piedra y vigas de roble tiene una vista elevada, con tejados de pizarra.
La casa y el umbral descansan en tierra; la orilla se ajusta localmente al apoyo del
mecanismo. La rueda es una pieza independiente: gira en su plano vertical sobre el eje,
con espesor, las palas inferiores sumergidas y pequeñas ondas en la línea de agua.
El edificio no se mueve. El modo de movimiento reducido conserva el fotograma quieto.
El interior conserva su suelo y recorrido, con mampostería y vigas a juego con el exterior.
La revisión del arte y sus prompts están en [refinement-prompts.json](../data/aventura/art/avelino/refinement-prompts.json).

Los paquetes independientes se hornean con la misma densidad 2×,
cuantización y WebP sin pérdida del resto del juego. Los originales no entran
en el artefacto público; el interior y Avelino se cargan al visitar el molino.

## El vecino del río

`tools/river-journey.cjs` compone un recorrido desde las orillas reales de raíces,
rápidos, sauces y el lago inicial. Un único vecino recorre el circuito a paso constante
de 2,1 casillas por segundo. Traza una curva amplia al llegar a cada extremo y vuelve;
no se desvanece ni reaparece. Tiene arte de espaldas para el regreso. La posición global
y el reloj son los mismos al dibujar y al calcular su colisión, también entre escenas.
`check-river-journey.cjs` recorre un ciclo completo y comprueba presencia única, velocidad,
ida y vuelta, continuidad de las costuras y casco entero en agua navegable.

## Comprobación

- `npm test`: turnos del memory, guardado parcial, dependencias, recompensa única,
  cofre, capacidad de la cola, accesos y contrato del bosque vivo.
- `npm run test:avelino`: recorrido real por puerta, conversación, puzzle,
  cierre/recarga, llave y cofre en escritorio, móvil pequeño y horizontal.
- `npm run test:mill-river`: vuelta entera del vecino, rueda visible en movimiento,
  edificio quieto, movimiento reducido y navegante dibujado antes, durante y después del giro.
- Desde la web local: `ddev exec php < ../magikitos-game/scripts/check-avelino-authority.php`.
  Comprueba SQL y recibos reales con una identidad temporal que se elimina al acabar.
- `check-forest-transitions.cjs` de la web recorre también las dos puertas nuevas.

Al publicar hay que reiniciar de forma ordenada `bosque-vivo.service` después de
activar el artefacto: el demonio lee sus escenas y puertas al arrancar. No se
necesitan migraciones, cambios de backend ni importaciones de partidas.
