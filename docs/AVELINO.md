# Avelino, el mago del molino

Avelino tiene 678 años y es el más sabio de los Magikitos. Su molino está en la
Curva de los Sauces, al norte de la pradera, en la orilla occidental de un meandro.
Un cartel cerca del inicio, las pistas de los vecinos y un sendero continuo desde
la fuente llevan hasta él. El sendero bordea la casa de hojas sin cruzarla. Se entra
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

El molino reutiliza una caja de música humana: la gran llave de cuerda, la tapa
verde entreabierta, el cilindro de latón y los herrajes conservan su identidad.
Su zócalo rectangular llega al filo de la ribera, sin una franja de hierba entre
la pared y la rueda. Un caballete de roble con riostras sostiene el extremo del
eje en el agua; no hay pilares de piedra. El umbral y la llegada al salir
descansan en tierra. El meandro aprovecha
el espacio al oeste del huerto y conserva su muelle, sus vecinos y sus accesos.
La ribera sigue la proyección del plano de la rueda: el eje sale de la pared hacia
el agua. La rueda es una pieza independiente: gira en su plano vertical sobre el eje,
con espesor, las palas inferiores sumergidas y pequeñas ondas en la línea de agua.
La inmersión se recorta en ese mismo plano, antes de girar las palas; las ondas
siguen la superficie del agua. El edificio no se mueve. El modo de movimiento
reducido conserva el fotograma quieto.
El interior tiene cuatro paredes rectas de nogal, esquinas de latón, una estantería
hecha con una bobina de hilo y una lámpara dedal. El contorno de navegación sigue
el suelo rectangular proyectado y la escalera de entrada. El fondo reconstruye su
lienzo original tras el recorte del atlas para conservar la alineación del eje,
los muebles y las colisiones.
El **hilador de luciérnagas** conecta con el eje de la pared: dos engranajes giran
en sentidos contrarios, las púas y el peine marcan una secuencia y la luz recorre
el tubo de cobre hasta el frasco. Del frasco ascienden pequeñas luces. Se puede
examinar el aparato en los seis idiomas. Todo utiliza el reloj del motor y queda
quieto con movimiento reducido. Las piezas raster y los prompts exactos están en
[musicbox-prompts.json](../data/aventura/art/avelino/musicbox-prompts.json); el modo
empleado es la herramienta integrada `image_gen`, con alfa transparente.

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
  edificio y base del aparato quietos, engranajes y luces en movimiento, acceso al
  aparato, movimiento reducido y navegante dibujado antes, durante y después del giro.
- Desde la web local: `ddev exec php < ../magikitos-game/scripts/check-avelino-authority.php`.
  Comprueba SQL y recibos reales con una identidad temporal que se elimina al acabar.
- `check-forest-transitions.cjs` de la web recorre también las dos puertas nuevas.

El cofre se traslada con el molino y conserva sus marcas y su llave. La recuperación
de progreso sin conexión utiliza la nueva escena. El contrato conserva también
la dirección anterior de la acción para las colas y recibos de clientes abiertos:
aplica las mismas condiciones y recompensa única, sin dibujar un segundo cofre.

Al publicar hay que reiniciar de forma ordenada `bosque-vivo.service` después de
activar el artefacto: el demonio lee sus escenas y puertas al arrancar. No se
necesitan migraciones, cambios de backend ni importaciones de partidas.
