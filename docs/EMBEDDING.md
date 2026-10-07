# El bosque detrás de la web

Implementación del 16 de septiembre de 2026 (decisión del dueño). No cambia mapas,
reglas, guardados ni la API. Prueba: `npm run test:embed`.

La web sirve el artefacto del juego desde su propio origen (`/bosque/explorar` y las cinco
rutas traducidas, ver [RELEASE.md](RELEASE.md)), así que puede además tenerlo cargado
DETRÁS de su landing `/bosque`, en un `<iframe>` que se levanta a pantalla completa cuando
alguien pulsa «Explorar el bosque» y se baja al retroceder con el navegador. La página de debajo no se
recarga: volver es instantáneo y el mundo no rearranca. Desde el 19-sep-2026 (decisión del
dueño: «el juego NO se carga en todas las páginas») el marco solo existe en esa landing: las
demás páginas de la web no saben nada del juego.

## Entrada y navegación

Se entra desde `/bosque`. El juego no muestra el antiguo logo de acceso a la web,
ni dentro del iframe ni como página independiente ni en la app. El historial del
navegador sigue perteneciendo a la página que lo aloja.

Los mensajes solo se aceptan desde la ventana padre y el mismo origen. La web
además envía `X-Frame-Options: SAMEORIGIN` en la ruta del juego.

El control de pantalla completa comprueba también los documentos antecesores
accesibles: si `/bosque` ha puesto su contenedor en pantalla completa, el botón
se oculta aunque el documento del iframe no tenga `fullscreenElement`. Escuchar
los cambios en ambos documentos permite recuperarlo cuando se sale con Escape.
En la app instalada tampoco aparece. Un elemento ajeno al iframe (por ejemplo
un vídeo de la página) no cuenta como pantalla completa del juego.

## El contrato

Todo cruza con la misma forma, `{ magikitos: <verbo> }`, y nada se lee si no viene del
propio origen y de la ventana que nos abrió. Vive en
`public/assets/js/adventure/embed.js`.

| Dirección | Verbo | Qué significa |
| --- | --- | --- |
| página → mundo | `hola` | Estoy aquí. (El mundo contesta `listo`.) |
| página → mundo | `abrir` | Estás en pantalla: entra, con sonido. |
| página → mundo | `cerrar` | Te he bajado: cállate y guarda. |
| página → mundo | `silencia` | Ha arrancado un reproductor mío. |
| mundo → página | `hola` | Acabo de cargar, ¿hay alguien? |
| mundo → página | `listo` | Mundo cargado (`{ ready }`). |
| mundo → página | `abierto` | Ya he entrado. |

## Consecuencias dentro del juego

- **La tarjeta de entrada no pregunta dos veces.** Empotrado, `world-entry` no se
  muestra: la página ya puso una puerta delante de la persona y la cruzó. `abrir` entra
  con sonido y sin elección, y la pantalla completa la pide la página sobre su propio
  elemento (el gesto vive allí).
- **Callar no es elegir el mute.** `cerrar` y `silencia` paran el audio pero NO tocan
  `state.muted`: escribirlo dejaría el botón de sonido mintiendo en la siguiente visita
  sobre una decisión que nadie tomó.
- **Un marco escondido no pinta.** Un iframe con `display: none` sigue recibiendo
  animation frames —su documento no está `hidden`, porque eso sigue a la página de
  arriba—, así que `renderer.render()` se niega a dibujar sin superficie y `tick()` se
  salta el trabajo conservando el bucle. Sin esas dos guardas, un mundo precargado fuera
  de la vista arrancaba lanzando `InvalidStateError` dentro de `init()` y se anunciaba
  como fallido.
- **A Google viaja la página de fuera.** Google no se deja mostrar dentro de un marco, así que
  empotrado, «Continuar con Google» navega la ventana de la landing y pide volver a
  `/bosque#explorar`, que reabre el bosque (`pageWindow()` en `account.js`). Suelto, viaja la
  propia ventana.
- **Un solo dueño del sonido**: `game.setMuted()` es el único sitio donde cambia la
  preferencia, y lo comparten el botón del juego y el puente.

## Lo que hace la web

Está documentado en su repositorio (`views/components/bosque-host.php` y
`public/assets/js/bosque-embed.js`, que solo se sirven en la landing `/bosque`). En
resumen: el iframe se construye cuando hay señal de que hace falta —intención sobre el
botón «Explorar el bosque», o partida guardada en este navegador— nunca con ahorro de
datos ni con la pestaña de fondo; el botón es un enlace de verdad a `/bosque/explorar`,
así que sin JS el bosque se abre como página; y manda el sonido quien está en pantalla.
