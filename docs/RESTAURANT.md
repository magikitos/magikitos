# La mesa del bosque y las diez plazas

Decisión implementada el 22-sep-2026. El bosque sigue siendo público: no hay
parcelas privadas, salas por invitación ni un botón para «participar».

## Participar sin pagar

Entrar al juego ya coloca a la identidad en la clasificación de su escena.
Hay diez plazas visibles/con permiso para iniciar obras, ordenadas por los
**setines de reputación de la web**, de mayor a menor. No se consumen setines,
setas ni dinero del monedero del juego. Los empates conservan orden de llegada.
Cambiar de escena entra en la clasificación de destino; otra pestaña no añade
plaza. Un reinicio reconstruye la cola, sin recuperar reservas.

Después de 60 segundos sin acciones, una persona cede sitio si hay alguien
activo esperando. Latidos y reconexiones no son actividad. Si no hay demanda,
no se expulsa al jugador por estar quieto. La puntuación procede de SQL, no de
la cifra enviada por el navegador ni de un ticket antiguo.

Un visitante puede explorar, avanzar en aventuras, recoger materiales, leer, escuchar y votar. Recibe las actualizaciones del mundo, pero no
ocupa un cuerpo visible ni puede iniciar cambios comunitarios. El rastrillo sigue
visible: la explicación de reputación aparece al intentar una acción denegada,
no con carteles de cola al entrar.

### Lo que ya tienes entre manos se guarda

Elegir una pieza, empezar una valla o abrir la nota de una bombita obtiene un
permiso para **esa acción**. Perder plaza no cierra la herramienta ni borra el
trabajo: puedes confirmar y guardar. Después necesitas un permiso nuevo.

El permiso queda ligado a identidad, sesión, zona, operación y tipo de pieza/
objeto concreto. El servidor lo consume en la misma transacción que los
materiales y el mundo. Un reintento del mismo recibo no cobra de nuevo; cambiar
el identificador no resucita un permiso gastado. Las protecciones de patrimonio,
colisión, accesos, revisiones y moderación permanecen vigentes.

El cliente conserva una única operación de obra pendiente en su diario local;
resuelve un acuse perdido antes de iniciar otra. No se mantiene una transacción
SQL abierta mientras alguien dibuja. La implementación de permisos es de la web,
no una decisión de la UI.

## El restaurante

La cocina de teja se sitúa en el claro principal, abierta hacia abajo/derecha.
No es una casa cerrada: cocina, mesas con comida, taburetes, banco y faroles
forman una terraza modular. Sus accesos están protegidos; el resto de
construcciones del bosque siguen siendo públicas.

Los vecinos usan capacidades y plazas de actividad, también en mobiliario fijo.
Se reserva un sitio por NPC, se acota la búsqueda de rutas y se reduce su
actividad cuando llegan personas reales. Es animación local: no inventa usos
de jugadores, reputación o escrituras en el servidor.

Arte original y reconstrucción:
[maestro, prompt y recorte](../data/aventura/art/restaurant/README.md).
El atlas independiente se carga con el resto de paquetes bajo demanda, a 2×;
no se descarga un maestro ni se recorta en el hilo de arranque.

## Actividades secundarias

El restaurante conserva el arte, los asientos y sus vecinos. No abre una biblioteca,
un grabador ni un formulario de recetas. La publicación y el catálogo de recetas
siguen retirados. Brizno propone un único favor cómico: asar dos setas en una ramita
y llevarle la brocheta. Se entrega con una animación y tres frases, sin premios,
repetición ni temporizador. Se puede omitir por completo.
Los remos se ganan abriendo el cofre de Avelino. La botella está disponible desde el
comienzo. Las partidas antiguas conservan sus herramientas y su barca.

Construir, recoger materiales, intercambiarlos en el almacén y cuidar el bol de
los gatos siguen siendo actividades secundarias. La secuencia principal son los
[retos de Avelino](AVELINO.md).

## Pruebas y despliegue

- `npm test` comprueba reglas, guardados antiguos, herramientas, recogida y permisos.
- `npm run test:restaurant` comprueba que el restaurante sigue pintado y se puede
  conversar allí sin abrir paneles ni llamar a APIs de recetas.
- `npm run test:construction-permits` comprueba permisos, cambios de plaza y reintentos.
- `npm run test:picnic` comprueba ingredientes, brocheta, entrega única, animación y recarga.
- La web retira las rutas, publicación, audio, votos y moderación de recetas.
  Su migración de retirada solo elimina las tablas si están vacías, después de
  activar el backend que ya no las consulta. El historial de migraciones se conserva.
- Instalar el artefacto inmutable y desplegar backend/puntero juntos mediante el
  pipeline de la web. Los permisos comunitarios de la migración 4241 permanecen.
