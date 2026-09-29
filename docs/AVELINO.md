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
se abre con ella y entrega los remos, junto con una nota que explica cómo construir
la barca con botella y navaja en el muelle de la pradera. La llave se conserva en el saco;
no se adelanta todavía su siguiente uso. Al completarlo no se ofrece repetirlo. Avelino anuncia que no hay más misterios
por ahora e invita a enviar una opinión para seguir ampliando el juego.

La secuencia principal es **memory → llave → cofre → remos → barca → exploración**.
Los próximos retos se abrirán por hitos de aventura, no por horas de espera. Esta entrega
mantiene un único reto: no anuncia como disponible una adivinanza todavía no publicada.
Brizno cuenta la historia de los remos y ofrece un encargo opcional de brocheta, sin
recompensas de navegación, dinero ni temporizadores.

Un cofre abierto antes de esta entrega permite recoger los nuevos remos. Si ya se poseen,
abrirlo conserva una sola pareja y su llave, sin desbordar el inventario. La recuperación
acotada de una partida solo local que ya tenía remos/barca reconstruye la nueva cadena
de herramientas al crear cuenta; conserva el acceso ganado antes del cambio. No importa
cantidades arbitrarias ni dinero. El favor de la brocheta usa marcas nuevas para no
resucitar los antiguos premios ni el temporizador del picnic.

## Diseño y progreso

El puzzle usa `WorldSite`, `ContentRooms` y el mismo panel de los cuentos y el
Setómetro. Las cartas son botones con nombres accesibles, foco visible y control
con teclado, ratón o toque. La cara oculta no revela el símbolo al lector de
pantalla. Los aciertos se anuncian en una región de estado; las animaciones
respetan movimiento reducido. Se cierra con la X, Escape o un clic fuera. En móvil ocupa el viewport completo,
por encima de los controles, con la X fija arriba a la derecha.
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
escena. El feedback usa la API específica descrita a continuación; los premios siguen
usando las acciones existentes.

## Opiniones al terminar

El formulario solo envía tras pulsar «Enviar mi opinión». El texto (3–2000 caracteres)
permanece al cerrar el panel o al fallar un envío durante la visita; no se guarda en disco.
La web envía el correo al propietario, con destinatario fijo y texto escapado. No crea
cuentas, publicaciones ni conversaciones públicas. El destinatario y el transporte
pertenecen al backend privado.

`POST /api/world/feedback` comprueba un token nuevo de Turnstile, la acción
`game_feedback` y el dominio autorizado. Una configuración ausente o una caída del
proveedor bloquean el envío. No se usa la ventana de humanidad de otras funciones.
Los detalles siguen la [validación oficial de Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
Hay un límite de diez intentos por IP/hora. Un UUID de envío y un recibo bloqueado en
el servidor evitan duplicados al reintentar una respuesta perdida durante 30 días;
los recibos solo contienen hash, fecha y resultado. Cada reintento obtiene un token nuevo.

Las pruebas de servicio sustituyen verificación y transporte por funciones de prueba,
sin ninguna puerta de pruebas en la API y sin enviar correos reales. El navegador
comprueba borrador, error, reintento, cierre y acuse. El éxito confirma la aceptación
por el proveedor de correo; no equivale a una confirmación de lectura.

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
eje en el agua; no hay pilares de piedra ni travesaños inferiores flotando.
Sus tres postes entran por separado bajo la superficie, con una franja sumergida
translúcida y ondas en cada punto de contacto. El umbral y la llegada al salir
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

Avelino camina con una [rejilla de 32 poses](../data/aventura/art/avelino/avelino-walk.png):
ocho direcciones y reposo más tres pasos. `host-stroll.js` utiliza la misma marcha
por distancia y movimiento con colisiones de los residentes. Da un paseo corto
dentro del taller, espera al seleccionarlo y se vuelve hacia quien se acerca.
Conserva sus reglas de retos y su retrato; no se convierte en un vecino genérico.
Su cuerpo de colisión se actualiza con cada paso. Movimiento reducido lo deja quieto.
No hay estiramientos, respiración por escala ni recortes del cuerpo por la cintura.
`php scripts/prepare-avelino-art.php` registra las siluetas a 48 píxeles de altura,
con las suelas en la misma línea, antes de hornear el atlas: el render solo cambia
fotogramas enteros. Los [prompts exactos](../data/aventura/art/avelino/motion-prompts.json)
de la rejilla y los postes se ejecutaron con la herramienta integrada `image_gen`.

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
  `check-avelino-motion.cjs` cubre pasos a 30/60/120 Hz, espera al hablar,
  cuerpos móviles, proporciones registradas, zócalo seco y postes dentro del río.
- `node scripts/check-avelino-motion-browser.cjs`: paseo real, direcciones,
  selección del mago caminando, conversación, Escape y movimiento reducido.
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
importan partidas. Las reglas y marcas nuevas de este encargo viajan en el contrato del
artefacto; no requieren cambios de esquema ni restaurar las tablas de recetas.
