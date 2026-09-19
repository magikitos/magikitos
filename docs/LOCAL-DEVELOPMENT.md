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
recetas, economía, guardado, cien NPC, colisiones, orillas, navegación, cámara,
entrada, audio, bitsets, API, Studio y verificación del instalador.

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
- `npm run test:browser`: integración con API local, seis idiomas e interiores.
- `npm run test:journeys`, `test:world-controls`: destinos, navegación y el mando
  del mapa (arrastrar planta el destino en el centro, anda/corre por distancia,
  soltar no para y la cámara es del dedo). La segunda monta el
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
