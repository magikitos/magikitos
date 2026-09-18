# Arte de protagonistas — seguimiento real

Actualizado: 18-sep-2026. Prioridad del dueño: **cerrar primero todo el arte del
mundo exigido por `FINAL-UPGRADE.md`; después completar los protagonistas**.
Esta línea de arte y su integración progresiva tienen **prioridad absoluta**.

**Trabajo detenido tras terminar Brezo bruma (101), por orden del dueño.** No empezar
Menta ni otro protagonista, no ampliar arte ni desplegar. El objetivo global
no está terminado. Pendientes de lógica y operación: `FINAL-UPGRADE.md`,
«Handoff al detener el objetivo».

**Corrección de perspectiva del primero (18-sep):** `right`, `left`,
`up-right` y `up-left` tienen dieciséis poses nuevas, con remo cercano/lejano
coherentes y protección del cuello/cuerpo. Pasar clipping no basta para validar
anatomía: se ha revisado la composición y el ciclo. `down`, `down-right`,
`down-left` y `up` conservan sus maestros, anclas y rig aprobados. El dueño ha
aprobado el resultado. Brezo bruma sigue esa referencia, sin tocar las vistas
aprobadas del primero; después se detiene el trabajo por orden del dueño.

**Comprobación técnica previa (18-sep):** Brezo alba estrena remos largos completos,
con puntas por debajo de la pelvis, encaje ligeramente mayor y más bajo de perfil.
La nueva prueba exige contacto real **fuera del casco**, conserva los píxeles
secos y rechaza parches semitransparentes en la pala sumergida. Las 32 capturas
y el ciclo real en tres pantallas pasan. Menta y el resto no se han retomado
durante esta corrección. Brezo bruma ya tiene remada larga, nuevas vistas de
perspectiva y rig propio medido. Supera la misma revisión estricta con los nueve
cascos; las seis acciones restantes conservan sus maestros aceptados.

## Orden de trabajo acordado

1. Terminar **Brezo alba (100)** entero y la **botella vacía**, sin remos ni
   asiento: siete hojas, sin abrir otro protagonista.
2. **Integrarlo antes de continuar con el siguiente**: sustituir la navegación
   compuesta antigua por botella y remero independientes; probar las ocho
   direcciones, las fases de remada, el encaje del cuerpo y las manos en el juego real.
   El nuevo arte debe poder utilizarse, no quedarse solamente en el catálogo.
3. Continuar **uno por uno** con los demás protagonistas. Cada uno se comprueba
   en esa misma barca antes de marcarlo completo. No se regeneran barcos por
   personaje y no se declara comprobado un remero que todavía no tiene su arte.
4. El primer protagonista ya está aprobado. Preparar ahora ocho cascos adicionales
   pedidos por el dueño: madera elegante, madera pintada, nuez, hoja, corteza de
   abedul, corcho, lata y calabacita. Se prueban
   con el mismo remero y máscaras propias, pero **no se activan en la partida**.
   Después continuar los protagonistas, uno completo antes del siguiente.

## Arte completo y estado de integración

**Arte completo, revisado y horneado: 2 de 30 — Brezo alba y Brezo bruma.**
Son 14/210 hojas y 248/3.720 poses adicionales; faltan 28 personajes, 196 hojas y
3.472 poses aceptadas.

⛔ **Y esos dos YA SE PUEDEN ELEGIR en el juego publicado** (18-sep-2026): el
selector del panel «Yo» ofrece el elenco que la release dibuja de verdad, y esa
lista se DERIVA de esta tabla. Subir las siete hojas de un personaje y hornear lo
mete en el selector de todo el mundo sin tocar código ni listas; hasta entonces
no aparece, que es lo que impide ofrecer un duende a medias.
Los cien vecinos originales se conservan intactos; treinta de ellos recibirán
las siete acciones jugables.

| ID | Personaje | Hojas terminadas | Integración |
|---|---|---|---|
| 100 | Brezo alba | `run`, `row`, `push`, `work`, `carried`, `needs`, `discover` — 124 poses | Utilizable en local; cuatro orientaciones de remada corregidas, máscara de cuerpo, 32 composiciones y ciclo real en tres pantallas comprobados |
| 101 | Brezo bruma | `run`, `row`, `push`, `work`, `carried`, `needs`, `discover` — 124 poses | Remada larga y cuatro vistas de perspectiva corregidas, rig propio y nueve cascos comprobados en Chrome/WebKit; ciclo real en escritorio/tablet/móvil y movimiento reducido. Seleccionable en QA local, **selector por cuenta pendiente** |

Brezo bruma conserva el gorro cosido con punta anudada, puños azules, bolsillo
de hoja y pantalón corto. Los candidatos sobredimensionados están rechazados en
el catálogo, con su motivo; no se sustituyen ni borran sus originales.
Registro de pelvis medido en cada pose. Su prueba de navegación pasa los once
atraques en escritorio, tablet y móvil; recogida/cocina pasan también con
movimiento reducido. Las pruebas de carrera y necesidades utilizan ese mismo
personaje, no una pose prestada de Brezo alba.

**Cierre de Bruma (18-sep):** fuentes `brezo-bruma-row-long-cuffs` y
`brezo-bruma-row-perspective`, generadas con imagegen integrado, originales y
prompts conservados en `data/aventura/art/residents/actions/`. La corrección
direccional se combina al hornear en un único paquete; no son dos texturas por
personaje. Anclas de pelvis y palas están medidas sobre su propio dibujo.
No se han reducido los umbrales de contacto ni reutilizado una máscara corporal
ajena. La batería completa pasa: 576 composiciones estáticas y 936 capturas del
ciclo real entre las nueve barcas, tres tamaños y movimiento reducido.
Evidencia del artefacto `d3315d78a03d225044b2`:
`.local/vessel-art-reviews/101/fleet.json`, `101/fleet-{id}-{browser}/` y
`101/{id}-game/` (la botella utiliza `101/game/`). No se ha tocado el arte
aprobado de Alba. **No se continúa con Menta ni se publica esta ronda.**

`npm test` pasa al cerrar esta revisión. El artefacto verificado queda instalado
en DDEV, conservando las releases anteriores y sin reiniciar el servicio: el
contrato de API/presencia no cambia en esta actualización de arte. La partida
normal sigue usando Brezo alba y la botella; Bruma se selecciona en QA hasta
implementar el selector por cuenta. No hay commit, push ni despliegue de esta
ronda. Ambos árboles contienen trabajo local que debe conservarse.

La revisión ampliada descubrió dos fallos que los tests anteriores no detectaban:
palas cortas que terminaban sobre plástico y una elipse que atenuaba solo parte
de la pala. El nuevo maestro de Brezo alba mantiene los **dos remos completos**;
casco, remo lejano e inmersión usan máscaras independientes con la silueta real
del casco. Se conserva exactamente el píxel seco y se corta la punta sumergida,
sin parches de opacidad. Esto no añade lecturas de píxeles al juego: solo a QA.

Para entrar en esta lista deben estar revisadas y horneadas **las siete hojas**:
`run` (32), `row` (32, remero con sus remos), `push` (16), `work` (16), `carried` (16),
`needs` (8) y `discover` (4): **124 poses adicionales por personaje**. Se revisan
identidad, piel, direcciones, movimiento, escala, apoyo, recortes y transparencia
a la resolución del juego. Una propuesta generada no equivale a arte aceptado.
El selector, la persistencia y el despliegue son comprobaciones de integración
aparte: esta lista no los da por terminados.

**Remar es una acción de TODOS los protagonistas, no de una barca.** Cada
personaje tiene su hoja `person-{variante}-{dirección}-row-{fase}` **sentado,
piernas hacia delante y remos en las manos, sin casco**. Los remos pertenecen
al personaje: las manos y las palas se animan juntos, sin uniones flotantes.
Cada embarcación aporta solo el casco vacío **sin asiento, tabla ni banco**, sus puntos de encaje por
dirección y el ajuste de colocación del remero. Solo la botella está activa;
los ocho cascos de reserva tienen su propio arte/datos, sin regenerar personajes ni
crear combinaciones duende×barca. Las capas comparten dirección; el ciclo de
remada pertenece al personaje y no obliga a duplicar el casco estático por fase.
El punto de encaje es un **dato invisible**: la pelvis queda dentro del hueco,
los pies hacia delante. Se comprueban solapamiento con el borde del casco,
estabilidad de la pelvis y recorrido de las palas, sin pies atravesando paredes.
Si hace falta una capa del borde delantero para oclusión, contiene solo píxeles
del casco: nunca cuerpo, asiento ni remos. Cada barca declara su propio encaje
en las ocho direcciones; no se añaden excepciones por nombre de personaje.
**Corrección del dueño (18-sep): la propuesta con asiento y remos pegados a la botella
queda descartada antes de integrarla.** Se conservan los maestros como historial
de producción, no como solución terminada.

**Corrección posterior: las palas completas se conservan.** La edición
`brezo-alba-row-profile`, que hacía desaparecer parte de los remos, está
rechazada y fuera del atlas. La hoja activa es `brezo-alba-row-long-clean`,
generada con image_gen integrado; maestro y prompt en
`data/aventura/art/residents/actions/`. `brezo-alba-row-oars` queda archivada por
tener remos demasiado cortos, no por carecer de una de las palas. La
oclusión del casco, el remo lejano y la inmersión se resuelven con máscaras
en código/datos, no borrando píxeles de los originales. Contrato técnico,
extensión a otros cascos y pruebas: [ART.md](data/aventura/ART.md#composición-de-navegación).

La corrección posterior `brezo-alba-row-perspective-clean` aporta únicamente
las dieciséis poses de perfil y subida diagonal, generadas con image_gen
integrado. Maestro y prompt están en el mismo directorio; `overrides` registra
su procedencia y el horneado combina ambas hojas sin otra textura en ejecución.
Los candidatos `row-perspective` y `row-perspective-two` se rechazan por incluir
terceros remos en algunas poses. Se conservan como originales, no se sirven.
QA vigente: `.local/vessel-art-reviews/100/perspective-final/`,
`perspective-final-webkit/` y los contactos del ciclo real en `100/game/`.
La prueba negativa reproduce el recorte del cuello sin `bodies`; con la máscara,
los píxeles protegidos se conservan. No se ha llevado esta corrección a producción.

## Arte del mundo: comprobación previa a continuar protagonistas

| Requisito del plan | Evidencia actual | Estado |
|---|---|---|
| Rastrillo (§A.9/B.3) | Maestro y prompt en `data/aventura/art/forest-tools/`; paquete `forest-tools` | Generado y horneado |
| Semillas de hierba (§A.9) | Reutilización explícitamente permitida de `garden-seed-sack` | No requiere imagen nueva |
| Conjuntos de setas (§B.2) | Cinco sprites existentes previstos en el plan; nodos de recursos | No requiere imagen nueva |
| Tierra sembrada (§B.4) | Pintado de terreno en `construction-growth.js`, alternativa permitida sin textura | No requiere imagen nueva |
| Flores por semilla (§B.4) | Variantes existentes de vegetación en el atlas | No requiere imagen nueva |
| Pergamino, bolígrafo y nota clavada (§C) | Maestros, prompt y recorte en `data/aventura/art/forest-writing/`; paquete `forest-writing` | Generados y horneados |
| Muebles, vallas, macetas y piscina (§A.11/E) | Biblioteca existente; el cambio pedido es de autoridad/colocación, no de diseño | No requiere imagen nueva |
| Barca común sin personaje, remos **ni asiento**, 8 direcciones (§B.5.2) | Maestro `bottle-hull-floor`, paquete `vessel-bottle`; fondo de botella cerrado, ocho anclas de pelvis y máscaras en `rowing.json` | Generada, horneada e integrada en local |

**No falta otro tipo de arte del mundo para el alcance original del plan.**
La ampliación pedida tras aprobar Brezo añade únicamente los ocho cascos de la
tabla siguiente. **Ya están generados, horneados y comprobados con ambos Brezos**;
solo quedan por generar/cerrar los protagonistas. No se abre otra familia de
arte del mundo ni se confunde arte disponible con el resto de lógica del plan.
El casco vacío está corregido. Su punto de encaje se registra por una
referencia medida dentro del hueco, sin asiento dibujado. Los originales y los
prompts quedan en `data/aventura/art/river/`.

### Flota de reserva — lista para componer, no activada

| ID | Material/diseño | Maestro | Estado |
|---|---|---|---|
| `willow` | Madera miel, borde oscuro, proa tallada | `willow-skiff.png` | 8 vistas + 32 composiciones verificadas |
| `painted` | Madera turquesa, franja coral y hojas doradas | `painted-canoe.png` | 8 vistas + 32 composiciones verificadas |
| `walnut` | Cáscara de nuez con interior cálido | `walnut-hull.png` | 8 vistas + 32 composiciones verificadas |
| `leaf` | Hoja plegada y atada con fibras | `leaf-hull.png` | 8 vistas + 32 composiciones verificadas |
| `birch` | Corteza de abedul cosida | `birch-hull.png` | 8 vistas + 32 composiciones verificadas |
| `cork` | Corchos unidos alrededor de un fondo continuo | `cork-hull.png` | 8 vistas + 32 composiciones verificadas |
| `tin` | Lata recuperada, esmalte rojo gastado y borde metálico | `tin-hull.png` | 8 vistas + 32 composiciones verificadas |
| `gourd` | Calabacita vaciada con un único tallo | `gourd-hull-clean.png` | 8 vistas + 32 composiciones verificadas |

Maestros en `data/aventura/art/river/sources/`; prompts con el mismo nombre en
`data/aventura/art/river/`. Generados con **imagegen integrado** y recortados con
el pipeline local autorizado; fuentes y hashes conservados. La primera
calabacita se rechazó por un tallo duplicado: queda documentada en `sourceHistory`,
no se exporta. Todos tienen fondo cerrado, sin asiento, personaje ni remos.

Los ocho PNG nativos suman **196.231 bytes** y son paquetes separados. Ninguno
se descarga en la partida actual: `defaultVessel` permanece en `bottle`. No se
han añadido recetas, objetos del saco ni desbloqueos para estos barcos. Las
pruebas usan una selección aislada de casco y no modifican partidas reales.

Verificación: nueve cascos contando la botella × 32 composiciones × Chrome y
WebKit = **576 composiciones**, con pruebas de fondo, contacto de palas, recorte
nítido, cuerpo intacto y 512 KiB de superficies reutilizadas. Los ocho nuevos
pasan también el ciclo real en 1440×900, 768×1024 y 390×844, más movimiento
reducido. Capturas: `.local/vessel-art-reviews/100/fleet-{id}-{browser}/` y
`100/{id}-game/`. Brezo bruma repite la batería completa bajo `101/`, con su rig
propio. No equivale a prueba en dispositivos físicos.

Cada protagonista posterior debe volver a pasar estas pruebas con su **propio**
rig, no heredar una aprobación por parecerse a Brezo:
`node scripts/check-vessel-fleet.cjs --variant=ID --motion`.

«Vacío» significa sin personaje/muebles, **no sin fondo**: la corrección
`bottle-hull-floor` conserva una base cóncava de plástico en las ocho vistas.
El horneado comprueba seis muestras opacas del suelo por vista y el navegador
las comprueba otra vez sobre el atlas servido. La versión con huecos queda
archivada fuera del manifest.

**Integración local del primer set:** el motor ya usa `vessel-art.js`, con casco
y remero independientes. El manifest ya no incluye `actor-0-row` ni el icono
compuesto anterior. Las 32 composiciones de Brezo pasan la prueba ampliada de
píxeles: ambas palas medidas, contacto fuera del casco, cero agua sobre plástico
opaco, cabeza intacta y cero restos semitransparentes dentro de la punta recortada.
Escala del ocupante ×1,1, ajuste vertical de 2 px en perfiles y 1 px en diagonales;
son datos de la barca, no excepciones del motor. Los dos lienzos reutilizados
suman 512 KiB, sin texturas por combinación. Evidencia reproducible:
`node scripts/check-vessel-browser.cjs --variant=100 --label=final`, también con
`--browser=webkit --label=webkit`. Ambas implementaciones pasan las mismas
comprobaciones, no solo una captura visual.
El ciclo real produce otras 96 capturas (8×4×3 pantallas), más ocho con movimiento
reducido: `node scripts/check-rowing-motion-browser.cjs`. Las rutas, corrientes,
aceleración y todos los atraques pasan en 1440×900, 768×1024 y 390×844.
Cocinar/descubrir también pasan en esas pantallas con movimiento normal y reducido.
Tras el reporte del dueño se añadió la prueba de embarque autenticado en DDEV:
una cola antigua bloqueada por `journey_required` se recupera sin borrar sus
operaciones, y la barca espera `renovado` antes de solicitar el cruce online.
La prueba reproduce el fallo antes de la corrección y pasa después con una
identidad sintética; ninguna partida real se resetea.
La cola antigua con `picnic-mushroom` también queda cubierta: los rechazos
explícitos por objeto retirado/receta obsoleta se archivan antes de continuar.
El test real reproduce el 404 original y comprueba después embarque, desembarque,
recarga y conservación de herramientas/setines, sin tocar la cuenta del dueño.
La barca nueva **no está desplegada**. El encaje de los otros 28 remeros sigue
pendiente de tener y revisar su arte. Los maestros históricos no se borran.

## Protagonistas pendientes

La fuente de verdad de hojas aceptadas es
`data/aventura/art/residents/actions/catalog.json`, contrastada con el atlas por
`node scripts/check-playable-art.cjs --sources-only`.

⛔ **El modo sin esa opción ya NO exige las 210** (decisión del dueño, 18-sep-2026:
«se lanza con los dos que hay y crece solo cuando subas hojas»). Exige que cada
duende **OFRECIDO** esté completo —eso es lo que de verdad no puede fallar: un
personaje a medio dibujar en el selector— y DICE cuántos faltan para el elenco
final. La lista de ofrecidos no se escribe en ninguna parte: la deriva
`data/aventura/world.php` cruzando los remos medidos con las siete acciones
horneadas, así que **subir las siete hojas de un personaje lo mete en el juego
sin tocar una línea de código** (ver FINAL-UPGRADE §B.5.11).

| ID | Personaje | Hojas aceptadas y horneadas | Pendiente |
|---|---|---|---|
| 105 | Menta alba | 0/7 | Siete acciones generadas con image_gen y prompts en `data/aventura/art/residents/actions/menta-alba-*.prompt.txt`; originales/correcciones en `sources/menta-alba-*.png`. Pausada para revisar primero la barca de Brezo; candidatos aún sin aceptar ni hornear |
| 110 | Castaña alba | 0/7 | Las siete acciones |
| 111 | Castaña bruma | 0/7 | Las siete acciones |
| 115 | Junco alba | 0/7 | Las siete acciones |
| 120 | Mora alba | 0/7 | Las siete acciones |
| 125 | Avellano alba | 0/7 | Las siete acciones |
| 130 | Lino alba | 0/7 | Las siete acciones |
| 131 | Lino bruma | 0/7 | Las siete acciones |
| 135 | Lila alba | 0/7 | Las siete acciones |
| 136 | Lila bruma | 0/7 | Las siete acciones |
| 140 | Tomillo alba | 0/7 | Las siete acciones |
| 145 | Salvia alba | 0/7 | Las siete acciones |
| 146 | Salvia bruma | 0/7 | Las siete acciones |
| 150 | Nogal alba | 0/7 | Las siete acciones |
| 155 | Violeta alba | 0/7 | Las siete acciones |
| 160 | Roble alba | 0/7 | Las siete acciones |
| 161 | Roble bruma | 0/7 | Las siete acciones |
| 165 | Dalia alba | 0/7 | Las siete acciones |
| 166 | Dalia bruma | 0/7 | Las siete acciones |
| 170 | Saúco alba | 0/7 | Las siete acciones |
| 171 | Saúco bruma | 0/7 | Las siete acciones |
| 175 | Hiedra alba | 0/7 | Las siete acciones |
| 180 | Olmo alba | 0/7 | Las siete acciones |
| 181 | Olmo bruma | 0/7 | Las siete acciones |
| 185 | Malva alba | 0/7 | Las siete acciones |
| 190 | Acebo alba | 0/7 | Las siete acciones |
| 195 | Amapola alba | 0/7 | Las siete acciones |
| 196 | Amapola bruma | 0/7 | Las siete acciones |
