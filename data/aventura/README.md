# Aventura: desarrollo y pruebas locales

## Abrir

```sh
ddev start
```

Juego: https://magikitos.ddev.site/aventura  
Web normal: https://magikitos.ddev.site/

Idiomas: `/aventura`, `/en/adventure`, `/de/abenteuer`, `/fr/aventure`,
`/it/avventura`, `/pt/aventura`.

**Exclusivamente local. No desplegar, consultar producción ni traer otra DB o archivos.**
La base y las copias de medios ya disponibles bastan. El bootstrap DDEV no carga
el `.env` compartido: usa MariaDB local y no importa credenciales de pagos, correo
o IA. Los endpoints locales de analytics y seguimiento de audio devuelven 204 sin
escribir eventos. El service worker local no conserva HTML anterior.
No ejecutar los scripts de despliegue ni `bashy/migrations-*`.

## Jugar

Toca el suelo para caminar; toca un objeto para acercarte e interactuar. También
funcionan flechas, WASD y ZQSD. Chocar con un objeto o vecino interactivo provoca
la misma interacción y no permite atravesarlo. No hay tecla E.
Entra y sal andando por las puertas; las salidas interiores están abajo y también
funcionan al acercarte de lado. Solo los interiores accesibles tienen puerta abierta.
Espacio mientras caminas o doble clic/toque en tu destino hace una voltereta.
Cada pulsación impulsa una vez; mantener Espacio no encadena volteretas.
En un diálogo, Espacio avanza y Enter/Escape cierran sin comprar ni activar acciones.
Los textos caben normalmente en una caja; el sistema admite más cuando haga falta.
La confirmación de cierre es «Ok»; las acciones conservan su nombre explícito.
Objetos y monedas vuelan al saco al recibirlos; con movimiento reducido solo se confirma.

Comienzas libre para explorar. El vecino sentado junto a la barbacoa tiene hambre:
puedes ayudarlo o pasar de largo. Recoge la seta, el palo junto al tronco y el mechero
de la primera casita junto a la fuente del pueblo, en cualquier orden. Cocina la brocheta y regálasela. La seta y el
palo se consumen; el mechero permanece. El vecino entrega **10 setines de prueba: ida y vuelta**.

Remo recibe y cobra en el embarcadero. Puedes hablarle o tocar la barca: la misma
interacción, sin duplicar reglas. El barco cobra 5 por trayecto y lleva al islote.
La travesía se ve durante unos segundos, con Remo remando y el protagonista sentado.
No se puede caminar, rodar ni abrir el saco durante el viaje. Se cobra al llegar;
recargar antes de terminar conserva el puerto de origen y el pasaje.
La vecina de las conchas paga otros 5 por un puñado de la orilla oriental. Puedes
repetir esa ayuda para futuros viajes. El primer regreso ya está cubierto por Brizno. El puente del bosque es
libre desde el principio; no existe el antiguo bloqueo por hambre.

Los únicos controles permanentes son música, «Yo» y saco. Selecciona un objeto en el
saco, pulsa «Usar» y toca su destino; × o Escape lo devuelve al saco sin gastarlo.

- Cuentos: junto al fuego nocturno del lago, con 6–10 narradores.
- Chistes: dentro de la taberna.
- Expresiones: el libro sobre el atril de la casa humana.
- Arte: claro de los artistas.
- Tienda: productos expuestos dentro del taller.

Los demás vecinos conversan, pero no distribuyen contenidos de otras zonas.
El vigilante puede acercarse al pedir ayuda desde el libro.
La fuente y las casas del pueblo están sobre hierba; el interior humano tiene
mobiliario en los bordes y espacio libre para caminar.
La iluminación nocturna nace del fuego, nunca del personaje.
La fuente ocupa el centro de una confluencia verde con caminos por ambos lados.
El lago continúa fuera del escenario: no se puede rodear para alcanzar el islote.
Orillas, pasos, diagonales y volteretas comparten la misma geometría de pies.

La presentación «Acercarse» (B) encuadra la actividad y muestra voz o pieza sobre el
mundo, sin el marco de una página. No tiene X: Escape o un toque fuera cierra;
el primer toque fuera no mueve al personaje. Caminar con teclado también cierra.
Buscar, explorar categorías, ampliar imágenes y leer son acciones deliberadas.
El audio continúa al ampliar o cerrar mientras permanezcas en su zona; al abandonarla se detiene.
«Otra» reutiliza el content pulse existente, incluida su exploración.
No hay cuaderno, teletransporte, enlace «abrir contenido» ni navegación `?content=`.
Entrar en aventura siempre recupera el lugar guardado, no el de una URL.

## Yo, hojas y necesidades

«Yo» muestra un único estado: tranquilo, ganas de mear o ganas de cagar.
Cada botón aparece solo cuando hay ganas de esa acción. Si estás
tranquilo no aparece ninguno; si toca cagar, solo aparece cagar. Mear llega
entre 6 y 10 horas reales; cagar entre 8 y 16. Cada plazo se sortea una sola vez al
crear la partida o terminar la acción correspondiente. El tiempo sigue con el
navegador cerrado; las ganas no caducan y no se acumulan acciones atrasadas.
Cagar tiene prioridad si vencen ambos plazos y al hacerlo se reinician ambos.
Mear solo reinicia su propio plazo. No hay daños, penalizaciones ni accidentes automáticos.

Las plantas de **culilimpia**, de hojas grandes y claras, están en el bosque y el
islote. Tocarlas recoge una hoja; se pueden volver a recoger y acumular hasta 99.
Sin hoja aparece la pista para buscarla. Una animación de cagar consume exactamente
una al terminar. Mear no consume objetos. Ambas acciones inmovilizan brevemente al
personaje; si recargas a mitad, no se gasta nada ni se reinician plazos.
La caca permanece 24 horas y el charquito 5 minutos, solo en tu mundo local;
máximo 48 marcas guardadas, sin colisiones ni eventos en la DB.
Los plazos se inicializan al crear la partida y se conservan al recargar.

### Probarlo ahora, sin esperar horas

```sh
node scripts/preview-adventure-life.cjs poop
```

Abre Chrome en una sesión desechable con ganas de cagar, al lado de la planta.
Prueba primero sin hoja; luego recoge alguna y abre «Yo». No modifica tu partida
habitual ni el reloj del ordenador. Cierra esa ventana al terminar.
También admite `pee`, `boat` (10 setines de prueba) y `cottage`.
Requiere el mismo Chrome/Playwright que las pruebas. Solo permite GET a DDEV;
es una herramienta manual de QA, no una función ni URL especial del juego.

## Guardado

`magikitos.adventure` en localStorage conserva escena, posición, entrada
usada, banderas, cantidades de objetos, monedero de prueba, sonido, plazos de necesidades
y marcas temporales. Se comparte entre los seis idiomas.
Las escrituras se agrupan cada dos segundos si hay cambios, al interactuar y al salir.
Si el almacenamiento está bloqueado, se puede jugar pero se informa de que no se
ha guardado. El saco muestra ese estado.

Se reutiliza el device ID existente sin crear eventos de juego ni nuevas cuentas.
**El progreso sigue siendo local al navegador**, no sincronizado con una cuenta.
El monedero del juego está aislado y etiquetado como prueba: **no altera los setines
de cuentas**, que actualmente son reputación. No se escribe en su ledger SQL.
Las recompensas únicas no se repiten; ningún pasaje se descuenta si falla la carga
del destino. No hay deudas ni saldo negativo.

Un único formato de desarrollo, sin `version`, `revision`, claves anteriores ni
compensaciones automáticas. La validación conserva solo campos y objetos actuales.
Una posición inválida vuelve al inicio seguro de su escena; el resto del progreso
válido se conserva. Cambiar el idioma no cambia la clave ni crea otra partida.
La constante del registro se comparte con las pruebas, no se copia entre scripts.

Para probar de nuevo sin borrar tu partida habitual, usa un perfil de navegador
aparte o una ventana privada. No hace falta borrar cookies ni la DB.

## Backend y web normal

La web publicada conserva navegación, tienda, formularios, SEO y URLs.
El juego no carga fuera de sus seis rutas. Cuenta, grabaciones, aportaciones y
checkout se abren en la web normal; el carrito se comparte.
El concurso y el admin quedan fuera de esta adaptación.

`GET /api/world/content?lang=es&path=/cuentos` es un endpoint interno de fragmentos,
no una URL navegable del juego. Valida una lista de rutas públicas de lectura,
captura los controladores existentes y les aplica las vistas de aventura.
No duplica consultas, búsqueda, permisos ni votos. La comprobación de zona vive
en el cliente: es una regla de juego, no una barrera de seguridad para contenido público.
Los formularios sensibles conservan sus rutas y controles de autorización originales.

Los habitantes representan autores públicos, no usuarios conectados en tiempo real.
Su avatar se asigna de forma determinista. Animación y paseos ocurren en el navegador;
no hay sockets, polling ni peticiones por fotograma.
No se inventan voces cuando falta un archivo local: se muestra el error de audio.

Aventura y sus endpoints llevan noindex y no-store; las páginas públicas conservan
su HTML y metadatos originales. El juego requiere JavaScript; la web normal no.
No hay duplicados de contenidos indexables en `/aventura`.

## Construir y comprobar

```sh
bash scripts/build-world.sh
node scripts/check-world.cjs
node scripts/check-world-controls.cjs
node scripts/check-world-life.cjs
node scripts/check-world-experience.cjs
node scripts/check-adventure-studio.cjs
```

Build: PHP/GD y esbuild, o `WORLD_ESBUILD=/ruta/a/esbuild`.
Hornea los paquetes de sprites, compila assets y comprueba contratos de vistas, módulos, idiomas,
colisiones, reglas, puertas y progresión. No accede a servidores remotos.

Navegador: Chrome y Playwright; `PLAYWRIGHT_PATH=/ruta/a/node_modules/playwright`
y `WORLD_URL=https://magikitos.ddev.site` permiten configurar las rutas.
El test rechaza hosts no locales y bloquea solicitudes externas y métodos no GET.
Usa guardados de prueba en su propio contexto, nunca modifica tu perfil habitual.
Guarda capturas en una carpeta temporal y recorre la apertura con clics reales,
puertas en ambos sentidos, saco, puente libre, receta opcional, recompensa, barco,
fallo de carga sin descuento, regreso pagado, receta y recompensa con eventos táctiles,
fichas, audio, buscadores,
regiones, carrito, seis idiomas, móvil táctil, tablet y escritorio.

Inspección de solo lectura: `window.MagikitosAdventure.inspect()`.
No hay API de depuración que permita teletransportar al jugador.

Estas pruebas no certifican Safari/iOS físico ni pagos, correo, IA o envíos externos.
Tampoco sustituyen una futura revisión de SEO previa a publicación.

## Arte y arquitectura

293 sprites repartidos en 25 paquetes PNG independientes; unos 233 KB para la
biblioteca completa, más metadatos. El islote no descarga su vegetación al entrar
en el bosque. Cada paquete usa nombre con hash de contenido y caché propia.
Protagonista exclusivo + cinco variantes de vecinos, ocho direcciones y cuatro poses.
La voltereta del protagonista tiene otras cuatro poses por dirección, en su propio paquete.
Las poses de necesidades, los nuevos objetos y la barca con pasajeros son otros
paquetes independientes. Las rayitas del agua se animan suavemente sobre el terreno
cacheado: no se repinta ni invalida todo el mapa en cada fotograma.
No se descargan originales ni se escanean píxeles al arrancar. Caché LRU de 24 chunks,
cuatro modelos de escenario y paquetes gráficos activos más una caché acotada.
Los árboles y casas no se transparentan; el alfa de los sprites solo elimina su fondo.

Diseño de juego: [JUEGO-AVENTURA.md](../../JUEGO-AVENTURA.md).  
Contratos y extensión: [REFACTOR.md](REFACTOR.md).  
Revisión vigente del núcleo: [CORE-REVIEW.md](CORE-REVIEW.md).  
Arte: [ART.md](ART.md), [prompts](ART-PROMPTS.md).
## Historial de verificaciones locales — 12/09/2026

Build y contratos verificados. 74 recorridos seguros entre colocaciones, doce órdenes
de recogida/encendido, premios únicos, pasajes y regreso repetible. Pruebas separadas
de deduplicación, caché de sprites, fallo y reintento.
Controles: ocho orientaciones a tres tasas de fotogramas, dobles pulsaciones,
colisiones durante voltereta, umbrales laterales y las reglas de monedero entonces vigentes.

Integración en Chrome: web normal separada; casa, salida, libro, barbacoa y entrega;
viaje fallido sin descuento y reintento; ambas travesías pagadas; regiones, búsqueda,
audio, fichas y carrito. Seis idiomas, escritorio, tablet y móvil vertical/horizontal.
Eventos táctiles reales de Playwright: recoger, cocinar, regalar, persistir recompensa
y subir al barco en ambos sentidos, con las llegadas visibles en pantalla.

Analytics local antes y después: 363.349 registros, sin nuevos eventos de juego.
No se han consultado servicios de producción ni importado DB/medios.
No se han ejecutado pagos, envíos ni escrituras de saldo de cuenta.

Los dos archivos públicos del atlas monolítico se retiraron; copia recuperable de
esta sesión en `/tmp/magikitos-retired-atlas.SGCANp`. Los originales artísticos
permanecen en `data/aventura/art/`; el build usa solo los módulos actuales.

### Repaso de controles, recogida y barqueros

`check-world-controls.cjs` comprueba Enter/Escape/Espacio (incluido un diálogo
de dos páginas y mantener tecla), las ocho volteretas con teclado, doble clic y
doble toque en el mismo navegador, salida lateral de todos los interiores —también
el taller dimensionado con los productos locales— y salida durante voltereta.
Verifica al barquero, la pista anterior a la brocheta, que Enter no compre aunque el
botón esté enfocado, y la ida/vuelta con 10 → 5 → 0 sin una tarea intermedia.
También revisa la animación y limpieza de recogida, el saco, movimiento reducido
y cuadros a 1440×960, 768×1024, 390×844 y 844×390. Solo GET a DDEV.

Las cinco versiones gráficas de edificios sustituidas (10 PNG/JSON) se movieron a
`/tmp/magikitos-door-packs.DA7KYv`. Sus originales siguen en el proyecto.

### Travesía, casita y necesidades — 13/09/2026

En esa pasada: 78 rutas transitables, seis idiomas y suite pura adicional de
reloj, inventario, trazas, plazos simultáneos, cosecha repetible y secuencias finitas.
`check-world-life.cjs` comprueba ambos alivios con poses visibles, hoja consumida
al finalizar, recarga a mitad sin gasto, recogida del mechero sobre la mesa,
agua, viaje bloqueado, 10 → 5 → 0, interrupción sin cobro y movimiento reducido.
Recorre escritorio 1440×960, móvil 390×844 y tablet 820×1180 con capturas para revisión.
También prueba «Yo» y la respuesta sin hoja mediante eventos táctiles en los seis
idiomas a 320×568, sin desbordamiento horizontal y conservando los mismos plazos.
Las necesidades se prueban con fechas de partida preparadas, no esperando 16 horas
ni cambiando el reloj del sistema. Todo en contextos aislados; no se ha tocado tu partida.

Tras el ajuste visual se retiraron cuatro derivados PNG/JSON obsoletos de esta
pasada (no originales). Copia recuperable:
`/var/folders/t3/5frkk18s0jg3tmsx2rx10w280000gn/T/magikitos-life-retired-SpChZx`.
