# La aventura de los Magikitos

Contrato vigente, 13 de septiembre de 2026. Sustituye las decisiones contradictorias
de los prototipos anteriores. Desarrollo y pruebas **solo en local**; no desplegar,
consultar producción ni importar datos adicionales.

## Identidad

Una aventura cenital de pixel art cálido, inspirada en la sensación de los juegos
portátiles clásicos, con personajes, arte y música propios. No combate, vida,
muerte ni pruebas de reflejos. Explorar, curiosear, recoger objetos, resolver
pequeños enigmas y hacer travesuras simpáticas.

Un mundo abierto que crece por aventuras locales entrelazadas. Cada zona tiene
identidad y puede abrir el camino a otra gracias a lo que haces. No necesita una
misión final en esta entrega; un misterio de fondo puede aparecer después.
El humor es cotidiano y descarado, sin humillar a otros usuarios. En español,
registro andaluz cercano y buen rollo, sin forzar acentos escritos en cada frase.
Los demás idiomas adaptan el chiste a un registro coloquial natural, no palabra por palabra.

## Dónde vive

La web normal conserva sus páginas, navegación, tienda, contenidos, formularios,
URLs y SEO. La aventura es independiente en /aventura y cinco rutas traducidas.
No convertir la web entera en un juego. No iframe ni marco de web antigua en el mundo.
Admin y concurso están fuera; el concurso no tiene accesos en la aventura.

Entrar siempre recupera la escena y posición guardadas. Un jugador nuevo aparece
en el claro inicial. No hay enlaces a contenidos que cambien la posición, parámetros
`?content=`, teletransporte ni menú de lugares. El jugador llega caminando.

## Mundo y composición

Exterior de 128 × 96 tiles: claro inicial, bosque, río y puente, pueblo sobre hierba,
lago y rincón nocturno de la hoguera. Interiores separados de casa humana grande, casita humana de la fuente,
taberna y taller; un islote de 64 × 48 tiles accesible en barco. Muebles cerca de paredes, centro despejado y umbrales visibles.
Bancos en los bordes de caminos mirando a su punto de interés, nunca bloqueando pasos.
La fuente ocupa el centro de una confluencia sobre hierba, rodeada por caminos.
El lago es una costa abierta que continúa fuera del mapa: no hay una orilla opuesta
que se pueda alcanzar rodeándolo. El islote vive en otra escena, accesible en barca.
Los dos pies deben permanecer en tierra también en curvas, diagonales y volteretas.

Caminos unidos coherentemente, árboles de varias especies y siluetas, elementos
decorativos pequeños y contexto: luciérnagas nocturnas, insectos del bosque,
detalles urbanos apropiados. Animación escasa y cuidada; respetar movimiento reducido.
La noche oscurece al protagonista igual que al entorno; la única luz local es el fuego.
Árboles y edificios ocultan normalmente, sin fundido de transparencia.

El protagonista tiene un diseño exclusivo: orejas puntiagudas, gorro de pico y pasos
claros en ocho direcciones. Todos los vecinos llevan gorro de pico, pero varían
silueta, color, piel y ropa. Su diseño se asigna de forma estable al autor público.
No afirmar que están conectados: son una representación diferida y ambiental.
Sin sockets ni actualización remota continua; sus paseos se calculan en el navegador.

## Contenidos con lugar propio

- Cuentos: 6–10 narradores alrededor de la hoguera nocturna junto al lago.
- Chistes: corrillo dentro de la taberna del pueblo.
- Expresiones: libro especial en el interior de la casa humana.
- Colorear: zona de artistas con sus colecciones y herramientas.
- Tienda: taller con duendes expuestos, precios, fichas y carrito.

Los demás vecinos tienen conversaciones ambientales; no reparten todos los tipos
de contenido por cualquier parte del mapa.
El contenido procede de aportaciones públicas existentes y de las tandas de
content pulse: se conserva la selección de calidad y el espacio de exploración.
No fabricar voces humanas ni inventar usuarios conectados.

Interacción nativa «Acercarse» (opción B del UI Lab): la cámara encuadra la actividad,
el mundo permanece visible y título, voz o pieza aparecen sobre él, sin marco de página.
No hay X: tocar fuera o Escape cierra; empezar a caminar con teclado también.
El primer toque fuera solo cierra, no interpreta un destino con la cámara cambiando.
Buscador, categorías, colecciones, regiones, autores, votos y lectura larga siguen
disponibles como acciones secundarias deliberadas, con texto HTML accesible.
Sin sidebar, cabecera de web, footer ni mapa SVG dentro de la experiencia.
Audio con ficha cerrada dentro de su zona, indicador discreto, «cuéntame otro»
y reproducción automática opcional. Al abandonar la zona se detiene.
El vigilante del diccionario aparece como un duende que se acerca si solicitas ayuda.
Cuenta, estudio de grabación, envío/edición y checkout permanecen en la web normal;
no se duplican esos motores en el juego.

## Controles e inventario

Tocar suelo para caminar, objeto para acercarse y actuar. Flechas, WASD y ZQSD
opcionales en teclado. Sin tecla E. Los objetos interactivos y vecinos tienen cuerpo:
no atravesarlos, y al chocar se activa la misma reacción que al tocarlos.
Entrar/salir de casas andando, sin clic obligatorio, también entrando al umbral de lado.
Puerta abierta = interior accesible; casas aún inaccesibles muestran puerta cerrada.
Espacio mientras se camina o doble clic/toque en el destino: una voltereta por pulsación,
con ocho orientaciones, impulso acotado y colisiones. No encadena al mantener la tecla.

Solo música, «Yo» y saco como botones permanentes.
El saco muestra objetos, descripción y si se consumen o son herramientas.
«Usar» selecciona el objeto; el siguiente objetivo decide su reacción mediante datos.
No gastar nada por una combinación incorrecta. Cancelar devuelve el objeto al saco.
Los diálogos clásicos aparecen abajo, sobre el mundo, con páginas y acciones
contextuales; desaparecen cuando no se necesitan. Una sola caja siempre que baste.
La confirmación de cierre dice «Ok»; los botones de acción dicen lo que hacen.
Espacio pasa a la siguiente; Enter y Escape cierran sin activar acciones de compra.
Cada objeto recogido aparece claramente y vuela hasta el saco; movimiento reducido
muestra una confirmación quieta. Las monedas también tienen respuesta visual.

## Primera aventura opcional: una brocheta y un barco

El protagonista no tiene hambre ni una obligación inicial. Se entra a pasear.
El puente, el pueblo, las casas y el lago están abiertos desde el principio.

Brizno, un vecino sentado junto a la barbacoa del claro, tiene tanta hambre que
«le suena hasta el gorro». Ayudarlo se descubre hablando o recogiendo objetos.

1. Encontrar una seta cerca, un palito junto al tronco y un mechero en la primera casita junto a la fuente del pueblo.
   Dentro solo hay una cama, una mesa pequeña con el mechero y un florero; el libro
   de expresiones sigue en la casa grande cercana al claro.
2. Encender la barbacoa y asar una brocheta; se puede encender primero o cocinar
   directamente con todo en el saco. Cualquier orden de recogida funciona.
3. La seta y el palo se consumen; el mechero permanece. La brocheta se lleva al vecino.
4. Brizno cambia de expresión y entrega una recompensa única: **10 setines, suficientes para ida y vuelta**.
5. Remo, el duende barquero, recibe y cobra en el embarcadero. La barca del lago lleva al islote. Cada trayecto cuesta **5 setines**, también la vuelta.
   La travesía tiene una animación breve con Remo remando y el protagonista sentado,
   sin movimiento libre ni acciones durante el trayecto. El pasaje se cobra al llegar.
6. La vecina del islote paga un pasaje por recoger conchas de la orilla oriental.
   Esa ayuda es opcional y repetible para futuros viajes; no hace falta para el primer regreso.
   Antes de la brocheta, Remo invita a explorar y hablar con la peña, sin destripar el enigma.

No hay temporizadores de hambre, penalizaciones, obligación de ayudar ni bloqueo
del bosque. El viaje sí representa una primera progresión pagada, ampliable después.

Los setines de esta fase son un **monedero local de prueba de la aventura**,
señalado en el saco. No cambia la reputación ni el saldo de cuentas de la web.
La elección de conectar dinero real de cuenta queda pendiente; el código del
navegador nunca se aceptará como prueba para otorgar o gastar saldo autoritativo.

## Necesidades de duende

«Yo» muestra un estado único. Ganas de mear tras un plazo aleatorio de 6–10 horas
reales y su botón solo cuando toca; sin ganas no se muestra ninguna acción.
Ganas de cagar tras 8–16 horas. Continúan con el navegador cerrado y se guardan como
fechas absolutas, no como contadores por frame. Recargar no sortea otra vez.
Si coinciden, cagar tiene prioridad y al hacerlo se alivian ambas cosas.
Mear no retrasa la siguiente caca. No hay accidentes ni penalización por aguantar.

Una planta especial de hojas grandes, la culilimpia, crece en varias zonas boscosas.
Se recolectan hojas repetidamente y se apilan en el saco (máximo 99).
Cagar requiere una hoja para limpiarse; sin ella el protagonista da la pista.
Animaciones propias: preparar, agacharse/hacer fuerza, limpiarse y levantarse;
mear tiene postura, chorrito y final. El personaje no camina durante la acción.
Una hoja se consume al acabar de cagar, nunca al pulsar el botón.
Quedan marcas temporales locales: caca 24 horas, charco 5 minutos, máximo 48.
No se premia todavía cagar en lugares concretos: esa travesura será otro enigma.

## Código y guardado

Datos, condiciones y efectos fuera del motor: ningún muro de if por personaje.
Objetos consumibles y reutilizables, cambios atómicos, colisiones y búsqueda de
camino coherentes, presentación y reproducción con ciclo de vida explícito.
Un catálogo de textos por idioma; un solo backend para consultas y permisos públicos.
Escenas y comportamientos reutilizables separados de sus colocaciones. Sprites en
paquetes independientes de edificios, árboles, vegetación, objetos y cada personaje;
se cargan los necesarios para la escena, no un atlas gigante de todo el futuro mundo.

Un único guardado local, `magikitos.adventure`, sin versiones ni migraciones de prototipos: posición, escena, entrada, banderas, inventario, monedero de prueba,
recompensas únicas, música, fechas de necesidades y marcas temporales. Se valida
el formato actual y se descartan campos desconocidos; validar no inventa dinero.
Preparar un viaje no muta la partida: primero se cargan
sus recursos, se muestra la travesía y después se confirma conjuntamente el pasaje y
el cambio de escena. Una recarga a mitad conserva origen y saldo.
Device ID compartido con la web, sin añadir eventos de juego a analytics.
No sincronización de cuenta todavía ni creación silenciosa de usuarios.
No recompensas reales de setines desde estado manipulable del navegador.

## Ideas posteriores, no implementadas

Travesuras con consecuencias visibles y recordadas; enigmas con herramientas y
objetos que desbloquean rutas. Reacciones al cartel «prohibido cagar aquí» y otras
travesuras contextuales, con límites claros.
Vincular progreso a cuentas con snapshots espaciados, sin llenar una tabla de eventos.
Setines autoritativos e idempotentes cuando se diseñe esa integración.
Más escenas, interiores, personajes seleccionables y aventuras locales.

No prometer estas funciones como terminadas por aparecer en este documento.

## Probar y ampliar

[Instrucciones locales y verificaciones](data/aventura/README.md).
[Arquitectura y gramática de objetos](data/aventura/REFACTOR.md).
[Arte original y pipeline](data/aventura/ART.md).
[Studio local de composición y borradores](tools/adventure-studio/README.md).

Desktop, tablet y móvil táctil deben probarse con el mismo mundo. Antes de publicar
habrá revisión específica de dispositivos reales, seguridad, rendimiento e integraciones.
Ninguna de estas tareas autoriza tocar producción ahora.
