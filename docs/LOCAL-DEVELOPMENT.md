# Desarrollo local

## Separación

Juego público en este repositorio; web/API privadas en el repositorio hermano.
Se puede explorar offline. DDEV aporta identidad, contenidos y construcción
compartida cuando se necesita integración. Sus datos y medios actuales bastan:
ninguna herramienta de desarrollo importa producción ni despliega automáticamente.

La API necesita el esquema actual del repo web; no se ejecutan migraciones desde
el juego. [Contrato y seguridad](API.md#save-protocol-and-server-authority) · [Publicación](RELEASING.md).

## Arrancar

Requisitos: Node 22+, PHP con GD, Chrome para las pruebas de navegador.

```sh
npm ci
npm run dev
# En otra terminal:
npm run studio
```

- Juego: http://127.0.0.1:47834/bosque/explorar.
- Studio único: http://127.0.0.1:47832/#map.
- Sin web/API: `npm run dev:offline`.
- Integración instalada: `npm run install:local`, después
  https://magikitos.ddev.site/bosque/explorar.
- Otro puerto: `GAME_PORT=47842 node tools/preview.cjs --offline`.
- Reconstrucción JS/datos sin cambios de arte: `node tools/build.cjs --reuse-art`.
- Propuesta del Studio: `npm run studio:diff`; nunca aplicación automática.

Los procesos preview leen el puntero local actual. Tras cambiar familias hay que
reiniciar Studio para recompilar su catálogo. No borrar `.local/adventure-studio`.
Sus propuestas se comparan con la nueva fuente y los conflictos se conservan.

`WEB_ORIGIN` solo admite una web local; `GAME_ORIGIN` selecciona el host de las
pruebas que lo soportan. No dirigir pruebas de escritura contra producción.

## Verificación

`npm test` hornea arte, construye el artefacto y ejecuta el núcleo: reglas,
recetas, economía, guardado, 110 NPC, colisiones, orillas, navegación, cámara,
entrada, audio, bitsets, API, Studio y verificación del instalador. Tres de sus
bloques vigilan cosas que antes no vigilaba nadie y que se rompieron de verdad:

- `check-api-contract.cjs`: cada punto que el motor nombra está en su lista blanca
  y cada punto de la lista existe en el OpenAPI con el mismo verbo. La bombita y la
  tenaza estuvieron muertas en el navegador porque faltaban dos líneas en `METHODS`.
- `check-element-bodies.cjs`: colisiones y entrada pertenecen al ELEMENTO, no a la
  colocación; herencia, límites, cuerpo vacío, entrada quitada, fichero de destino
  por familia y supervivencia a `npm run art:catalog`.
- `check-docs-links.cjs`: ningún enlace interno de ningún `.md` apunta al vacío, ni
  por fichero ni por ancla. Catorce estaban rotos el 21-sep-2026 y nadie lo vio
  porque ninguna prueba leía la documentación.

Según el cambio:

- `node scripts/review-world.cjs nombre`: capturas locales de bosque, picnic,
  taberna, jardín de gatos, cinco ríos y claro comunitario. Perfiles aislados,
  escrituras bloqueadas; revisar los PNG, no solo que el comando termine.
- `node scripts/check-world-polish.cjs`: secuencia de botella/dos gatos, transporte
  exclusivo y regreso con bloqueo temporal, corrillos y continuidad de márgenes.
- `node scripts/check-cats-browser.cjs`: captura y regreso real en tres tamaños.
- `node scripts/check-pickups-browser.cjs`: botella/papelera, seta reducida,
  palos, persistencia, cuatro tamaños; peticiones de escritura bloqueadas.
- `npm run test:gallery`: familias/recogibles, variantes, escala, autosave,
  recarga y cinco tamaños en un workspace temporal.
- `node scripts/check-studio-selection-browser.cjs`: selección individual y por
  área, movimiento en grupo, Backspace/deshacer, protección de campos/objetos,
  trazado y edición de vallas, persistencia y tres tamaños. Workspace temporal;
  comprueba que la versión del propietario no cambia.
- `npm run test:picnic`: receta completa y hambre repetida en cinco tamaños.
- **Las seis que no tenían mando** (21-sep-2026). Existían, cubrían cosas que no cubre nadie
  más y no las llamaba ni `package.json` ni otro script: encontrarlas era saber de antemano que
  estaban. Ya tienen comando, que es como se evita volver a confundirlas con código muerto: el
  20-sep-2026 se borraron cuatro por eso y eran la única cobertura del camino real PHP/BD/WebSocket.
  `npm run test:playable-gallery` (la galería de autoría, también por `file://`),
  `npm run test:playable-sheets` (contrato de las láminas de los diez protagonistas nuevos; lo
  que no tenga su `review/` regenerado en local sale como `notPrepared`, que no es un fallo:
  esas carpetas están en `.gitignore`),
  `npm run test:playable-review -- --character=<clave>` y
  `npm run test:playable-row -- --character=<clave>` (una persona concreta, por el renderizador
  de verdad y por el invariante exacto del remo; **sin `--character` no hacen nada**),
  `npm run test:river-ddev` (embarque autenticado de verdad contra DDEV) y
  `npm run test:release-live <origen> <artefacto>` (humo en producción tras desplegar).
- `npm run test:browser`: integración con API local, seis idiomas e interiores.
- `npm run test:journeys`, `test:world-controls`: destinos, navegación y el mando
  del mapa (el dedo es un joystick invisible que SOLO anda, soltar para, y la cámara
  es del duende; lo de plantar destino arrastrando y correr por distancia se retiró
  el 19-sep-2026 tras probarlo el dueño). La segunda monta el
  claro compartido de `scripts/lib/input-arena.cjs`: **el mundo de verdad está vivo**
  y un gato que te coge en brazos convierte una prueba de controles en una lotería
  que falla en un sitio distinto en cada pasada.
- `npm run test:audio`: entrada, señal real, crossfade, voces y fullscreen.
  Sirve en el 47842 por defecto: contra el preview normal, `GAME_ORIGIN=…:47834`.
- `npm run test:embed`: el puente con la página que muestra el mundo. Comprueba las
  DOS caras de la garantía de la app — suelto no hay logo de vuelta, empotrado con un
  padre del mismo origen sí — más la tarjeta que no repite la pregunta, abrir con
  sonido y callar sin pisar la preferencia. Ver [EMBEDDING.md](EMBEDDING.md).
- `npm run test:boundary`: separación y arranque sin web; ver su arnés para puertos.
- `npm run test:live-crossing`: el bosque vivo DE VERDAD. Levanta el demonio de la web
  privada con el contrato de esta misma build, entra con sesión y sube y baja ocho veces
  por la costura pradera↔sauces andando, corriendo y dándose la vuelta al momento. Es la
  única suite que prueba lo que rechazaba los viajes; sin `../magikitos` al lado se salta sola
  (y SOLO por eso: cualquier otro fallo al cargar el demonio rompe la suite, a propósito).
- `npm run test:forest`, `test:objects`: las otras dos con demonio real en proceso — puertas,
  notas, plazas y cuerpos la primera; objetos compartidos, empujes y cámara la segunda.
- `npm run test:forest-ddev`, `test:shared-map`: la pila COMPLETA (DDEV HTTPS/WSS → PHP →
  MariaDB) con fixtures propias. Necesitan el DDEV arriba y la build instalada
  (`npm run install:local`); cuelgan si el servicio de plazas no está.
- `npm run test:art-live <origen>`: verificación de solo lectura del arte y el catálogo contra un
  host real, en los seis idiomas. Se usa después de desplegar: `npm run test:art-live https://magikitos.com`.
- `npm run test:studio-entrance`: la entrada de un edificio movida a mano en el Studio,
  con la geometría de PHP y la de JS dando el mismo hueco (`check-door-geometry.cjs`
  las compara en `npm test`). Workspace temporal; el del propietario no cambia.
- `npm run test:warehouse`: el almacén de la regadera — Cebolino a la vista junto al
  mostrador, precios en setas y nada regalado.
- Scripts PHP `check-community*.php` en el repo web: autoridad/transacciones
  con fixtures locales identificados y limpieza acotada a esas fixtures.

No ejecutar dos suites de Chrome a la vez: la pérdida de foco pausa el juego.
Las capturas/logs viven en `.local/`, no en documentación permanente.

## Contratos que no se deben duplicar

[Diseño](JUEGO-AVENTURA.md), [datos](../data/aventura/REFACTOR.md),
[navegación](NAVIGATION.md), [Studio](../tools/adventure-studio/README.md),
[arte](WOODLAND-KIT.md), [audio](AUDIO-AND-ENTRY.md), [API](API.md).
El artefacto activo y resultados concretos están en [RELEASE.md](RELEASE.md).
Pruebas responsive en Chrome no equivalen a certificar Safari/iOS ni rendimiento
en un teléfono físico modesto.
