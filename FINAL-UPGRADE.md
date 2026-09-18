# FINAL-UPGRADE.md — El bosque vivo

> **Este documento es el encargo completo.** Quien lo implemente no debería
> necesitar preguntar nada: cada decisión lleva su porqué, cada número está
> medido, y lo que NO se hace está dicho igual que lo que sí.
>
> Funde y **sustituye** a `CONSTRUCCION.md`, que se borra al aplicar esto. Dos
> documentos contando la misma entrega es uno que se queda sin el siguiente
> arreglo.

Fecha del encargo: **17-sep-2026**. Todas las cifras de este documento están
medidas ese día contra la caja y el árbol de verdad, no estimadas.

**Decisiones actualizadas por el dueño el 18-sep-2026:** los mensajes son texto
libre del usuario: puede escribir lo que quiera, en cualquier idioma, sin
verificación de contenido ni revisión previa, automática o humana. El dueño los
lee y modera manualmente después de publicarse; caducan a las 24 horas.
Reiniciar el servidor vacía las plazas y la cola: todos vuelven a entrar por una
cola nueva, por orden de llegada, sin recuperar turnos ni reservas. La entrega
abarca TODO este documento funcionando en producción, sin una espera obligatoria
de semanas entre fases.

**Orden vigente del dueño (18-sep-2026): terminar Brezo bruma (101) y parar.**
Cerrar su revisión, actualizar `ART-DUENDES.md` y entregar el estado de lo hecho
y lo pendiente. No iniciar otro personaje, otro bloque del plan ni un despliegue.
Esta orden sustituye la continuación automática anterior. El encargo global
sigue incompleto: detener el trabajo no equivale a declararlo terminado.

**La entrega debe ser íntegra:** TODO este documento
implementado, probado y funcionando en producción, incluidos ambos repositorios,
API, arte, cliente y servicio de tiempo real, sin romper los demás sitios del
VPS. No basta una entrega parcial ni dejar bloques pendientes para otra ocasión.

---

## 0. La visión, en una página

El bosque de los Magikitos deja de ser un mapa con un claro editable y pasa a ser
**un espacio social**: un mundo que se construye entre todos, donde te cruzas con
gente de verdad, y donde lo que dejas lleva tu firma y lo ve quien pase.

Cinco piezas, en este orden de importancia:

1. **Todo el mapa se construye.** Cuatro pantallas enteras, y lo que se enumera
   es lo PROHIBIDO, no lo permitido.
2. **La gente se ve.** Presencia en vivo, **tope de 100 plazas**, y quien no cabe
   entra igual como **espectador** (que es la cola, sin sala de espera).
3. **Los objetos compartidos tienen dueño.** Si dos personas empujan la misma
   caja en sentidos contrarios, la caja no se mueve. Eso exige un servidor con
   autoridad y un tick, no un sondeo.
4. **Se dejan mensajes**, clavando un pergamino en una caca con un palo. Duran 24
   horas, que es exactamente lo que ya dura una caca. Texto libre en cualquier
   idioma, publicado al momento y con moderación manual posterior del dueño.
5. **Las aventuras siguen siendo personales.** El progreso, los objetos y los
   retos son de cada uno. Lo compartido es el SITIO, no la partida.

Y una regla de producto que gobierna todo lo demás: **100 plazas no es una
limitación técnica, es el producto.** Cien personas con buena reputación haciendo
cosas buenas valen más que mil pasando por ahí. La escasez es la propuesta.

---

## 1. Estado de partida

**La base de la Parte A enumerada debajo ya está COMMITTEADA en ambos
repositorios.** No es trabajo que haya que volver a escribir. En la revisión
actual también hay cambios locales preexistentes: conservarlos y revisar el
estado y los diffs antes de retomar la implementación; no asumir árboles limpios
ni descartar trabajo para sincronizar los repositorios. Esta actualización del
documento no modifica esos cambios ni autoriza continuarlos.

```
magikitos-game/   (cambios ya en Git)
  data/aventura/catalog.json            objetos rake y grassSeed
  data/aventura/construction.json       4 zonas, requires, removeCost, separation
  data/aventura/locales/core.json       8 claves nuevas ×6 idiomas
  public/assets/js/adventure/community.js
  public/assets/js/adventure/construction-layout.js
  public/assets/js/adventure/scenes.js
  scripts/check-adventure.cjs
  scripts/check-community-browser.cjs
  scripts/check-construction-layout.cjs
  tools/community-terrain.cjs
  tools/game-contract.cjs
  docs/SHARED-FOREST.md · docs/GAME-SAVE-API.md
                                        (ficheros añadidos, ya en Git)
  public/assets/js/adventure/construction-ground.js
  scripts/community-spot.cjs

magikitos/        (cambios ya en Git)
  src/game/community.php
                                        (fichero añadido, ya en Git)
  migrations/4236_todo_el_bosque_se_construye.sql
```

La comprobación documentada del 17-sep fue `npm test` entero (37 PASS), con esta
base todavía sin desplegar. Antes de implementar o publicar, comprobar de nuevo
las pruebas, la release activa y las migraciones aplicadas; la revisión del
documento del 18-sep no ha ejecutado pruebas ni tocado producción.

### Seguimiento de implementación — trabajo local, entrega todavía abierta

Este seguimiento registra avances verificados en local; no sustituye el cierre
completo del encargo ni demuestra por sí solo que estén desplegados.

- A/B.1–B.4 y H.2 tienen cambios locales y pruebas: recogidas, rastrillo,
  semillas/crecimiento con reloj del servidor, movimiento que cierra el diálogo
  y un único reintento de conflicto de zona. La conversión de fechas respeta la
  hora de Madrid que usa la web. No equivale a un despliegue de estas partes.
- B.5: carga de vecinos por viewport, admisión de sprites por bytes (también
  pendientes), leases de preparación, `M`/`F` en origen y retirada de los
  paquetes de arco/rodar. Los cien maestros siguen intactos. La selección por
  usuario y las siete acciones para todos los treinta elegibles siguen pendientes.
  Brezo alba (100) y Brezo bruma (101) tienen las siete hojas aceptadas y horneadas,
  con escala/anclas medidas. Alba sustituye al protagonista anterior en el motor
  local; **los dos se pueden elegir en el juego publicado desde el 18-sep-2026**
  (§B.5.11), y las herramientas de revisión siguen pudiendo fijar cualquiera con
  `GAME_PLAYER_VARIANT`. Casco y remero ya se componen por separado con máscaras
  por vista y fase; el compuesto antiguo se retira del manifest. Cobertura actual:
  **14 de 210 hojas**. Seguimiento por personaje: [ART-DUENDES.md](ART-DUENDES.md).
  `npm run test:playable-art` exige que cada duende OFRECIDO esté completo y DICE
  cuántos personajes faltan; ya no bloquea la publicación por no tener los treinta.
- Corrección de arte de navegación (18-sep): la botella será **solo el casco
  vacío, sin asiento ni remos**; el protagonista va sentado, pies hacia delante,
  con ambos remos en las manos. La propuesta `bottle-boat-layer-padded` y el
  remero sin remos quedan descartados antes de integrarse. El casco ya está
  corregido; no falta otro tipo de arte del mundo. La edición que borraba palas
  también está descartada: el recorte es mediante máscaras, con el original
  íntegro. Brezo alba está aprobado; Brezo bruma ha cerrado su revisión con
  remos largos, perspectivas corregidas y rig propio. La ampliación posterior
  de ocho cascos está generada y verificada con ambos; sigue inactiva en la
  partida. La botella es el casco por defecto. Se detiene el trabajo aquí por
  la última orden del dueño. Contrato, evidencias y pendientes individuales en
  [ART-DUENDES.md](ART-DUENDES.md); ninguna de estas correcciones está desplegada.
- Las pruebas de navegador incluyen escenas pobladas en escritorio, tablet y
  móvil, además de la galería del Studio. Su resultado no prueba por sí solo la
  futura carga de cien jugadores: falta integrarla con presencia y probarla.
- C: API de necesidades/mensajes, consumibles y reintentos atómicos, caducidad,
  moderación manual y fusión de identidad implementados y probados en DDEV.
  La comprobación concurrente fuerza dos autores a esperar el mismo cerrojo;
  una mutación en memoria demuestra que quitar la lectura actual de proximidad
  rompe la separación. La implementación corregida supera las 47 comprobaciones.
  Pergamino/boli se recogen en las cuatro resoluciones de navegador probadas.
  Publicación y lectura ya integradas: texto literal, seis idiomas de interfaz,
  reloj del servidor, diario de una operación pendiente sin credenciales y
  reintento exacto tras recargar, sin duplicar consumibles ni rastros locales.
  Cuatro mutaciones en memoria prueban que las comprobaciones detectan doble
  cobro, recibos olvidados, texto reescrito y lecturas antiguas de necesidades.
  Probado en Chrome de escritorio/tablet/móvil y con juego/API/WebSocket/MariaDB
  reales en DDEV, incluida moderación manual. La migración 4237 está aplicada
  solo en local; no se llama a ningún juez de contenido.
- D/E: el servicio privado `bosque-vivo/` ya valida tickets PHP, mantiene plazas
  y cola solo en memoria, limita movimiento y filtra presencia por viewport.
  La API de mensajes utiliza su observación firmada, no coordenadas del cliente.
  Pruebas: 18 del transporte/autoridad, 6 mutaciones negativas, 58 cruces del mapa
  real y 31 del recorrido HTTP/WebSocket/DB, con reinicio, baneo y rechazo de
  escrituras directas desde un espectador. El cliente ya
  conecta, renueva tickets, interpola vecinos y cruza puertas/muelles/bordes con
  autorización; probado con el juego real en tres navegadores independientes de
  escritorio/tablet/móvil, incluida la promoción de espectador. PHP exige plaza
  y zona observadas para construir/usar mobiliario. Las tareas ambientales ceden
  actividad según la presencia visible. Carga local: 100 jugadores y 1.000
  espectadores reales de prueba. La autoridad de empuje ya tiene núcleo a 20 Hz
  y transporte probado con dos clientes reales: fuerzas opuestas, caducidad de
  intenciones, contactos observados, propuestas simultáneas y difusión por
  viewport. Ocho mutaciones negativas comprueban sus garantías. El terreno se
  compila al píxel desde el motor: 10.272 casos de colocación y 181.170 puntos
  del bosque/río contrastados. Las macetas del puzle personal siguen privadas;
  ningún objeto comunitario se escribe en el guardado personal. La persistencia
  ya usa un worker PHP privado: volcado sucio cada 10 s, exclusión de un segundo
  escritor, carga coherente de posiciones/muebles y apagado real con `SIGTERM`
  probado contra MariaDB. La migración 4238 está aplicada solo en DDEV.
  Construir/restaurar adquiere una barrera de empuje y confirma posiciones y
  muebles en la misma transacción. Ocho comprobaciones reales cubren solapes,
  reintentos, respuesta perdida, cerrojo SQL retenido más que la concesión,
  reinicio y restauración administrativa. Las pruebas negativas detectan quitar
  el cerrojo SQL, la persistencia atómica, la comprobación de solapes y cuatro
  garantías de la barrera. El terreno construible ya excluye la posición inicial
  de los objetos móviles comunitarios: moverlos no deja un hueco permanente.
  El cliente ya integra colisiones autoritativas e interpolación visual, sin
  predecir posiciones ni guardarlas en la partida. Empuje con teclado/clic probado
  a 20/30/60/120 fps y seis mutaciones negativas. Navegadores reales de
  escritorio/tablet/móvil prueban
  fuerzas opuestas, llegada y empuje por clic, promoción del espectador móvil,
  joystick y conservación de colisiones al desplazar la cámara. La admisión
  comprueba que un objeto desplazado no atrape a quien vuelve a entrar; incluye
  cinco mutaciones negativas, reconexión con gracia y llegada real en navegador
  desde un guardado ocupado por un objeto. Las pruebas de navegador
  usan una escena e identidades sintéticas, no activan el mapa compartido real.
  Las revisiones de construcción ya se notifican en las cuatro zonas, incluso
  sin objetos empujables: solo cambios confirmados en SQL y avisos agrupados.
  El cliente solicita una instantánea autenticada por vez, descarta respuestas
  antiguas y sustituye solo las entidades comunitarias y sus colisiones; no
  reconstruye el mundo ni reinicia gatos, rutas o actividades sin cambios.
  Probado con escritorios/tablet/móvil reales (colocar, mover y retirar), además
  de transacciones MariaDB y recuperación de un aviso perdido. Se renueva la
  autoría al cambiar de cuenta aunque no cambie la revisión del mundo; una
  respuesta de construcción tampoco puede contaminar la cuenta nueva. Seis mutaciones
  negativas del cliente y cuatro del servidor verifican estas garantías.
  En DDEV también pasa el recorrido sin mocks de construcción: valla, camino y
  piscina, cada uno en escritorio/tablet/móvil, con retirada recibida por socket,
  devolución exacta de materiales y limpieza de las identidades sintéticas.
  El baneo manual ya revoca la conexión abierta, cancela el empuje y libera la
  plaza sin gracia. Cada admisión/renovación consulta SQL en lotes acotados, y una
  auditoría periódica cubre avisos perdidos, cuentas fusionadas o borradas. Una
  respuesta anterior al baneo no puede readmitir al usuario. Probado con sockets
  reales, 15 comprobaciones SQL, cuatro mutaciones negativas y el navegador real
  de DDEV sin recargar; también ticket antiguo tras reiniciar y desbaneo.
  Tres objetos del mapa original ya están activados como compartidos en local:
  la caja del claro, la maceta de artistas y la caja del embarcadero de los
  sauces. Conservan las posiciones del Studio y heredan sus cuerpos de las
  familias. El recorrido real en DDEV, sin sustituir mapa/API, comprueba empuje
  opuesto en escritorio/tablet, toque móvil, guardados privados sin posiciones
  compartidas y persistencia tras reiniciar el supervisor. Las cinco macetas
  del seto siguen privadas; su empuje/recarga pasa en cuatro tamaños de pantalla.
  PHP también rechaza esos IDs compartidos en `game-save`: 24 comprobaciones de
  persistencia/contrato y 21 HTTP pasan con identidades sintéticas eliminadas.
  Esa prueba encontró y corrigió un cierre de DDEV que mataba PHP antes del
  volcado final: aislamiento del grupo de procesos, `exec` del supervisor,
  prueba negativa que detecta perder el volcado y prueba de muerte del padre
  sin dejar un escritor huérfano. La posición/revisión se conserva; la cola no.
  Sigue pendiente completar el recorrido con todos los avatares. DDEV ya arranca
  el servicio local permanente con clave privada ignorada por Git y proxy
  HTTPS/WebSocket del mismo origen; la operación de producción sigue pendiente.
  Detalle y comandos:
  `../magikitos/bosque-vivo/README.md`. No equivale a multiplayer terminado.
- F/G y la verificación completa en producción **siguen pendientes**. No se ha
  activado una release de este encargo en producción. Se conserva el alcance íntegro.

### PUBLICADO — 18-sep-2026

El bosque compartido está **vivo en producción** con la release
`9282be30865415a44257`. Lo que sigue (el handoff de la parada anterior y las
partes A-H) se conserva porque explica POR QUÉ está hecho como está; lo que ya no
describe el presente es lo que se marca aquí.

| | |
|---|---|
| Migraciones | 4236, 4237, 4238 y **4239** aplicadas, cada una con su copia previa |
| Artefacto | estacionado y luego activado con el PHP en el MISMO despliegue (§G.5) |
| Servicio | `bosque-vivo.service`, `enabled`, 38 MB de 512, 0 reinicios, `ulimit` 65535 |
| Proxy | `ProxyPass /bosque … upgrade=websocket` SOLO en el vhost de magikitos |
| Reinicio | paso 7 de `vps-deploy.sh` y paso 8 de `vps-rollback.sh`, lista declarativa |
| Comprobado | `101` a través de Cloudflare, plaza de jugador, cambio de duende sin soltar el asiento, elección que sobrevive a una recarga desde la CUENTA, `overworld → tavern → overworld` con presencia viva a 1440 y a 390, y 35 s quieto contra el corte de Cloudflare |

Las identidades de prueba se retiraron todas: cero cuentas y cero filas huérfanas.
**Lo que sigue abierto es el ARTE**: dos de los treinta protagonistas están
completos, y el elenco crece solo el día que entren sus hojas (§B.5.11).

### Handoff al detener el objetivo — 18-sep-2026

La orden vigente es **cerrar Brezo bruma y detenerse**, no reducir el alcance ni
dar la entrega por completa. El inventario detallado de arte está únicamente en
`ART-DUENDES.md`; no duplicar aquí sus tablas ni empezar otro protagonista.
**Cierre realizado:** Bruma y las nueve barcas pasan la revisión; `npm test`
pasa. Artefacto local instalado: `d3315d78a03d225044b2`, sin cambiar el contrato
de API/presencia ni las partidas del dueño. Trabajo detenido; ninguna
publicación remota en esta ronda.

**Implementación que todavía falta:**

1. **B.5, elenco:** completar y revisar los 28 protagonistas restantes. Hay
   14/210 hojas aceptadas: 248/3.720 poses adicionales. Las siete propuestas de
   Menta alba todavía no son arte aceptado. Los cien vecinos siguen conservados.
2. **B.5.10, identidad jugable — HECHO el 18-sep-2026.** Ver §B.5.11: sorteo por
   cuenta, selector sin categorías en `YO`, persistencia en la cuenta, ticket con
   la elección dentro y `users.gender` solo si está vacía. Lo único del apartado
   que NO se hizo es el recordatorio de una sola vez al crear la cuenta, y está
   razonado ahí: el selector vive en el mismo panel que la puerta de la cuenta y
   lleva su propia línea permanente, que explica lo mismo a todo el mundo y no
   solo a quien entra por correo.
3. **B.5/D/E, integración final del elenco:** falta comprobar todas las acciones
   de todos los protagonistas observadas por OTROS jugadores. La elección ya
   viaja: el ticket la firma, `renovar` la aplica sin soltar el asiento y un
   duende que esta release no dibuja se pinta con el de la casa en vez de tumbar
   el bucle de pintado (§B.5.11). Lo que queda es el recorrido real y los 28
   artes ausentes.
4. **F/G, operación de producción:** preparar/instalar el servicio systemd y
   su worker PHP, límites, clave privada y proxy WebSocket exclusivo de Magikitos;
   integrar el reinicio posterior al despliegue y verificar versiones/reconexión.
   La parada ordenada con volcado existe y está probada en local; falta su
   operación real bajo systemd/Apache/Cloudflare, sin afectar a los demás sitios.

**Entrega/verificación todavía pendientes, no confundir con código ausente:**

- Revisar y comittear los cambios de ambos árboles, incluidos archivos nuevos;
  publicar mediante la identidad personal. Los avances de esta ronda permanecen
  locales, sin commit/push/despliegue. No resetear ninguno de los repositorios.
- Migraciones y activación coordinada de PHP, contrato, artefacto y servicio,
  conservando el rollback y los datos nuevos. Ver §H.3 para el estado local.
- Recorrido final en producción: construir, empujar, publicar/moderar mensajes,
  ver a otros jugadores con su apariencia, espectador/promoción, baneo,
  reconexión/reinicio, persistencia y juego individual con servicio caído.
- Medir la carga gráfica/red/memoria con el elenco definitivo y presencia real
  integrada. Los 100 jugadores + 1.000 espectadores sintéticos locales prueban
  el transporte, no equivalen a cien avatares completos dibujados en un móvil.
  Las comprobaciones actuales de pantallas no son pruebas en hardware físico.

**No hay que reimplementar** A/B.1–B.4/H.2, C ni el núcleo D/E: su estado y
pruebas locales están detallados arriba. Tampoco falta otra familia de arte del
mundo para este encargo. Los ocho cascos extra son reserva preparada, sin
recetas/desbloqueos: dejarlos inactivos es la decisión del dueño, no un fallo.
`npm test` valida el trabajo existente. **La puerta de arte ya NO exige 210**
(decisión del dueño, 18-sep-2026: «se lanza con los dos que hay y crece solo
cuando subas hojas»): `npm run test:playable-art` exige que cada duende OFRECIDO
esté completo —que es lo que de verdad no puede fallar— y DICE en voz alta
cuántos personajes faltan para el elenco final. Lo que se rebajó es la fecha de
publicación, no la vara: un duende a medio dibujar sigue sin poder ofrecerse.

---

# PARTE A — El bosque construible

## A.1 Qué cambia y por qué

Hasta hoy la zona compartida era **un rectángulo dentro de una pantalla**: el
claro de los sauces medía 48×30 tiles dentro de un río de 128×144. Construir
juntos pasaba en el 8% de una sola pantalla de doce. Eso es una parcela, y una
parcela no es un espacio social.

Ahora **la zona ES la pantalla**, y lo que se enumera es lo PROHIBIDO. La
diferencia importa más de lo que parece: una lista de permitido hay que ampliarla
cada vez que el mapa crece, y mientras nadie la amplía el mundo está cerrado; una
lista de prohibido nace cubriendo el mapa entero y solo se toca cuando aparece
algo que proteger.

Cuatro pantallas abiertas: `overworld`, `claro-de-los-sauces` (el río de los
sauces entero), `river-rapids` y `river-roots`.

## A.2 Lo prohibido se compila, no se escribe

`tools/community-terrain.cjs` hornea, en tiempo de build y **del mismo terreno y
los mismos colisionadores que juega la gente**:

| Dato | Qué es | Medido |
|---|---|---|
| `bounds` | la pantalla entera | 144×112 el bosque, 128×144 cada río |
| `terrain` | dónde se puede estar de pie, una celda por tile | **71.424 celdas** en cuatro pantallas |
| `protected` | dónde no se deja nada | 40 rectángulos en el bosque, 19 sauces, 6 y 7 los otros ríos |
| `accessGroups` | lo que tiene que seguir alcanzándose, agrupado por isla | 39 anclajes en el bosque, 20 en sauces |

Lo protegido sale de **lo que el propio mundo puso ahí y hace algo**: una puerta,
un muelle, un vecino, una seta que se corta. Cada cosa con su margen para poder
llegar (`MARGIN` en ese fichero: portal 1,5 · muelle 1,5 · vecino 1 · resto 0,5).
Encima, los rectángulos que el catálogo escribe a mano para un sitio que es de
AMBIENTE y no de un objeto: hoy dos, **el rincón del merendero humano
`[0,4,34,18]` y el de la barbacoa `[78,38,14,11]`**.

⛔ **Y esa es la razón de compilarlo.** La barbacoa se movió un cuarto de casilla
la mañana de esta entrega y tapó el felpudo de una casa. Si los sitios protegidos
fueran una lista escrita a mano, hoy estarían protegiendo el sitio donde la
barbacoa **estaba**.

## A.3 El suelo no viaja dos veces

Las filas de suelo pesan **73 KB** contra un mundo de **107 KB**, y el mundo va
incrustado en la página, en seis idiomas: pegarlas al mundo sería un 70% más de
HTML en cada carga para decir algo que el cliente sabe calcular.

- La máscara **solo viaja al servidor**, dentro de `game-contract.json`.
- El navegador la calcula de la pantalla que ya tiene cargada
  (`construction-ground.js`, `catalogGround()`, las mismas cinco esquinas que
  deciden si puedes pisar un tile).

⛔ **Y se pregunta por el DATO CRUDO de la pantalla, nunca por el mundo vivo.**
`community.sceneData()` le cose al mundo las piezas que ha puesto la gente, así
que `game.world` tiene agujeros donde hay un banco ajeno. Con el mundo vivo, el
fantasma diría «necesita suelo firme» sobre el sitio de un banco que se acaba de
quitar y la autoridad diría que sí. Por eso `catalogGround()` recibe el CATÁLOGO
y un nombre de pantalla, no un modelo: así no queda ninguna decisión que se pueda
tomar mal. *(Este bug existió y se arregló; no lo reintroduzcas.)*

## A.4 Lo prohibido juzga lo que PONES, no lo que ya había

Las dos reglas nuevas —dónde no se puede dejar nada y no calcar un trazo— miran
**solo a la pieza candidata**. No es una laguna: es lo que impide que ampliar la
lista de sitios protegidos condene un banco que alguien colocó hace tres semanas,
cuando ese sitio era legal. Si la validación entera se aplicara a todo, bastaría
con proteger un rincón nuevo para que el rincón quedara **congelado**.

Lo que sí juzga a todos es la **disposición** (caber, no pisarse, no cerrar el
paso), porque eso describe el resultado y no el permiso.

## A.5 Construir no puede partir el mundo en dos

Los anclajes van **agrupados por la isla en la que nacen**: las dos orillas de un
río no están unidas a pie, y exigir que lo estén invalidaría cualquier cosa que
se pusiera. Lo que se exige es que nadie **reduzca** lo que ya estaba unido.

Un camino queda FUERA del relleno por inundación: ocupa sitio (nadie entierra un
banco debajo) pero se anda por encima. Si contara, tres caminos cruzando el
bosque lo dejarían incomunicado.

## A.6 Un trazado se empalma o se aparta, pero no se pone al lado

Sin esta regla el bosque acaba con seis caminos paralelos a media celda porque
cada persona traza el suyo al lado del anterior.

Se mide sobre el trazo NUEVO, muestreando cada media celda la distancia al trazo
más cercano **de su mismo tipo** (una valla al lado de un camino es justo lo que
uno quiere poner):

- **Contacto** (≤ `POLYLINE_JOIN`): empalme, cruce o bifurcación. Vale, pero en
  tramos cortos: más de `POLYLINE_CONTACT_RUN` celdas ya no es unirse, es calcar.
- **Banda** (entre el contacto y la separación): solo se pisa mientras te ALEJAS
  de un empalme, que es lo que hace cualquier bifurcación al nacer.

| Constante | Valor | Dónde |
|---|---|---|
| `POLYLINE_JOIN` | 0,5 tiles | `construction-layout.js` + `community.php` |
| `POLYLINE_CONTACT_RUN` | 1,5 tiles | ídem |
| `POLYLINE_SAMPLE` | 0,5 tiles | ídem (la misma rejilla de colocación) |
| `POLYLINE_HALF` | 0,25 tiles | lo que ocupa a cada lado |
| `POLYLINE_MAX_LENGTH` | 24 tiles | ídem |
| `POLYLINE_MAX_POINTS` | 8 vértices | ídem |
| `separation` | 3 tiles | por pieza, en `construction.json` |

⛔ Las constantes están **duplicadas a mano** entre los dos motores y eso lo
vigila la prueba de paridad, que corre los dos sobre los mismos casos. Si tocas
una, toca la otra o el build te lo dice.

## A.7 Cavar cuesta tener la herramienta, no gastarla

Una herramienta se **exige**, no se gasta: `gameAuthorityMatches`, la misma
pregunta que ya guardaba la puerta de un rincón, aplicada a la pieza.

Y **quitar un camino es SEMBRAR HIERBA**: un camino no se recoge, se tapa. Su
pieza declara `removeCost` y ahí no hay nada que devolver; el botón de quitar
cambia de nombre. Todo lo demás se desmonta y sus materiales vuelven al saco.

```json
"forest-path": {
  "costPerTile": {},
  "requires":    { "items": { "rake": 1 } },
  "removeCost":  { "grassSeed": 1 },
  "removeLabel": "buildSowGrass",
  "separation":  3,
  "maxPerAuthor": 12
}
```

## A.8 Máximos

| | |
|---|---|
| Por autor y pantalla | 24 objetos |
| Por pantalla | 320 el bosque, 240 cada río (96 por defecto) |
| Por tipo y autor | `maxPerAuthor`: camino 12, valla 8, resto 8 |

## A.9 Lo que falta de la Parte A: el arte

⛔ **DECLARAR UN SPRITE QUE NO EXISTE EN EL ATLAS ROMPE TODAS LAS PANTALLAS.**
`SceneDirector` pide los sprites de TODOS los objetos del saco al entrar a
cualquier sitio, y `packageFor()` lanza «Unregistered sprite» ante un nombre
desconocido. Se dibuja PRIMERO y se declara DESPUÉS, en el mismo commit. Lo caza
`scripts/check-adventure.cjs` (probado en negativo), pero no lo dejes llegar ahí.

Por eso el rastrillo vive hoy **sin la clave `sprite`**, y eso no es un descuido:
`sprites.icon()` devuelve null y el saco lo enseña por su nombre.

| Sprite | Estado | Qué dibujar |
|---|---|---|
| `rake` | **falta** | rastrillo viejo de mango de madera pulido y púas gastadas, del tamaño de un duende |
| semillas de hierba | usa `garden-seed-sack` | opcional: saquito propio para no confundirlo con las semillas del jardín humano |

Voz del arte de la casa: 16 bits, 2× con reducción integrada, fondo realmente
transparente, luz desde arriba a la izquierda. Ver `data/aventura/ART.md`.

Cuando exista:

```json
"rake": { "name": "rakeName", "description": "rakeDescription",
          "sprite": "rake", "max": 1, "usable": false, "reusable": true }
```

## A.10 Lo que falta de la Parte A: las recogidas

No se han colocado porque colocar cosas en el mundo es trabajo del Estudio y
porque el rastrillo no se puede pintar todavía. Patrón: recogida de una sola vez,
como el saco de semillas del seto humano. **Cuatro sitios, mismo commit:**

**a) La bandera**, al final del array `flags` de `catalog.json`:
`"rakeFound"`, `"grassSeedsFound"`.
*(Las banderas se guardan POR NOMBRE, no como bits posicionales
(`save.js`: `for (const key of catalog.flags)`), así que el orden aquí no es
crítico. El que SÍ lo es son los nodos de recurso: ver §B.2.)*

**b) El comportamiento**, en `data/aventura/behaviors/`:

```json
"woodland-rake": {
  "sprite": "rake", "label": "rakeName", "solid": [-0.5, -0.4, 1, 0.7],
  "hiddenWhen": { "flags": { "rakeFound": true } },
  "rules": [{ "effects": [
    { "type": "item", "item": "rake", "amount": 1 },
    { "type": "flag", "flag": "rakeFound" },
    { "type": "dialogue", "key": "rakeFound" },
    { "type": "sound", "key": "found" } ]}]
},
"woodland-grass-seeds": {
  "sprite": "garden-seed-sack", "label": "grassSeedName", "solid": [-0.7,-0.5,1.4,0.8],
  "hiddenWhen": { "flags": { "grassSeedsFound": true } },
  "rules": [{ "effects": [
    { "type": "item", "item": "grassSeed", "amount": 10 },
    { "type": "flag", "flag": "grassSeedsFound" },
    { "type": "dialogue", "key": "grassSeedsFound" },
    { "type": "sound", "key": "found" } ]}]
}
```

⛔ **`hiddenWhen` por BANDERA, nunca por inventario.** Una condición de inventario
es de ESTADO y vuelve a cero cuando gastas la cosa; una bandera es de HISTORIA.
Esto ya ha mordido una vez, ver §B.2.

**c) La entidad** en `data/aventura/scenes/{pantalla}.json`:
`{ "id": "woodland-rake", "behavior": "woodland-rake", "x": 00, "y": 00 }`

**d) La frase** en `data/aventura/locales/scenes/{pantalla}.json`, con sus **seis
idiomas** (el fichero no compone si falta uno).

Lo demás ya está escrito en `core.json`: `rakeName`, `rakeDescription`,
`grassSeedName`, `grassSeedDescription`, `buildSowGrass`, `communityToolRequired`,
`communityTooClose`, `communityProtected`.

## A.11 Lo que ya se puede hacer hoy

Todo menos los caminos, y en las cuatro pantallas enteras: vallitas (con la regla
de no calcar), bancos, mesas de tocón, flores, macetas de hoja, farolitas y la
piscinita.

---

# PARTE B — Arreglos y afinados del mundo

Cuatro cosas pequeñas que el dueño pidió el 17-sep. Son independientes entre sí y
se pueden implementar y comprobar primero, una vez autorizado el inicio. Forman
parte de la entrega completa: cerrarlas no sustituye el resto del encargo.

## B.1 El diálogo se cierra también con las flechas

Hoy, en `input.js`, mientras hay diálogo **solo** se atienden `enter`, `escape` y
espacio, y todo lo demás sale por un `return`. Las flechas y WASD no hacen nada.

Lo que hay que hacer: que una tecla de movimiento **cierre el diálogo Y mueva**,
no una cosa u otra.

⛔ Y esto no es una regla nueva, es aplicar al teclado una que la casa ya tiene
escrita para el ratón: *«Clic fuera del diálogo: cerrar y utilizar ese mismo clic
para caminar/interactuar»* (`docs/SHARED-FOREST.md`). Si el clic ya se aprovecha,
la flecha también.

Detalle: no consumir el evento (nada de `stopImmediatePropagation` en ese
camino), para que la misma pulsación llegue al control de movimiento. Y respetar
`event.repeat`, como ya hace el resto del bloque.

## B.2 Las setas: un fallo de verdad y su rediseño

**El fallo, reproducido y diagnosticado.** `behaviors/picnic.json` →
`picnic-mushroom`:

```json
"visibleWhen": { "maxItems": { "mushroom": 0, "skewer": 0 } }
```

La seta gorda se ve mientras no tengas NI seta NI brocheta. Entonces:

1. la coges → tienes `mushroom: 1` → desaparece ✔
2. cocinas la brocheta → la seta sale del saco, entra `skewer` → sigue oculta ✔
3. **le das la brocheta a Brizno** → sale `skewer` del saco → `mushroom: 0` y
   `skewer: 0` → **la seta gorda reaparece**, con `mushroomFound` puesto ✘

Es la lección del §A.10: **una condición de inventario es de ESTADO y una bandera
es de HISTORIA**, y aquí se usó la primera para decir lo segundo.

**El rediseño** (decisión del dueño), que además hace el fallo irrelevante porque
reaparecer pasa a ser lo CORRECTO:

- **Fuera la seta gorda.** `picnic-mushroom` y el uso de `giant-bolete`
  desaparecen. El maestro se queda en el arte (nunca se borra un maestro); el
  sprite lo poda el horneado solo, porque los paquetes se arman por contenido.
- **Las setas pasan a ser recolectable MÚLTIPLE, como los palos.** `mushroom`
  sube de `max: 1` a `max: 99`.
- **Hacen falta el cuchillo para recogerlas.** La regla ya está escrita en el
  comportamiento actual (`when: { items: { knife: 1 } }`) con su respuesta
  `skewerNeedKnife` si no lo llevas. Se reutiliza tal cual.
- **Con una basta para la brocheta**, y eso **ya funciona sin tocar nada**: la
  receta de la barbacoa pide `mushroom: 1, twig: 1, knife: 1` y consume una. Al
  ser contador, cualquier seta sirve.
- **En conjuntitos**, con formas, tamaños y colores distintos.

⛔ **Y NO HACE FALTA ARTE NUEVA PARA SALIR.** El atlas ya trae cinco sprites
usables hoy: `mushrooms`, `mushroom-red-pair`, `scarlet-mushrooms`,
`mushroom-bolete-leaning`, `mushroom`. Arte nueva solo añade variedad, no
desbloquea.

**Son nodos de recurso, no entidades sueltas.** La casa ya tiene el mecanismo
exacto (`resource-nodes.json` + `resources.js`): un bit por nodo y ciclo por
región, se va al recogerlo y renueva al ciclo siguiente. Los palos usan
`renewMs: 86400000` (24 h) y las hojas `120000` (2 min). **Para las setas:
`18000000` (5 h)**, el mismo ritmo que las conchas — una seta sale después de la
lluvia, no cada dos minutos, y así la brocheta es repetible sin ser gratis.

⛔ **AL AÑADIR NODOS, SE APILAN AL FINAL Y NO SE REORDENA NINGUNO.** Eso sí es un
bitset posicional por región, y reordenarlo le cambia el significado a lo que ya
tiene guardado la gente. Está escrito en `data/aventura/REFACTOR.md#recogibles-en-el-studio`.

**Y hay que releer las tres condiciones de `picnic.json` que hablan de setas**
(`"mushroom": 0` y `"mushroom": 1` en `visibleWhen`/`maxItems` alrededor de las
líneas 186, 228 y 298): fueron escritas cuando solo podía haber UNA seta en el
mundo y con un contador significan otra cosa.

## B.3 El camino se hace con un RASTRILLO — **YA HECHO**

Renombrado de `shovel` → `rake` aplicado el 17-sep-2026, limpio porque **no se
había desplegado nunca**: la clave del objeto, el `requires` de `forest-path`, los
textos `rakeName`/`rakeDescription` en los seis idiomas y la aserción de la prueba
de paridad. `npm test` en verde después.

Un rastrillo cuadra mejor con lo que el camino ES: no cavas un hoyo, allanas y
despejas la tierra. Y rima con sembrar hierba para deshacerlo.

**Lo único que queda es el arte** (§A.9): un rastrillo viejo, mango de madera
pulido y púas gastadas, del tamaño de un duende.

## B.4 Las flores se siembran y tardan una hora

Hoy `forest-flowers` aparece entera y al instante. El dueño quiere: **siembras →
sale un poco de tierra removida → a los 60 minutos sale la planta.** Y **semillas
de distinto tipo dan flores distintas**.

⛔ **Esto NO necesita ni estado nuevo en el servidor ni un cron.** Un objeto
comunitario ya guarda su `created_at` y ya viaja en el DTO como `createdAt`. El
cliente elige el sprite por la EDAD del objeto: menos de una hora, tierra; más,
la flor. El servidor es el dueño del reloj, así que no se puede falsear.

⛔ **Pero la edad se mide contra el reloj del SERVIDOR, no el del navegador.** Un
reloj de cliente puede ir mal o estar adelantado a propósito. La instantánea de
la zona tiene que traer su `now`, y el cliente calcula `now - createdAt`. *(El
pulso de presencia lo va a traer igualmente, ver §D.)*

**Semillas distintas → flores distintas.** El modelo de hoy tiene UN `cost` por
definición y varias `variants`, así que no hay forma de decir «esta variante
cuesta esta semilla». Dos salidas:

- (a) **una definición por flor**, cada una con su coste y su única variante ←
  **recomendada**: cero cambios de esquema, y la paleta enseña cada flor con su
  propia baldosa, que es mejor de usar (ves lo que plantas).
- (b) coste por variante en el esquema, con su validación en los dos motores.

**Arte que falta**: un parche de tierra removida. O sprite nuevo pequeño
(`tierra-removida`), o se pinta con el mismo pincel del suelo que usan los
caminos (`paint: "path"`, que no gasta sprite ninguno). La segunda es gratis y
probablemente suficiente.

**Y un detalle de sensación**: mientras es tierra, la pieza no es sólida
(`solid: false`, que `forest-flowers` ya tiene). Nadie tropieza con una semilla.

## B.5 Los 100 duendes: completos, y cargando solo lo que hace falta

> «Necesito los 100 en todas las poses. Se asigna al azar y el usuario puede
> cambiar. Si hay dos iguales NO pasa nada, es cuestión de gustos. Pero esos 100
> deben estar bien y completos, y sprites independientes, no todo en la misma
> imagen. Cargar siempre solo lo que hace falta.»
>
> «No quiero duendes de colores raros que no sean pieles de verdad, y la
> predominancia deben ser las pieles clásicas.»

**La decisión: 30 duendes elegibles, con las SIETE poses completas.**

⛔ **Y los 100 duendes que ya existen NO SE BORRAN.** Siguen siendo los vecinos del
bosque con sus 32 sprites de base, exactamente como hoy. Lo que se acota es la
lista de «puedes SER este», no el mundo: el bosque sigue teniendo sus cien
habitantes. El reparto del número está en §B.5.7.

### B.5.1 Lo que hay hoy, medido

**113 paquetes base** (`actor-N`, 32 sprites cada uno): trece del elenco fijo
(ids 0-12) y **cien avatares (ids 100-199)**, de `data/aventura/residents.json`
(20 familias × 5, 50 y 50 de cada género).

Y **las poses especiales las tiene UNA sola variante, la 0**:

| Paquete | Sprites | Rejilla | Peso | Variantes que lo tienen |
|---|---|---|---|---|
| `actor-N` **base** | **32** | 8 dir × (1 quieto + 3 de paso) | 55,3 KB | **113** |
| `actor-0-run` | 32 | 8 dir × 4 | 49,6 KB | **1** |
| `actor-0-row` | 32 | 8 dir × 4 (`boat-ascua-*`) | 152,2 KB | **1** |
| `actor-0-push` | 16 | **4 dir** × 4 | 29,9 KB | **1** |
| `actor-0-work` | 16 | **4 dir** × 4 | 30,3 KB | **1** |
| `actor-0-carried` | 16 | 8 dir × 2 | 21,5 KB | **1** |
| `actor-0-needs` | 8 | **sin dirección**: pee 0-3, poop 0-3 | 13,3 KB | **1** |
| `actor-0-discover` | 4 | **sin dirección**, 4 fases | 8,8 KB | **1** |
| `actor-0-bow` | 24 | 8 dir × 3 | 32,8 KB | **NADIE lo pide** |
| `actor-0-roll` | 32 | 8 dir × 3 + 8 de recuperar | 48,7 KB | **NADIE lo pide** |

El paso son cuatro fases con tres dibujos: la secuencia es `[1,2,3,2]` y el quieto
hace de pose 0.

### B.5.2 ⛔ El hallazgo: el duende por usuario NO EXISTE todavía

`renderer.js:187` pinta al jugador con **`characterFrame(0, ...)`**: la variante
está **cableada a 0**. Los cien avatares son los VECINOS, no tú.

Y hay `person-0-` escrito a mano en cinco sitios más, así que descablear el
renderer no basta: andarías con tu cara y cambiarías a la 0 al correr, empujar,
cocinar, cagar o cuando te llevara un gato.

| Fichero | Línea | Qué cablea |
|---|---|---|
| `renderer.js` | 187 | la variante del jugador |
| `characters.js` | 35, 39 | `push`, `run` |
| `presentation.js` | 51, 54 | `discover`, `work` |
| `self.js` | 168 | `pee`, `poop` |
| `cat-encounters.js` | 116, 375 | `carried` |
| `river-navigation.js` | 171 | **`boat-ascua-*`** |

⛔ **El remo es el peor**: `boat-ascua-{dir}-{fase}` es un sprite **COMPUESTO** de
barca y remero con el nombre de un duende dentro, así que **todo el mundo rema con
la cara de Ascua**. **Contrato corregido por el dueño (18-sep):** se separan
el casco vacío por dirección (**sin asiento ni remos**) y
`person-{V}-{dir}-row-{n}`: el duende sentado, pies hacia delante y **remos
incluidos en sus manos**. Las cuatro fases pertenecen al personaje; un casco
estático no necesita cuatro copias iguales.

- Cada variante añade solo remero + remos, nunca otra copia del barco.
- Cada barquita declara un anclaje invisible por dirección dentro de su hueco;
  es compatible con los remeros existentes sin generar combinaciones duende×barca.
- El borde frontal puede ser otra capa del mismo casco para ocultar piernas
  cuando corresponda, nunca un asiento inventado ni partes del personaje.
- En las ocho direcciones y cuatro fases se comprueban manos unidas a los remos,
  pies hacia delante, pelvis estable y pala lejana correctamente oculta.
- Primero se termina e integra Brezo alba, utilizable en el juego; después los
  demás **uno por uno**. No se espera a completar todo el elenco para integrarlo.

### B.5.3 La factura, con bytes reales

Por variante hay que añadir **124 sprites**, unos **203 KB**:

| | sprites | KB |
|---|---|---|
| run | 32 | 49,6 |
| row (remero y sus remos, sin casco) | 32 | ~50 |
| push | 16 | 29,9 |
| work | 16 | 30,3 |
| carried | 16 | 21,5 |
| needs | 8 | 13,3 |
| discover | 4 | 8,8 |
| **por variante** | **124** | **~203 KB** |

Y lo que eso suma según el tamaño del elenco elegible:

| Elenco | Sprites nuevos | Peso | Paquetes PNG | Artefacto |
|---|---|---|---|---|
| **30** ← **el acordado** | **3.720** | **6,1 MB** | 194 → 404 | 24 → **30 MB** |
| 60 | 7.440 | 12,2 MB | 194 → 614 | 24 → **36 MB** |
| 100 | 12.400 | 20,3 MB | 194 → 894 | 24 → **44 MB** |

⛔ **Y eso NO es lo que se descarga nadie.** Ver lo siguiente, que es el punto.

### B.5.4 Sprites independientes y solo lo que hace falta

El grano correcto es **(variante × pose) = un paquete = un fichero**, que es como
ya funciona hoy. Dentro de un paquete, sus 32 frames comparten un PNG, **y eso no
es "todo en la misma imagen": es el atlas haciendo su trabajo** — una petición y
una decodificación en vez de treinta y dos de los mismos píxeles. Lo que NO puede
pasar (y no pasa) es que los 100 duendes compartan una imagen.

**Qué se carga y cuándo:**

| | Cuándo |
|---|---|
| **Tu** base + run + needs + discover (127 KB) | al entrar |
| La **base** de cada variante que VES | al aparecer alguien en tu viewport |
| run / push / carried de otro | **bajo demanda**, cuando esa persona lo hace |
| row | solo navegando |
| work | solo al cocinar |

⛔ **Se sigue el VIEWPORT, no la pantalla.** El demonio ya manda solo los vecinos
que te caben en pantalla (§E.4); el cargador de sprites tiene que seguir la misma
regla. Diez personas visibles son **553 KB de bases**, no cien.

⛔ **Y mientras un paquete bajo demanda no ha llegado, se pinta la pose base.** Un
hueco es un duende que desaparece; la pose base es un duende que anda en vez de
correr durante 200 ms y no lo nota nadie.

### B.5.5 Tres cosas del motor que hay que rehacer, o esto no cabe

**1. El techo de bytes del build deja de significar nada.**
`check-adventure.cjs` exige hoy `spriteBytes < 10500000`. Con arte perezosa por
variante, **el total en disco deja de ser la magnitud interesante**: lo que hay
que acotar es **lo que UNA carga se descarga**. Ya existe la prueba que lo mide
(«precarga acotada: peor caso river-willows con sus tres vecinas más caras, 3748
KB»). Es esa la que hay que extender a los actores, no el total.

**2. ⛔ La caché de sprites tiene que acotarse por BYTES, no por número de
paquetes.** `sprites.js#prune()` guarda `max(12, keep.size + 2)` paquetes. Un
atlas de actor mide **1024×400, o sea 1,56 MB descomprimido en memoria**. Con 25
vecinos a la vista eso son **~42 MB de RGBA**, y con cien en una pantalla, 156 MB.
En un móvil eso es presión real. El tope tiene que ser un presupuesto de memoria,
y al pasarse se expulsa lo más lejano.

**3. El móvil empaqueta el artefacto entero** (hoy 23 MB; con esto, ~44 MB). Es
asumible para una app, pero hay que decidirlo a sabiendas: la alternativa es que
la app lleve un subconjunto y pida el resto, y eso **rompe el juego sin
conexión**, que hoy funciona. Yo lo dejaría entero.

### B.5.6 La regla de las pieles

⛔ **Pieles humanas de verdad. Ni una sola piel verde, azul, morada ni de fantasía.**

La buena noticia: **el elenco de hoy ya cumple**. Los 100 prompts de
`data/aventura/art/residents/catalog.json` dicen literalmente *«natural human skin
colour»*, y el reparto de tonos es este:

| Tono | Variantes |
|---|---|
| pale freckled / freckled light / fair peach / fair rosy | 50 |
| olive / warm tan / golden tan / copper tan | 50 |
| warm brown / warm medium brown / deep warm brown / dark brown | 60 |

*(Los tonos se combinan con edad y complexión, de ahí que sumen más de 100.)*

**La regla, escrita para que las 12.400 nuevas no se desvíen:**

1. Solo tonos humanos reales, el rango natural entero.
2. **Predominan los clásicos.** Nada de que los extremos estén
   sobrerrepresentados porque quedan más vistosos.
3. ⛔ **La piel de una variante es IDÉNTICA en sus 124 sprites.** Este es el riesgo
   de verdad al generar 124 dibujos del mismo personaje: que el mismo duende tenga
   una piel al andar y otra al remar. El tono, el pelo y la ropa de cada variante
   se fijan por escrito en su ficha y se generan **desde esa ficha**, no de memoria.
4. Lo exótico va en el **pelo, el gorro y la ropa**, que es donde la casa ya pone
   la variedad (20 familias con nombre de planta).

### B.5.7 Los 30 elegibles, y los 100 que se quedan de vecinos

**Elenco elegible: 30.** Reparto sobre las 20 familias de `residents.json`, que son
**de un solo género cada una** (10 masculinas y 10 femeninas):

| | |
|---|---|
| Una de **cada una de las 20 familias** | 10 + 10 |
| Una **segunda** en 5 familias masculinas y 5 femeninas | 5 + 5 |
| **Total** | **15 masculinos y 15 femeninos** |

Con eso las veinte familias siguen vivas con su nombre de planta y el equilibrio
queda exacto.

⛔ **LOS 100 QUE YA ESTÁN GENERADOS NO SE TOCAN.** Se quedan tal cual como vecinos
del bosque, con sus 32 sprites de base. No se borra ni un fichero, ni un maestro,
ni una entrada del catálogo. Los 30 elegibles son un SUBCONJUNTO de esos 100 al
que además se le dibujan las siete poses.

**Crecer después es gratis y encoger no**: con el respaldo por pose y el informe
de cobertura (§B.5.4), una variante sin su arte completa simplemente no aparece
todavía en el selector. Añadir la 31 mañana cuesta solo su arte; quitar una le
quita el duende a alguien que ya lo eligió.

**Y 30 mantiene acotado el riesgo que importa**, que no son los bytes sino la
consistencia de 124 dibujos del mismo personaje (§B.5.6 y §B.5.9): con 30
variantes son 210 hojas de pose, un número que una persona puede revisar.

### B.5.8 Los dos paquetes de acción que se retiran

Hay dos paquetes de acción de la variante 0 que **no los pide nadie** y que se
retiran. Se borra su declaración; **los maestros del arte no se borran nunca**
(regla de la casa: se retira la declaración, no la procedencia). Sin declaración
no se hornean y no viajan en el artefacto.

| Fichero | Qué |
|---|---|
| `data/aventura/assets/actor-0-roll.json` | borrar |
| `data/aventura/assets/actor-0-bow.json` | borrar |
| `data/aventura/art/cast/catalog.json` | quitar sus dos entradas de `sheets` |
| `scripts/review-mobility-art.php` | líneas 8 y 16: quitar sus ids y sus fases, o el script revienta |
| `scripts/check-ascua-browser.cjs` | línea 88 |
| `scripts/check-release-live.cjs` | línea 110 |

⛔ Las dos aserciones de los checks son NEGATIVAS (*«no está cargado»*) y
**seguirían pasando con el paquete borrado sin comprobar nada**. Se cambian por la
fuerte: **que el paquete no exista en el manifiesto**. Una comprobación que pasa
porque su sujeto desapareció es una comprobación apagada.

⛔ **Y la especificación de generación de las 30 variantes lista SIETE poses y no
nombra ninguna otra**: `run`, `row` (remero con remos, sin casco), `push`, `work`, `carried`,
`needs`, `discover`. Nombrar una pose en un encargo de arte es como se dibuja.

### B.5.9 ⛔ Los grids: que salgan consistentes

Es el riesgo de producción número uno con 210 hojas. **Buena noticia: el pipeline
ya resuelve la mitad solo**, y hay que saber cuál mitad.

**Lo que `scripts/prepare-adventure-cast.php` YA hace por ti**, midiendo los
píxeles de verdad de cada celda:

| | Cómo |
|---|---|
| **Centra** el personaje en su celda | `dx = anchor.x − anchoCelda·ratio/2` |
| **Le pone los pies en la línea de apoyo** | `dy = anchor.y − (fondo del dibujo)·ratio` |
| **Una sola escala por HOJA, nunca por celda** | `ratio = height / bodyHeight` — está comentado ahí: *«Never fit each arm/leg pose independently»* |
| **Revienta si una pose se sale del lienzo** | `throw "Registered pose clipped: $name"` |
| Canvas y ancla comunes del elenco | `canvas [48,48]`, `anchor [24,46]` |

O sea: **no hace falta que el generador clave la rejilla al píxel.** El horneado
registra cada celda. Lo que el generador SÍ tiene que respetar es lo siguiente, y
aquí es donde se rompe:

**1. ⛔ La escala de la hoja sale de la CELDA [0,0], y eso es una trampa.**
`bodyHeight` se mide en la primera celda. Si en la hoja de correr esa celda pilla
al duende a media zancada con una pierna estirada, su alto dibujado es mayor que
de pie → **la hoja entera se escala hacia abajo** → ese duende es más pequeño
corriendo que andando. **El arreglo ya existe en el pipeline: `reference`.** Toda
hoja de pose debe declarar `reference` apuntando a la hoja de ANDAR de su misma
variante, y así las siete poses toman prestada la escala del cuerpo de pie. Ya se
usaba para eso mismo en su día.

**2. ⛔ Los pies se registran por el FONDO del dibujo.** Correcto para estar de
pie, andar, correr, empujar, cocinar y agacharse. **Falso en cuanto algo cuelga
por debajo de los pies**: la barca, o al ir en la boca de un gato. Esas hojas
llevan su propio `canvas` y su propio `anchor`, como ya hacen hoy las dos que
tienen ese problema. Si una pose nueva mete una herramienta que toca el suelo,
mismo caso.

**3. ⛔ EL ORDEN DE LAS COLUMNAS ES EL ORDEN DE LAS DIRECCIONES**, y equivocarlo no
da ningún error: simplemente todo el mundo mira hacia donde no es. El orden es
fijo y no se negocia:

```
down · down-right · right · up-right · up · up-left · left · down-left
```

**4. Celdas iguales y margen generoso dentro de cada una.** El horneado recorta por
el contenido visible, así que un dibujo que toca el borde de su celda se
contamina con el de al lado. Los prompts de la casa ya lo piden («equal cells with
generous blank margins»); no se relaja.

**5. La basurilla se declara.** Un generador que deje motas sueltas necesita
`cleanFragments` en su hoja, como ya lo lleva la de correr.

**La comprobación que falta, y hay que escribirla.** Hoy
`scripts/check-adventure-crops.php` demuestra sobre una prueba sintética que el
horneado conserva el pie entre dos poses. Con 210 hojas reales hace falta un
**informe de consistencia sobre el elenco de verdad**: por cada variante, que el
alto del cuerpo y la línea del pie coincidan entre sus siete hojas dentro de una
tolerancia, y que griten las que no. Sin eso, un duende que mide dos píxeles menos
al remar no lo ve nadie hasta que alguien rema.

### B.5.10 El sorteo, el selector y lo que se aprende de él

**Al empezar se te asigna uno al azar.** Determinista por cuenta (mismo handle →
mismo duende), como ya se hace con los retratos de perfil. Se guarda en el
progreso de la cuenta y se cambia cuando quieras en el panel `YO`
(`#self-dialog`). Viaja en la presencia (§D), porque es lo que los demás ven.

**Dos personas con el mismo duende no es un problema** (decisión del dueño): es
cuestión de gustos, y no hace falta reservar ni excluir nada. Y como los 30 salen
de los 100 vecinos, puedes cruzarte contigo mismo paseando de NPC: con duplicados
permitidos eso deja de ser un fallo y pasa a ser el mundo.

⛔ **EL SELECTOR NO CATEGORIZA NADA** (decisión del dueño). Ni hombre ni mujer, ni
tono de piel, ni familia, ni ninguna otra etiqueta. **Se enseñan los 30 en
desorden y eliges el que te guste.** Punto. Sin pestañas, sin filtros, sin
secciones. Una rejilla y ya.

**Al crear la cuenta se le recuerda que puede elegir**, una vez y sin insistir.
Antes de eso ya está jugando con el que le tocó.

**Y por dentro sí llevan su sexo**, que es otra cosa y no se enseña nunca. Sirve
para una sola cosa:

⛔ **Si la persona elige un duende y NO ha declarado su sexo, se rellena
`users.gender` con el del duende.** Esa columna la lee el cron de retratos para
elegir el subgénero del avatar, y hoy, vacía, cae a un hash del handle. Con esto,
elegir tu duende te mejora el retrato sin haberte preguntado nada.

⛔ **Y el duende guarda `M`/`F` DIRECTAMENTE, el mismo alfabeto que la columna, para
que rellenar sea COPIAR y no traducir.** Hoy `data/aventura/residents.json` dice
`male`/`female`: se normaliza ahí, en el origen, una vez y para los 100. Un mapa
de equivalencias en cada uso es una cosa más que se puede desincronizar, y no
compra nada.

Tres reglas para que eso no se convierta en una suposición fea:

1. **Solo si está VACÍA.** Nunca se pisa lo que la persona haya declarado.
2. **Nunca se enseña como si lo hubiera dicho ella.** Es una inferencia nuestra, no
   una declaración suya, y sigue siendo corregible en su cuenta como siempre.
3. **Elegir un duende no es declarar nada.** Cualquiera puede querer ser un duende
   cualquiera; por eso el selector no lo etiqueta y por eso el dato se toma como
   una pista y no como una respuesta.

### B.5.11 Cómo quedó, y las cinco decisiones que costaron (18-sep-2026)

Lo de arriba es el encargo; esto es lo que hay construido y por qué, porque tres
de las decisiones no son obvias y una contradice lo que el apartado anterior daba
por hecho.

**1. El elenco ofrecido se DERIVA, no se escribe.** `data/aventura/world.php`
cruza las dos únicas cosas que definen a un protagonista —su remo MEDIDO a mano
(`player-art.json: rowingRigs`, lo único de autoría) y sus siete acciones
HORNEADAS (el manifiesto)— y de ahí sale `playerArt.enabledVariants`. Una lista
escrita a mano caduca: el dueño sube hojas de una en una y habría que acordarse
de tocar el JSON, o peor, se ofrecería un duende a medio dibujar. Si el duende de
la casa no está completo, **el mundo no compila**. Probado en negativo en
`scripts/check-playable-cast.cjs`: se le quita una hoja al manifiesto y el duende
sale del elenco sin editar un solo dato.

**2. La elección vive en la CUENTA, no en el viaje** (`game_accounts.avatar`,
migración 4239). La partida privada se sube a la nube y se puede restaurar desde
una copia de anteayer: con el duende dentro, recuperar un viaje te cambiaría la
cara sin haberlo pedido, y obligaría al contrato del servidor a validar como
progreso algo que no lo es. En el navegador hay un espejo (`magikitos.adventure.cast`),
del mismo tipo que recordar si entraste a pantalla completa.

**3. El sorteo ocurre al ENTRAR AL BOSQUE, no al leer la cuenta.** Parece un
detalle y es el caso normal: quien viene jugando sin cuenta y elige duende, al
crearla, lo primero que hace el navegador es leer la cuenta — y si esa lectura
sorteara, se encontraría una cara sorteada donde ya tenía una elegida. Leer
devuelve `null` mientras nadie haya dicho nada, y entonces es el navegador quien
cuenta lo que ya usaba. El sorteo es la red que garantiza que la presencia
siempre tiene un cuerpo, y solo hace falta ahí. Un sorteo **no** toca
`users.gender`: que te toque una cara no dice nada de ti. Solo lo rellena una
elección deliberada, y solo si estaba en `U`.

**4. Cambiarse de cara NO cuesta el asiento.** El ticket ya lleva el duende
dentro y el bosque lo aplica al **renovarlo** (`presence.cjs`, caso `renovar`),
así que elegir escribe en la cuenta y pide una renovación: soltar y volver a
entrar te devolvería al final de la cola de 100 por haberte cambiado de ropa. Y
las hojas del cuerpo nuevo se fijan sin volver a entrar a la pantalla
(`SceneDirector.rewear`), soltando las del anterior — probar cinco caras seguidas
no puede dejar cinco elencos clavados en memoria.

**5. El selector no pide treinta hojas de andar.** La hoja base de un duende son
1024x400 ya decodificados: treinta caras serían casi 50 MB y el presupuesto de
sprites se llevaría por delante la pantalla que se está jugando. Hay un paquete
propio de retratos (`scripts/prepare-cast-portraits.php`, derivado de las hojas ya
registradas, hoy 256x86) que el panel toma **en préstamo** mientras está abierto y
suelta al cerrarse. La rejilla no tiene categorías, ni pestañas, ni nombres: todos
a la vez y se elige por la cara.

**Lo que se hizo distinto del encargo, y por qué.** El apartado anterior pedía un
recordatorio de una sola vez al crear la cuenta. No está: el selector vive en el
MISMO panel que la puerta de la cuenta, dos dedos por debajo del formulario, y
lleva su propia línea permanente («Elige con quién quieres andar por el bosque»).
Un aviso de una sola vez solo se podría disparar bien por el camino del correo
—Google recarga la página y vuelve con el panel cerrado—, y un recordatorio que
existe para la mitad de la gente es peor que una línea que lee todo el mundo.

**Y una cosa que se arregló de paso, que era un fallo de verdad.** Durante un
despliegue conviven dos versiones: tu navegador tiene el arte de ayer y por el
socket puede llegar alguien con un duende que solo existe en el de hoy. Pedirle
ese paquete al almacén revienta —es un sprite que ese manifiesto no registra— y
lo hace DENTRO del bucle de pintado, así que un desconocido tumbaba el bosque
entero de quien no hubiera recargado. Ahora el duende de un extraño se pasa por el
elenco de la release antes de dibujarlo (`ForestPeople`): sigue estando, en su
sitio y con su nombre, y solo cambia la cara.

---

# PARTE C — La caca-mensaje

> «Quiero que las cacas que hacen los duendes puedan servir para dejar un
> mensaje: se escribe con un pergamino y un bolígrafo, se agarra un palo y se
> pincha en la caca. Duran 24 horas y el que pase lo puede leer.»

## C.1 Media idea ya está construida

Del catálogo de hoy:

```json
"needs": {
  "hours":  { "pee": [6, 10], "poop": [8, 16] },
  "traces": { "max": 48, "peeSeconds": 300, "poopSeconds": 86400 }
}
```

- **La caca ya dura exactamente 24 horas.** 86.400 segundos. Ya se pinta en el
  suelo (`self.js#drawGround`), ya se desvanece en los últimos 30 segundos, ya
  hay tope de 48. Lo único que le falta es **ser compartida** (hoy vive en la
  partida local, `game.state.traces`) y **llevar texto**.
- **El ritmo de publicación lo marca la necesidad**, cada **8-16 horas
  reales**. Ese límite es diegético y no hay que inventar otro gesto. Para los
  mensajes compartidos, el servidor debe hacer cumplir el intervalo y una sola
  publicación por deposición: un temporizador enviado por el navegador no es
  una protección antispam. Esto valida la acción, no lo que dice el texto.
- **El palo ya se gasta.** `twig` ya es contador, ya hay doce nodos estables y ya
  se consume en recetas y en vallas.
- **Pergamino y bolígrafo son exactamente el rastrillo**: objetos permanentes que
  se EXIGEN y no se gastan (`requires`, `reusable`, `max: 1`). Cero conceptos
  nuevos en el servidor.
- **Cagar ya cuesta una hoja** (`needs.leafItem`), así que el bucle ya tiene su
  consumible.

## C.2 El gesto

```
tienes ganas  →  cagas (gasta 1 hoja, como siempre)
              →  si llevas pergamino + bolígrafo + palo:  «dejar un mensaje»
              →  escribes  →  gasta 1 palo  →  se publica al momento, dura 24 h
```

⛔ **El pergamino se clava en TU caca recién hecha, no en la de otro.** Con eso la
cosa se cierra sola: un mensaje por deposición, sin hilos ni función de respuesta.
Es **«sin chat» por construcción y no por norma**. Si se pudiera clavar en la
caca de otro nacen las conversaciones y has vuelto al chat por la puerta de
atrás.

## C.3 El radio

«Que no se llene de mierda»: tiene que haber un radio libre alrededor de cada
mensaje. Las cifras, para que la decisión sea concreta (empaquetado hexagonal
sobre las cuatro pantallas construibles, 71.424 tiles²):

| Separación mínima | Mensajes a la vez en el bosque (144×112) | En las cuatro pantallas |
|---|---|---|
| **50 tiles** | ~7 | **~33** |
| 30 tiles | ~21 | ~95 |
| 20 tiles | ~46 | ~210 |

**Empezar estricto (50).** Aflojar después no duele; apretar después deja
mensajes huérfanos. Con 50, cada mensaje es un hito al que caminas.

⛔ Y el motivo del rechazo **ya existe con su frase en seis idiomas**:
`too_close` → `communityTooClose`. La regla de vecindad de la Parte A es
literalmente «no dos del mismo tipo a menos de N», y un mensaje es un punto, o
sea el caso fácil.

## C.4 Dónde vive

**En MariaDB**, tabla propia, y ahí sí la quieres:

- dura 24 h pero tiene que sobrevivir a un reinicio (una caca en memoria que se
  pierde al reiniciar el demonio sería un mensaje que alguien escribió y nadie
  leyó);
- lleva firma, y la vas a querer ver y borrar desde el panel;
- con la vejiga de 8-16 h y tope de 100 plazas, la tabla vive con **unos pocos
  miles de filas**, con índice por caducidad. No es nada.

Columnas mínimas: `id`, `zone`, `x`, `y`, `author_id`, `text`, `created_at`,
`expires_at`. Barrido con `dbSweepOld()`, que ya existe. **No hay `verdict_json`
ni estados de aprobación, cola de revisión o veredicto automático.**

## C.5 Publicación directa y moderación manual

**Decisión del dueño: es texto del usuario y puede escribir lo que quiera, en
el idioma que quiera. El mensaje se publica al momento, sin verificar su
contenido ni exigir que sea verdadero, correcto o apropiado.** No hay
juez LLM, filtro de palabras, traducción obligatoria ni aprobación previa, tampoco
manual. No se reutiliza la cola del diccionario ni se llama a ningún servicio de
moderación. No existe el pergamino pendiente de aprobación.

El texto se conserva tal como lo escribe el usuario: no se corrige, reescribe,
traduce ni se somete a análisis de significado para decidir si se publica. El
idioma del mensaje es independiente del idioma de la interfaz del juego.
No hay una llamada de verificación de contenido en el envío ni un trabajo
automático posterior que lo puntúe, lo apruebe o lo retire. Tampoco hay una lista
de idiomas permitidos ni una comprobación de veracidad: el texto es del usuario,
no una aportación que deba verificar el juego.

**El dueño los leerá y moderará después de publicarse.** El panel debe permitir
ver los mensajes con su autor, retirar un mensaje y banear al responsable. Los
baneos se hacen cumplir en servidor, no solo ocultando botones en el cliente.
Todos los mensajes caducan a las 24 horas aunque nadie los haya revisado; la
caducidad no convierte el contenido en revisado ni garantiza que sea adecuado.

**Texto libre no significa código ejecutable.** Se guarda y representa como
texto plano, nunca como HTML. Se mantienen los controles técnicos de identidad,
tamaño de petición, frecuencia, distancia, autoría y consumibles. Ninguno de
ellos juzga el idioma, las palabras o el significado del mensaje.

## C.6 La fricción honesta

**No puedes elegir cuándo escribir**: la necesidad manda. Si tienes algo que
decir y no te apetece, esperas. Eso es a la vez el chiste y el limitador, y por
eso se acepta. Pero hay que decirlo en la copia para que no se lea como un fallo.

---

# PARTE D — El bosque vivo: presencia, 100 plazas y espectadores

## D.1 Por qué 100 y no «los que quepan»

**El tope no es una limitación técnica, es el producto.** Cien personas con buena
reputación haciendo cosas buenas valen más que mil pasando por ahí. Y cien caben
de verdad en el mapa: repartidas por cuatro pantallas son ~25 por pantalla, que
es un sitio concurrido, no una aglomeración.

Contexto para calibrar: el diccionario, que es lo más visitado de la casa, vio
**949 dispositivos en un día entero**. 100 CONCURRENTES es mucho más de lo que se
va a tocar en bastante tiempo. **El tope no va a morder pronto, y no pasa nada:
su trabajo es ser una promesa, no un regulador.**

Cuando muerda, la puerta será la reputación: `users.setines_balance` ya existe y
el libro mayor también, así que un umbral creciente es un `WHERE` en el saludo.

## D.2 El espectador ES la cola

⛔ **No hay sala de espera.** Entras siempre, y entras de espectador: oyes la
música, paseas el mapa entero, lees las cacas, ves a la gente construir en vivo.
Lo que no puedes es que te vean, ni tocar nada. Cuando se libera una plaza, **te
materializas donde estás**.

Eso es mucho mejor que un número en una pantalla, es del bosque (eres un fantasma
hasta que el bosque te hace sitio) y es el mejor embudo posible: ves el sitio
vivo, quieres entrar, y la puerta es la reputación.

**Y el movimiento del espectador ya está hecho**: el juego hoy funciona entero en
cliente. Un espectador es literalmente el juego de ahora leyendo el pulso de los
demás. Cero trabajo.

| | Espectador | Jugador |
|---|---|---|
| Ver el mapa, la música, las aventuras | ✔ | ✔ |
| Leer cacas-mensaje | ✔ | ✔ |
| Ver a los demás | ✔ | ✔ |
| **Que te vean** | ✘ | ✔ |
| Construir, empujar, dejar mensajes | ✘ | ✔ |

⛔ **Los espectadores NO están topados, y eso hay que sostenerlo.** Las 100 plazas
protegen la escritura, no la lectura. Dos mitigaciones, por orden:

1. **Sondean más despacio** (cada 2-3 s). Están mirando, no interactuando.
2. Si algún día se notan: **el pulso de cada pantalla es un fichero estático que
   sirve Apache sin pasar por PHP** (~0,1 ms). Escriben los 100 jugadores por el
   demonio; leen todos de un fichero. Con eso son ilimitados en esta caja.

⛔ Si ese fichero acaba siendo un enlace desde `public/` a `/dev/shm`, es
**exactamente** el patrón del volumen de media con su misma trampa: git no puede
tener NADA rastreado ahí dentro o el `git reset --hard` del despliegue se lleva
el enlace por delante. Ver §F.4.

## D.3 Cuándo se considera que alguien salió: tres relojes, no uno

| Reloj | Valor | Qué significa |
|---|---|---|
| **Visto** | 10-15 s sin latido | se te ha ido la conexión |
| **Gracia** | ~60 s | te guarda la plaza ante un corte de conexión, solo mientras el mismo proceso servidor siga vivo |
| **Inactividad** | 10-15 min sin hacer NADA | te baja a espectador, con aviso antes |

⛔ **El tercero es el que casi nadie pone y el que de verdad importa.** Con 100
plazas, el modo de fallo no es la gente que se va: es la que deja la pestaña
abierta y se va a cenar. Sin ese reloj, a la semana tienes 40 plazas ocupadas por
nadie.

⛔ **Y no te fíes del aviso al cerrar la pestaña.** Se pierde la mitad de las
veces; está documentado en la propia casa. El cierre limpio libera la plaza al
instante *cuando llega*, pero la verdad la dicen los relojes.

Al liberarse una plaza, se materializa el espectador que más lleva esperando (o
el de más setines, cuando entre la reputación).

**Un reinicio del servidor es distinto de un corte de conexión.** Se vacían las
plazas y la cola; al reconectar, todos entran por una cola nueva. No se conserva
prioridad por haber estado dentro ni se restaura la gracia anterior. No se
persisten reservas ni se crean tickets especiales para recuperar una plaza.
Los reinicios son ocasionales: no se añade un mecanismo de recuperación de
turnos ni de continuidad de presencia entre procesos. Esto no borra las partidas,
las construcciones ni los mensajes que todavía no hayan caducado.
El comportamiento esperado es simplemente reiniciar, reconectar y admitir por
orden de llegada a la cola nueva. No hay que hacer invisible el reinicio ni
añadir colas duraderas, reconstrucción de turnos o traspaso de plazas entre
procesos: empezar de nuevo es lo esperado.

## D.4 Los NPC ceden el sitio

**No se quitan.** Con tope de 100 y el tráfico de hoy, lo normal va a ser que haya
cuatro personas en el bosque, no cien — y un bosque vacío **y además** sin
vecinos está más muerto que uno con vecinos. Los 100 residentes son lo que
sostiene la sensación de mundo habitado cuando no hay nadie.

Lo que hacen es **ceder**: cuantas más personas reales hay en una pantalla, menos
vecinos activos. El sistema ambiental ya tiene el tope de tres activos en tareas
y una ruta cada medio segundo, así que **es mover un número, no quitar cien
personajes ya dibujados**.

Regla sugerida: `vecinos_activos = clamp(3 - floor(personas_en_pantalla / 3), 0, 3)`.
Con 0-2 personas, tres vecinos. Con 9 o más, ninguno.

## D.5 Las aventuras siguen siendo de cada uno

No hay nada que tocar: el progreso, el inventario y los retos ya son privados por
cuenta, con su guardado en la nube y su cuenta de materiales. **Lo compartido es
el SITIO, no la partida.** Que veas a alguien encender la barbacoa no te la
enciende a ti.

---

# PARTE E — El demonio

## E.1 Por qué existe (y por qué no bastaba un sondeo)

Con 100 plazas y 1000 ms de latencia, un sondeo HTTP habría bastado para
**mirar**. Lo que no puede hacer un sondeo es **arbitrar**:

> «Si uno empuja una caja y el otro la empuja en el lado contrario, no se mueven.»

Eso no es eficiencia, es **autoridad**: un objeto compartido necesita un único
dueño que sume las dos fuerzas en un tick y decida. Un sondeo a 1 Hz haría que la
caja fuera a tirones de un segundo. **Por eso se hace el demonio**, y por eso la
decisión no es de pereza ni de ahorro.

## E.2 Dónde vive y en qué

| | |
|---|---|
| Runtime | **Node 22.23.1, ya instalado** en la caja |
| Repo | `magikitos` (**el privado**) — es AUTORIDAD, y la autoridad vive donde vive `community.php` |
| Directorio | `bosque-vivo/` en la raíz del repo web |
| Dependencia | **`ws`, fijada y COMMITEADA** (no tiene dependencias propias) |
| Puerto | `127.0.0.1:47850`, **nunca expuesto** |
| Delante | Apache con `proxy_wstunnel` (**ya cargado**) bajo `wss://magikitos.com/bosque` |
| Usuario | `magikitos` (el del proyecto), nunca root |

⛔ **`ws` se commitea en vez de instalarse.** Así el despliegue sigue siendo
`git reset --hard` y nada más: ni `npm ci`, ni un `node_modules` que pueda quedar
a medias, ni un paso nuevo que pueda fallar en producción. Es la misma doctrina
que `composer.lock` en git.

⛔ **Y el contrato del protocolo se espeja en el repo del juego**, exactamente
como ya se hace con `docs/world-api.openapi.json`, con su comprobación de que los
dos ficheros son idénticos. El cliente vive en un repo y el servidor en otro: sin
el espejo, se separan.

## E.3 El reparto de autoridad

Esto es lo más importante del diseño y hay que respetarlo al pie de la letra:

| Qué | Quién manda | Por qué |
|---|---|---|
| **Tu propio duende** | el CLIENTE, con revisión del servidor | no hay nada que arbitrar: es tu cuerpo. Ya se mueve en local con su colisión |
| **Objetos compartidos** (cajas, macetas empujables) | el SERVIDOR | dos personas pueden querer cosas contrarias |
| **Construcciones** | MariaDB, como ya | tienen que sobrevivir y llevar firma |
| **Cacas-mensaje** | MariaDB, como ya | ídem |

**Tu cuerpo, con red de seguridad**: el servidor comprueba que te has movido a una
velocidad plausible. Las cifras ya están: **72/190 px/s a pie (andar/correr)** y
**82/205 remando**, antes de corrientes. Un salto imposible se descarta y se te
devuelve a la última posición buena. Es barato y quita el 99% de las trampas.

**Los objetos compartidos van por INTENCIÓN, nunca por posición**: el cliente
manda «empujo hacia el este desde aquí», el servidor suma las intenciones del
tick y aplica el resultado. Dos contrarias se anulan y la caja no se mueve. **Si
el cliente mandara posiciones, el último en hablar ganaría y la caja daría
saltos.**

## E.4 Ritmos

| | Frecuencia | Por qué |
|---|---|---|
| Tick de objetos compartidos | **20 Hz** (50 ms) | es lo que hace que empujar se sienta como empujar |
| Difusión de presencia | **10 Hz** | el cliente interpola: a 60 fps se ve fluido igual |
| Latido de cliente | cada 5 s | para los tres relojes de §D.3 |
| Volcado a MariaDB | cada 10 s si hay cambios | y siempre al apagar |

Coste medido a ojo con 100 jugadores, 10 vecinos visibles y ~16 B por vecino:
**~160 KB/s en total**. Nada.

⛔ **Solo se manda lo que te cabe en pantalla.** El reparto es O(N × vecinos), no
O(N²): en un mapa de 144×112, ves diez personas, no cien. Sin ese recorte, el
coste se dispara al cuadrado y el tope de 100 deja de salvarte.

## E.5 Que sobreviva a los reinicios

- `Restart=always` en el unit.
- **Lo que importa se persiste**: posiciones de objetos compartidos → MariaDB cada
  10 s si están sucias y **siempre en el apagado ordenado** (`SIGTERM` → volcar →
  salir). Al arrancar se cargan de MariaDB.
- **La presencia, las plazas y la cola NO se persisten**: tras un reinicio no hay
  nadie conectado y se empieza una cola nueva.
- El cliente **reconecta solo**, con espera creciente y tope. Si el proceso sigue
  vivo, se aplica la gracia de 60 s ante un corte de conexión (§D.3). **Si hubo
  reinicio, vuelve a entrar por la cola nueva, sin reserva de su plaza anterior.**

⛔ **Y si el demonio está caído, el juego SIGUE FUNCIONANDO.** El artefacto es
estático, la aventura es de un jugador y la construcción va por PHP. Sin socket
estás solo en el bosque y no falla nada más. Eso sale gratis por cómo está
montado y **hay que mantenerlo así**: nada del juego de un jugador puede depender
del demonio.

## E.6 Versiones: el problema que nadie presupuesta

El artefacto es **inmutable y con puntero**, y la app móvil lleva **su propia
copia fijada**. Así que dos personas con releases distintas en la misma sala es un
caso real, no teórico.

- El saludo lleva **versión de protocolo**, no de release.
- El demonio declara un **rango soportado**.
- Un cliente fuera de rango recibe un cierre limpio con motivo, y el juego le dice
  **«recarga para volver al bosque»** en vez de desincronizarse en silencio.
- El protocolo se versiona **solo cuando cambia de forma**, no en cada despliegue,
  o esto se vuelve un infierno.

## E.7 Frenos

- Una conexión por sesión; una sesión por cuenta.
- Tope de mensajes por segundo y por conexión (las intenciones de empuje son lo
  único de alta frecuencia).
- El saludo valida contra la sesión de la web, que ya existe (Bearer).
- Rechazo de cargas grandes, y cierre de conexiones que no laten.

## E.8 El saludo: cómo entra alguien, y el protocolo

⛔ **El demonio NO habla con MariaDB para saber quién eres, y eso no es pereza: es
que un proceso alcanzable desde internet con credenciales de base de datos es un
radio de daño mucho mayor.** Además obligaría a meterle un driver, y la decisión
de §E.2 es que su única dependencia sea `ws`, commiteada y sin dependencias
propias.

**Cómo se resuelve: PHP acuña un TICKET FIRMADO y el demonio solo lo verifica.**

1. El cliente, que ya tiene su sesión de la web (Bearer), pide un ticket a un
   endpoint normal de PHP.
2. PHP valida la sesión como siempre y devuelve un ticket **firmado con HMAC** y de
   **vida corta** (minutos), que lleva dentro lo que el demonio necesita: id de
   la persona, handle, nombre, **su duende** y sus setines (para la puerta de
   reputación de §D.1).
3. El demonio lo verifica con el secreto compartido — cuatro líneas con el
   `crypto` que Node ya trae — y **no consulta nada a nadie**.

Así **el ticket ES la identidad**: el demonio arranca sin lecturas, sin
credenciales de base y sin poder ser un camino hacia ella. El precio es que el
ticket caduca y hay que renovarlo, y que cerrar sesión no expulsa al instante:
expira. Con minutos de vida, eso es aceptable.

**Los mensajes, en forma mínima** (el contrato exacto se espeja en los dos repos,
§E.2):

| Sentido | Mensaje | Lleva |
|---|---|---|
| → | `hola` | ticket, versión de protocolo, pantalla |
| ← | `bienvenido` | si eres **jugador o espectador**, tu id, y **`ahora`** (el reloj del servidor) |
| → | `estoy` | x, y, dirección, pose · **10 Hz** |
| ← | `vecinos` | los que te caben en pantalla, con su duende · **10 Hz** |
| → | `empujo` | objeto y dirección — **una INTENCIÓN, nunca una posición** (§E.3) |
| ← | `objetos` | posiciones de los compartidos · **20 Hz cuando cambian** |
| ← | `zona` | la revisión de construcción, para refrescar la instantánea |
| ← | `plaza` | te has materializado: pasas de espectador a jugador |
| → | `latido` | cada 5 s (los tres relojes de §D.3 y el corte de Cloudflare de §F.2) |
| ← | `adios` | con motivo: lleno, versión vieja, reinicio, inactividad |

⛔ **El `ahora` del `bienvenido` no es decorativo**: es el reloj contra el que se
mide la edad de una flor sembrada (§B.4). El del navegador puede ir adelantado a
propósito.

## E.9 Dónde vive la cuenta de las 100 plazas

**En la memoria del demonio, y en ningún sitio más.** Es el mismo razonamiento que
las posiciones: tras un reinicio no hay nadie conectado, así que no hay nada que
recordar. Al levantarse, todo el mundo reconecta y las plazas se reparten de nuevo
**por una cola nueva**, en orden de admisión. Quien estaba dentro no tiene una
reserva ni prioridad anterior: la gracia de 60 s solo sirve dentro de la misma
ejecución del demonio. Nada de persistir o reconstruir la cola tras reiniciar.

---

# PARTE F — El VPS: qué tocar y qué NO

⛔ **En esa caja viven DOCE proyectos de gente distinta.** Nada de lo que hagas
puede tumbar a los demás. Todo lo de esta sección está medido el 17-sep-2026.

## F.1 La caja

| | |
|---|---|
| Proveedor / SO | Hetzner Cloud · AlmaLinux 9.7 |
| Recursos | **4 vCPU · 15,3 GiB RAM · 151 GB disco + volumen de 118 GB** |
| **Swap** | **CERO** ⛔ |
| Web | Apache 2.4.62 + **un pool PHP-FPM 8.1 por usuario** (sockets Unix) |
| Panel de hosting | Virtualmin / Webmin (gestiona vhosts, usuarios, SSL) |
| Base | MariaDB 10.5.29, **solo en loopback** |
| `/dev/shm` | **7,5 GB, vacío** |
| Node | **22.23.1 ya instalado** |
| Apache | `proxy_wstunnel` **ya cargado** · `MaxRequestWorkers 1024` · `ServerLimit 16` |
| Pool de magikitos | **`pm.max_children = 32`** |
| `ulimit -n` | **1024** ⛔ |
| Delante | Cloudflare (proxy activo en magikitos.com) |
| SSH | `ssh my-vps`, entra como root |

## F.2 Lo que hay que tocar para el demonio

```ini
# /etc/systemd/system/bosque-vivo.service
[Service]
User=magikitos
LimitNOFILE=65535      # ⛔ el ulimit del sistema son 1024: te quedas
                       #    en ~1000 conexiones sin enterarte de por qué
MemoryMax=512M         # ⛔ NO HAY SWAP: un proceso que gotee no se
                       #    ralentiza, mata a otro
Restart=always
RestartSec=2
```

Y en el vhost de magikitos (por Virtualmin o por `.htaccess`, **nunca editando
`/etc/httpd/conf/httpd.conf` a mano**, que Virtualmin lo regenera):

```apache
ProxyPass        /bosque  ws://127.0.0.1:47850/  upgrade=websocket
ProxyPassReverse /bosque  ws://127.0.0.1:47850/
```

⛔ **No se abre ni un puerto en firewalld.** El demonio escucha en `127.0.0.1` y
sale por el 443 de siempre. Tocar firewalld es tocar la seguridad de doce
proyectos.

⛔ **Cloudflare corta un WebSocket ocioso alrededor de los 100 segundos.** Latido
cada 30 s, en los dos sentidos. Sin eso, quien se queda quieto se cae cada minuto
y medio y no sabes por qué.

## F.3 Lo que NO se toca

| | Por qué |
|---|---|
| `/etc/httpd/conf/httpd.conf` | lo regenera Virtualmin |
| `/etc/fstab` | la línea del volumen es crítica para la media de la comunidad |
| `/usr/local/bin/vps-*.sh`, `/etc/sudoers.d/alvarofranz-panel` | la fuente de verdad es `~/development/vps-panel`; se despliegan con `git pull && bash scripts/install.sh` |
| Cualquier `.env`, `bashy/config-*.sh`, `includes/db-connection.php`, `vps-panel/config.php` | credenciales |
| firewalld | seguridad compartida |
| Los puertos 10000-10100 y 20000 | Webmin/Usermin, abiertos a propósito |
| `vendor/wp-plugins/` de magikitos | **parece basura y NO lo es**: son los plugins de WordPress de Packlink que Alvaro guarda como referencia de la API |

## F.4 La regla de oro del volumen (aplica al fichero de presencia)

En producción, cada directorio de media comunitaria es un **symlink** al volumen
Hetzner. El despliegue hace `git reset --hard`, que **restaura todo fichero
rastreado**, y al restaurar uno que cae dentro de un directorio enlazado **git
crea el directorio de verdad y se lleva el enlace por delante**. Desde ese
instante lo que se sube va al volumen y lo que se sirve sale del repo: 404 en
todo lo nuevo, sin un error en ningún log. **Mordió dos veces.**

Si el pulso de presencia acaba siendo un enlace desde `public/` a `/dev/shm`, le
aplica lo mismo: `git rm --cached`, entrada en `.gitignore`, y solo entonces el
enlace. Y añadirlo a la lista `MEDIA_ENLAZADA` del guardián de despliegue.

## F.5 Lo que ya se hizo hoy

**El buffer pool de InnoDB** (`/etc/my.cnf.d/zz-innodb.cnf`, patrón `zz-` para
ganar por orden alfabético, como `zz-bind-loopback.cnf`):

| | Antes | Después |
|---|---|---|
| `innodb_buffer_pool_size` | **sin poner → 128 MB** | **2 GiB** |
| `key_buffer_size` | 384 MB | 32 MB |
| `query_cache_type` | **ON** (deprecado, mutex global) | OFF |

Medido antes de decidir: **InnoDB 3,96 GB, MyISAM 0,02 GB**. O sea 384 MB
reservados para 20 MB de datos, y 128 MB de pool para 3,96 GB. La base de
producción de magikitos son 1,9 GB (de los cuales 793 MB son los vectores del
expressionario, que solo lee un cron), así que **2 GB la cubren entera**. Más
sería cachear la base de DEV.

Verificado sin credenciales, en el log de arranque:
`InnoDB: Initializing buffer pool, total size = 2147483648`, `ready for
connections`, **cero `[ERROR]`**, los 13 vhosts respondiendo igual que antes y
tres páginas reales servidas por PHP→MariaDB.

---

# PARTE G — El despliegue

## G.0 La instalación inicial, que se hace UNA vez

Antes de que ningún despliegue tenga sentido, esto hay que montarlo a mano en la
caja. No lo hace el panel y no está en ningún script todavía.

1. **El unit de systemd** de §F.2 en `/etc/systemd/system/bosque-vivo.service`,
   con su `User=magikitos`, su `LimitNOFILE=65535` y su `MemoryMax=`.
   `systemctl daemon-reload && systemctl enable --now bosque-vivo`.
2. **El `ProxyPass` con `upgrade=websocket`** de §F.2 en el vhost de magikitos.
   ⛔ **Por Virtualmin o por el `.htaccess` del proyecto, NUNCA editando
   `/etc/httpd/conf/httpd.conf`**, que Virtualmin lo regenera y se lleva el cambio.
3. **El secreto compartido del ticket** (§E.8) en el `.env` del proyecto, que es de
   donde lo leen las dos partes.
4. **Comprobar la cadena entera, no solo que el proceso vive**: que un
   `Upgrade: websocket` llega desde fuera, **a través de Cloudflare**, hasta el
   demonio. Es donde puede fallar en silencio, y donde el latido de 30 s de §F.2
   deja de ser opcional.
5. **No se abre ni un puerto en firewalld.** Si hace falta abrirlo, algo está mal
   montado: el demonio escucha en `127.0.0.1`.

## G.1 Cómo es hoy

El panel (`alvarofranz.com`) llama a `vps-deploy.sh` como root, en este orden:

```
dump → git fetch → pre-flight del composer.lock → git reset --hard
     → chown -RP → composer install → vaciar /cache → purga de Cloudflare
```

⛔ La caché local se vacía **DESPUÉS** de composer, a propósito, y `composer` es
`install` y no `update` porque `composer.lock` está en git. No lo reordenes.

El juego va aparte: artefacto inmutable por checksum, `tools/install-release.cjs
--stage-only|--activate`, y `public/game/current.json` (que SÍ viaja en git) fija
cuál está activo.

## G.2 Qué le falta para un proceso permanente

Un `git reset --hard` no reinicia un demonio. Hace falta un gancho.

**Recomendado: un hook de post-despliegue por proyecto en `vps-panel`.** Si el
proyecto tiene `scripts/post-deploy.sh`, el panel lo ejecuta **como el usuario del
proyecto** (nunca root) al final del despliegue. Es un cambio acotado en
`vps-panel`, sirve para cualquier proyecto futuro y deja el reinicio donde vive el
código que lo necesita.

*Alternativa sin tocar el panel*: un cron de un minuto que compare el SHA del
árbol con el del proceso vivo y reinicie si difieren. Más robusto (funciona se
despliegue como se despliegue) pero hasta 60 s de desfase.

## G.3 El reinicio tiene que ser ordenado

1. `SIGTERM` → el demonio deja de aceptar conexiones,
2. vuelca a MariaDB lo que esté sucio,
3. manda a los clientes un cierre con motivo «vuelvo en un segundo»,
4. sale; systemd lo levanta.

El cliente reconecta solo y **entra en la cola nueva** (§D.3, §E.9). Reiniciar
vacía las plazas y la cola; no se promete conservar el puesto anterior. Lo que
sí se conserva es el progreso personal y el mundo persistente. Un reinicio
ocasional es aceptable y no necesita un sistema de recuperación de reservas.

## G.4 El desfase de versiones

Entre que se activa una release nueva y que la gente recarga, hay clientes viejos
conectados. Por eso la negociación de §E.6 **no es opcional**. Y por eso el
protocolo se versiona solo cuando cambia de forma: si subes la versión en cada
despliegue, echas a todo el mundo cada vez.

## G.5 Publicar la Parte A: el runbook, en orden

⛔ **El orden NO es negociable, y la razón es que la autoridad y el contrato tienen
que cambiar A LA VEZ.** El `community.php` nuevo lee `bounds`/`terrain`/
`accessGroups` y el viejo leía `editable`/`access`: con cualquiera de los dos
desparejado, construir se rompe en TODAS las pantallas, también en la que ya
funcionaba. La forma de que la ventana sea CERO es que el puntero y el PHP viajen
en el mismo despliegue.

1. **Comprobar y construir**, en el repo del juego:
   `npm test` → `npm run build`. Anota el ID de la release.
2. **Commit y push del repo del juego**, desde su propio directorio.
   ⛔ Nunca resolver un push del repo público contra el privado.
3. **Estacionar el artefacto** en el VPS, sin tocar el puntero:
   ```sh
   node install-release.cjs /ruta/staging/ID /home/magikitos/magikitos --stage-only
   ```
   ⛔ **Desde un Mac, el archivo se crea con
   `COPYFILE_DISABLE=1 tar --no-xattrs --no-mac-metadata`**: los ficheros de
   Finder no son arte del juego y el instalador rechaza el archivo entero si los
   encuentra.
4. **Aplicar las migraciones**, primero en el clon
   (`dev-migrate magikitos_dev migrations/<f>.sql`) y luego en producción por el
   panel: **4236**, **4237**, **4238** y **4239**, en ese orden y **antes de activar
   el puntero**, que es lo que la casa ya manda para el bosque compartido.
   ⛔ **La 4239 tiene que ir ANTES que el PHP nuevo**: `gameAccountDto` lee
   `game_accounts.avatar` en cada lectura de cuenta, así que con el código puesto y
   la columna sin crear se cae la lectura de materiales de todo el mundo. Al revés
   —columna primero, código después— no pasa nada: una columna que nadie lee es una
   columna que no molesta, y por eso es aditiva y se puede dejar puesta en un
   rollback.
5. **Un solo commit en el repo de la web** con las DOS cosas:
   el PHP de la autoridad (`src/game/community.php`, `src/game/cast.php`,
   `src/game/live.php`, `src/game/adventure-authority.php`, `src/game/controller.php`,
   `src/controllers-world.php`, `src/router.php`) y `public/game/current.json`
   apuntando al ID nuevo.
6. **Desplegar la web** por el panel. El puntero y la autoridad entran juntos:
   ventana cero.
7. **Humo**: que las cuatro pantallas abran la caja de construir, que se pueda
   colocar y quitar algo, que los dos `world-api.openapi.json` sigan idénticos, y
   que nada de la web haya cambiado de estado. Y del elenco: abrir `YO`, que la
   rejilla de duendes salga con sus caras, elegir otro, **comprobar que el cuerpo
   cambia sin soltar la conexión** (el asiento no se pierde) y que al recargar
   sigue puesto. Con una segunda sesión, que el otro te vea con el duende nuevo.

**Rollback**: se devuelve el puntero (la release anterior se conserva, no se poda).
⛔ **Y la migración se puede dejar puesta**: `communitySnapshot` mira PRIMERO el
catálogo, así que una fila de zona que el contrato instalado no nombra
sencillamente no se la pide nadie. Es aditiva e inofensiva. **Nunca se revierte
una base por encima de escrituras nuevas de la gente.**

---

# PARTE H — La base de datos

## H.1 Qué va dónde, y por qué

| Estado | Escrituras con 100 jugadores | Dónde | Por qué |
|---|---|---|---|
| Posiciones de gente | ~1000/s | **memoria del demonio** | **no debe sobrevivir**: tras un reinicio no hay nadie conectado |
| Objetos compartidos | ráfagas al empujar | memoria + volcado cada 10 s | tiene que sobrevivir, pero no a 20 Hz |
| Construcciones | unas pocas/s | **MariaDB** | firma, historial, moderación, patrimonio |
| Cacas-mensaje | ~2-3 por persona **al día** | **MariaDB** | firma, caducidad y moderación manual posterior desde el panel |

⛔ **Las posiciones no van a la base no porque MariaDB sea lenta, sino porque ese
dato no debe ser durable.** Escribir a disco algo que quieres perder es pagar dos
veces.

## H.2 El candado por zona: bien a 100, ojo si sube

Cada construcción hace hoy:

```php
SELECT revision FROM game_community_zones WHERE id=? FOR UPDATE
if ((int)$revision !== $b["zoneRevision"]) throw 409 zone_conflict
```

Un candado exclusivo sobre UNA fila por pantalla, más igualdad **exacta** de
revisión. **Con ~25 personas por pantalla la contención es pequeña y está bien.**
Lo que hay que cambiar es solo la cara:

⛔ **El cliente debe reintentar UNA vez en silencio** ante un `zone_conflict`, en
vez de enseñar «algo ha cambiado, revisa el lugar». Ese mensaje está pensado para
una carrera rara; con veinticinco vecinos deja de ser rara y se vuelve ruido.

Y queda dicho para el futuro: **si el tope sube de 100, esto es lo primero que se
rompe**, no la base. Con una multitud en una pantalla, la revisión cambia
constantemente y casi todo el mundo llega con la suya vieja → estampida de 409.
El arreglo entonces sería aflojar la igualdad estricta y revalidar contra el
estado actual, que `communityValidate()` ya hace de todas formas.

## H.3 Migraciones pendientes

| | |
|---|---|
| `4236_todo_el_bosque_se_construye.sql` | **Aplicada en producción el 18-sep-2026.** Las cuatro zonas existen |
| `4237_forest_messages.sql` | **Aplicada el 18-sep-2026.** Necesidades, mensajes, baneos y auditoría de moderación |
| `4238_forest_objects.sql` | **Aplicada el 18-sep-2026.** Posiciones y revisiones de los objetos compartidos |
| `4239_el_duende_que_eres.sql` | **Aplicada el 18-sep-2026.** `game_accounts.avatar`, aditiva y sin valor por defecto (NULL = nadie lo ha dicho). Fue ANTES que el PHP nuevo: §G.5 paso 4 |

Toda migración empieza con `SET NAMES utf8mb4;`. Se prueba primero en el clon
(`dev-migrate magikitos_dev migrations/<f>.sql`) y solo entonces se promueve.

⛔ **Y el panel lista lo pendiente leyendo el ÁRBOL DE PRODUCCIÓN, no el repo.**
Con producción dos commits por detrás, `migrations-pending` contesta «0
pendientes» teniendo cuatro ficheros delante — y eso es exactamente lo que
parece: que no hay nada que aplicar. Para migrar ANTES de desplegar (que es el
orden que §G.5 exige) hay que poner los ficheros en el árbol a mano, con el
contenido EXACTO de git: el `git reset --hard` posterior los deja igual y el
checksum que el panel apunta sigue cuadrando.

⛔ **Y lo demás del bosque construible NO necesita SQL**: los límites, el suelo,
lo prohibido y los anclajes los hornea el artefacto y la autoridad valida contra
el contrato instalado. Abrir otra pantalla mañana es una línea en
`construction.json` más su fila. **Solo las REGLAS nuevas piden código en la web.**

---

# Orden de implementación

**La entrega es completa: todo el alcance de este documento implementado,
probado, desplegado y funcionando en producción, sin romper los demás sitios
del VPS.** No se considera terminada con solo presencia, con el arte pendiente
o dejando el empuje compartido para otra entrega.

Los bloques siguientes ordenan el trabajo y sus comprobaciones internas; no son
entregas parciales que requieran nuevas decisiones del dueño. Se valida cada
base antes de integrar la siguiente y se respeta el orden seguro de migraciones,
artefactos y servicios. **No hay una espera obligatoria de semanas entre fases.**
La orden posterior de continuar autoriza ejecutar el alcance completo, incluido
el despliegue y su verificación, respetando las comprobaciones y dependencias
anteriores; no una entrega parcial.

| # | Qué | Depende de | Riesgo |
|---|---|---|---|
| 1 | **Parte B.1-B.4** (diálogo, setas, rastrillo, flores) | nada | bajo |
| 1b | **Parte B.5 motor**: descomponer el remo, tirar bow/roll, descablear las seis variantes, caché por bytes, presupuesto de descarga | nada | medio |
| 1c | **Parte B.5 arte**: 30 variantes × 124 sprites = 3.720 (210 hojas) | 1b | **alto (producción)** |
| 2 | **Parte A**: publicar lo que ya está en el árbol — **runbook paso a paso en §G.5** (estacionar → migrar 4236 → puntero y PHP en el MISMO despliegue) | 1 (por el renombrado) | bajo |
| 3 | El arte del rastrillo + sus dos recogidas (§A.9, §A.10) | 2 | bajo |
| 4 | **Parte C**: la caca-mensaje, publicación directa y panel de moderación manual | 3 (el palo, el patrón de objetos) | medio |
| 5 | **Parte E**: el demonio, primero SOLO presencia y espectadores | 2 | **alto** |
| 6 | El tope de 100, los tres relojes, los NPC que ceden | 5 | medio |
| 7 | Autoridad sobre objetos compartidos (la caja empujada) | 5 | **alto** |

⛔ **El 5 antes que el 7 no es negociable**: monta el transporte, el saludo, la
reconexión y el desfase de versiones primero, y compruébalos con clientes reales
y sintéticos. Después integra y prueba la autoridad sobre objetos **dentro de
esta misma entrega**. La puerta son las pruebas de integración, concurrencia,
carga, reinicio y recuperación, no dejar pasar semanas en producción.

**Cierre de la entrega:** verificar en producción el recorrido completo, los
contratos de ambos repositorios, las API y el servicio de tiempo real; comprobar
los demás sitios antes y después del despliegue, y conservar un rollback
coordinado del código y el artefacto sin revertir datos nuevos de usuarios. Las
pruebas no deben atribuir acciones a usuarios reales ajenos ni modificar otros
proyectos. No dar por completado nada que solo se haya probado en local.

---

# Cómo se comprueba cada cosa

⛔ La regla de la casa: **una comprobación que no se ha visto fallar está
apagada.** Rompe cada invariante a propósito y exige que grite.

| Qué | Cómo |
|---|---|
| Parte A | `npm test` → `check-construction-layout.cjs`: 71.424 celdas idénticas entre el mundo y el contrato, **392 casos de paridad JS/PHP** sobre el bosque real y **13 de topología** sobre una zona de mentira con dos islas. Ya probado en negativo |
| Sprites inventados | `check-adventure.cjs` contra el atlas, y `check-adventure-residents.cjs` pidiendo los paquetes como el juego |
| Textos | `check-adventure-locales.cjs`: seis idiomas por clave, y **seis destrozos que tienen que gritar** |
| Setas | que la seta NO reaparezca tras dar la brocheta (el caso exacto de §B.2), y que el bitset de nodos no se reordene |
| Flores | que la edad se calcule contra el **`now` del servidor**: adelanta el reloj del navegador y la flor no puede crecer antes |
| Diálogo | conducir el teclado de verdad, no leer el JS |
| Duendes | que las 30 elegibles tengan sus 124 sprites, con la MISMA piel y el MISMO alto de cuerpo en las siete hojas |
| Grids | informe de consistencia sobre el elenco real: alto del cuerpo y línea del pie iguales entre las siete hojas de cada variante |
| Carga | lo que se descarga en una pantalla con diez vecinos a la vista, no el total del atlas |
| Memoria | la caché de sprites acotada por BYTES: 25 vecinos son ~42 MB de RGBA |
| El remo | mirar las ocho frames de izquierda y derecha: ninguna pala del lado contrario |
| Presencia | **prueba de carga con conexiones sintéticas antes de abrir**. Las cifras de este documento son estimaciones mías, no medidas |
| La caja empujada | dos clientes, intenciones contrarias en el mismo tick, la caja quieta. Y uno solo: se mueve |
| Cacas-mensaje | texto en distintos idiomas publicado al momento, sin juez ni aprobación; HTML mostrado como texto, caducidad a las 24 h y controles de acción en servidor |
| Moderación manual | retirar un mensaje desde el panel y banear a su autor; el servidor impide nuevas publicaciones del usuario baneado |
| Reinicios | `systemctl restart` con gente dentro: reconexión automática, plazas y cola nuevas sin reservas anteriores; progreso y objetos persistentes conservados |
| Corte sin reinicio | desconectar y reconectar dentro de los 60 s: la gracia conserva la plaza mientras el mismo proceso siga vivo |
| El demonio caído | párralo y comprueba que **el juego de un jugador sigue entero** |
| Entrega completa | recorrido integrado en producción, web/API/juego operativos y los demás sitios del VPS sin regresiones; no quedan bloques de este encargo aplazados |

---

# Lo que NO se hace, y por qué

- **Chat.** No hay interfaz de conversación, destinatarios ni hilos. La
  caca-mensaje es una nota pública asíncrona y efímera de texto libre, sin
  revisión previa; el dueño modera manualmente después de publicarse.
- **Moderación automática o previa de mensajes.** No hay juez, filtro de
  contenido ni cola de aprobación; sí seguridad técnica y moderación manual.
- **Reservas de plaza tras reiniciar.** Un reinicio abre una cola nueva; no se
  persisten plazas ni turnos para reconstruirlos después.
- **Aplazar parte de la entrega durante semanas.** Se integra, prueba y publica
  todo el alcance cuando se autorice comenzar, respetando las dependencias y
  protegiendo los demás sitios del VPS.
- **Clavar el pergamino en la caca de otro.** Nacen los hilos y vuelve el chat por
  la puerta de atrás.
- **Editar lo ajeno** (`foreignEditsEnabled: false`). Dirección de diseño; se abre
  con evidencia, no antes.
- **Rotaciones**: el motor las admite y todas las piezas declaran `rotations: [0]`.
  Lo que falta son las vistas dibujadas.
- **Superficies**: el esquema las admite; esta entrega solo publica suelo firme.
- **El seto humano y los interiores como zona**: el jardín de los humanos es
  territorio suyo y una casa es de quien vive en ella. Lo compartido es el bosque.
- **Quitar los NPC.** Ceden sitio, no desaparecen (§D.4).
- **Subir el tope de 100 «porque el servidor aguanta».** Aguanta; el tope es el
  producto.
