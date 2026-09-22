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

Un visitante puede explorar, avanzar en aventuras, recoger materiales, publicar
recetas, leer, escuchar y votar. Recibe las actualizaciones del mundo, pero no
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

## Las recetas pertenecen a la web

El juego solo pinta JSON en sus tarjetas y ofrece el formulario/grabador.
La web posee publicación, identidad, ingredientes, audio, votos, pulso, rankings
y moderación. Contrato exacto: [OpenAPI](world-api.openapi.json), idéntico en ambos
repositorios. No se incrusta HTML de la web.

- Leer, escuchar, descubrir otra receta y votar no requieren ingredientes.
- Publicar requiere tener los ingredientes en el inventario **del servidor**.
  Se comprueban, no se consumen. La cantidad culinaria (p. ej. 250 g) no es
  el número de objetos del saco.
- El catálogo inicial solo incluye setas, que ya se consiguen jugando.
  Pescado, limón, aceite, etc. se añaden al catálogo de la web cuando exista su
  aventura/recurso real. No hay ingredientes ficticios inalcanzables.
- Elaboración escrita, voz libre o ambas. De 2 segundos a 10 minutos y 12 MiB;
  validación técnica y entrega Opus con la utilidad de audio existente.
  Sin IA, transcripción, aprobación semántica ni sustitución de la voz.
- La narración y su preescucha silencian la música del juego. Grabar detiene
  también la reproducción. Al salir se liberan micrófono y URLs temporales.
- Publicación con recibo idempotente; un fallo de red conserva el formulario
  exacto para reintentar, incluido el audio. El borrador de recetas está en
  memoria de la pestaña: **no es un guardado persistente de audio** y recargar
  antes de recibir confirmación puede perderlo.
- Máximo cinco recetas nuevas por identidad/día y límites de peticiones por IP.
  Se reutiliza la ventana de humanidad de la web; solo se pide el reto cuando
  el servidor lo necesita, sin convertir su token en parte de la receta.
  Publicar/reintentar no da setines. Votos y rankings reutilizan las reglas
  existentes; una receta oculta no puede recibir votos ni premios del pulso.
- Seis idiomas de interfaz, idioma original de cada aportación intacto.
  Buscador, filtro de ingredientes, ranking paginado y descubrimiento con
  espacios de exploración del Content Pulse.

Rutas públicas sin enlace en el menú:
`/recetas`, `/en/recipes`, `/de/rezepte`, `/fr/recettes`,
`/it/ricette`, `/pt/receitas`; la ficha añade `/{id}`.
Moderación en el admin independiente: `/administrar-el-mambo/recetas`.
No se amplía el concurso ni se añaden recetas al boletín automático.

## Pruebas y despliegue

- Juego: `npm test`, `node scripts/check-restaurant-browser.cjs`.
  Navegador real en escritorio, tablet, móvil y horizontal; lectura/votos sin
  materiales, escape de texto, grabación y reintento de publicación.
- `npm run test:construction-permits`: navegador y WebSocket reales, API de
  prueba aislada. Dibujar una valla, perder plaza, guardarla con un solo cobro
  y denegar la siguiente acción en escritorio y móvil.
- Web: `node scripts/check-forest-reputation.cjs`,
  `node scripts/check-forest-live-load.cjs`, pruebas de acceso y presencia.
- DDEV: `node scripts/check-forest-live-api.cjs` dentro del contenedor.
  Necesita detener **solo** el sidecar local mientras su proceso aislado posee
  el bloqueo de DB; volver a iniciarlo al acabar. Sus usuarios son sintéticos
  y se limpian. Nunca ejecutar fixtures en producción.
- Migraciones aditivas 4241 (permiso en curso) y 4242 (recetas/ingredientes).
  Preparar el directorio de audio del volumen, instalar artefacto y desplegar
  API/puntero juntos; reiniciar el sidecar mediante el pipeline.
- Una pestaña de la versión anterior debe recargarse para iniciar obras con
  permisos. No se convierte un snapshot antiguo en materiales nuevos.

No se prometen nuevas aventuras, huertos productivos, pesca o un restaurante
privado: esta entrega deja preparada la base pública para ampliar ingredientes
y recetas sin duplicar motores ni introducir otra moneda.
