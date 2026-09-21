# El bosque se mantiene solo

Vigente desde el 19 de septiembre de 2026. Decisiones del dueño; una sola idea: **el bosque se
regula por el mundo y por la gente, no por reglas administrativas ni paneles de moderación.**
Implementación en el juego (`maintenance.js`, `construction-layout.js`, `community.js`,
`construction.json`, `catalog.json`, `behaviors/warehouse.json`, escena `almacen`) y en la web
(`src/game/community-maintenance.php`, `community.php`, `forest-storage.php`, `bosque-vivo/`, cron
de cada minuto, migración `4240`). Lo que aquí se cuenta es cómo funciona, no qué falta.

## Decisiones cerradas (no reabrir)

- Los **caminos no se bombardean** (`bombable: false`): su regla es la de los caminantes.
- **No hay ventana de gracia** al construir: cuando está hecho, está.
- **La reputación no participa**: ni setines ni `trust` compran ni quitan nada. Los setines son
  reputación, no dinero; todo lo del almacén se paga en **setas**.
- **No hay techo duro** de cobertura por zona: solo el precio, que sube exponencialmente.
- **No hay NPC que desmonten**, ni papelera, ni panel, ni votación. Retira la bombita y la hierba;
  el historial (`game_community_history`) se hereda por usar el mismo camino de retirada.
- Desactivar una bombita **no avisa a nadie**. Lo que coloca el dueño desde el Studio
  (`protected`) no se toca jamás.
- **Nada devuelve material**: ni la hierba ni la explosión. Quitar una valla propia devuelve el
  precio BASE, sin multiplicador (lo pagado no se guarda y devolver al precio de hoy sería una
  granja).

⛔ **LA BOMBITA Y LA TENAZA NO SALÍAN DEL NAVEGADOR** (21-sep-2026, repaso). El servidor tenía
`community-mine` y `community-defuse` implementados y documentados en el OpenAPI, pero faltaban en
la lista blanca del cliente (`api.js`, `METHODS`), que rechaza cualquier punto desconocido ANTES de
tocar la red. Como `maintain()` pasa el nombre del punto en una variable, ningún buscador de
literales lo vio: la función entera estaba muerta desde que se escribió y el jugador solo veía
«vuelve a intentarlo», siempre, porque el fallo llega sin `status` y cae en la rama de reintento.
Lo cierra `scripts/check-api-contract.cjs`, que exige que lo que el motor nombra esté en la lista y
que lo que la lista promete exista en el contrato público.

## A. El precio sube con lo pisado

`coste(material) = ceil(costePorCelda × celdas × 2^(d/D))`, con `d` = celdas de trazado vivas de
la misma familia en la zona ÷ celdas pisables de la zona, y `D = densityDoubling` de la pieza
(0,02 en `forest-path` y `twig-fence`; sin la clave, ×1). El multiplicador se redondea a seis
decimales antes de multiplicar, en JS (`densityMultiplier`) y en PHP
(`communityDensityMultiplier`), y el precio que enseña la barra sale de la misma instantánea de
zona que el servidor exige por revisión. Desde ×4 la barra dice «este claro ya está muy pisado».

## El material: gravilla por setas, en el almacén

Un camino cuesta **una gravilla por celda**; un **saco son diez** (`gravilla.bundle`); en el saco
caben 60. La gravilla sale del **almacén del constructor** (la regadera junto al lago, escena
`almacen`): **5 setas → 1 saco**; **6 setas → bombita**; **2 setas → tenaza**. ⛔ **NADA SE REGALA**
(20-sep-2026, decisión del dueño: «los sacos NO se regalan, esa idea es una estupidez»): el saco
del día gratis que hubo unas horas se retiró, y `check-bomb-balance.cjs` lo exige. Las setas se
cortan con cuchillo y **rebrotan a las
8 horas** por jugador. Lo concede el servidor por las reglas de la entidad (`game-action`), nunca
el cliente. Ver el almacén en [SHARED-FOREST.md](SHARED-FOREST.md).

## B. La bombita

Objetos `bomba` y `desactivador`, tope uno de cada por cuenta, consumibles. La bombita se pone
con la mano sobre UNA pieza ajena (`community-mine`), con un mensaje que sigue la política de las
notas del bosque, y se lleva solo esa pieza; se rechaza sobre patrimonio (`heritage`), rincones
`protected`, caminos, piezas ya minadas y sin bombita en el saco (`bombReason`, mismo orden en
los dos gemelos). Mecha de **cinco horas** de reloj de pared (`construction.bomb.fuseMs`); el DTO
lleva `explodesAt` como instante absoluto; a media hora del final la bombita parpadea en rojo
(`pulse`, 2,2 s). La tenaza la desactiva (`community-defuse`) sin avisar. Explota el **cron de
cada minuto** (`forestExplodeDue`) por el camino de retirada normal: borrado blando, historial con
`actor_id` nulo, revisión de zona, sitio libre. Al autor se le avisa (`forest_bomb`, apagable,
fuera del cupo semanal, dos enum movidos juntos). `mined_by` es un id de persona: en
`USER_REF_COLUMNS`, nulo al borrar la cuenta, reasignado al fusionar, `ON DELETE SET NULL` para
el reciclador de anónimos.

## C. La hierba vuelve

La unidad es el **tramo**; solo mueren los de los **extremos** y el camino nunca se parte; con
menos de dos puntos se retira entero. El reloj **no es una fecha**: `game_community_zones.clock`
son minutos de presencia (el demonio suma con alguien dentro y lo vuelca por el sidecar,
comando `clock`); cada tramo guarda el reloj de su última pisada (`steps_json`, comando `steps`,
como mucho una marca por persona, tramo y minuto). Un tramo con `clock − pisada ≥
overgrowth.minutes` (720) muere en el barrido del cron (`forestOvergrowthSweep`,
`communityErodePath` = `erodePath`); desde la mitad del presupuesto el cliente pinta hierba en
sus bordes (`overgrowth-sparse-*`, `overgrowth-full-*`). Un camino nace con todos sus tramos
recién pisados.

## Qué medir cuando haya tráfico (hoy, 14 cuentas)

1. Celdas pisables por zona y cuánto camino hay: decide `densityDoubling`.
2. Minutos de presencia al día por escena: decide si 720 son tres días o tres meses.
3. Cuántas celdas de camino compra una hora de juego con setas a 8 h y cinco por saco.
4. Bombitas puestas / desactivadas / explotadas por semana: si nadie desactiva, la tenaza es
   demasiado cara o demasiado escondida.

## Trampas

- Toda regla de coste o geometría vive por DUPLICADO (JS y PHP) y se comprueba en negativo.
- `construction` y `catalog` viajan en el contrato de la release: un dato nuevo no llega a
  producción hasta hornear y activar el puntero, y la web lo valida contra el artefacto instalado.
- El sidecar cambió de protocolo (`clock`, `steps`, `paths` en `load`): PHP y demonio viajan en el
  mismo despliegue.

## Pruebas

`check-construction-density.cjs`, `check-forest-overgrowth.cjs`, `check-forest-bomb.cjs`
(paridad JS/PHP con mutación negativa), `check-bomb-balance.cjs` (economía en setas), y en la web
`scripts/check-community-maintenance.php` (DDEV).
