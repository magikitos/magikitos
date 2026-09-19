# Brezo alba: corrección de correr y remar

Receta de la corrección aprobada de `run` y `row` del personaje 100.
Conservar andar/quieto, empujar, trabajar, llevado por gato, necesidades y
hallazgo. El elenco nuevo se sigue en `ART-DUENDES.md`; esta receta no lo modifica.
El contrato común está en `docs/ROWING-ART.md`. Los intentos de hoja completa en
`protagonist-pair` siguen rechazados; no se integran.

Se usa imagegen integrado para editar el dibujo tomando el original
`residents/sources/resident-001.png` como referencia de identidad y estilo.
Preparación local autorizada: recortes, alfa y registro, sin rediseñar mediante
filtros ni modificar el motor. Prompts exactos en `prompts/` y generaciones
inmutables en `sources/`. `review/` conserva comparativas y montajes de autoría;
solo los maestros seleccionados en `residents/actions/sources/` se hornean.

## Estado

- Carrera y remada terminadas e instaladas en DDEV: `e223116731b5acaa6b84`.
- Petición vigente: **un solo cuerpo sentado por dirección, idéntico en las
  cuatro fases**, incluidos manos, cara, ropa y posición. Solo se animan los
  remos alrededor de sus agarres fijos. Sustituye la anterior conservación de
  las otras 28 poses. Se mantiene oculto el remo lejano en `up-right/0`,
  `up-right/3`, `up-left/0`, `up-left/3`. Referencias anteriores conservadas:
  `review/row-owner-approved.png` y `review/row-before-fixed-body.png`.
- Remada ensamblada offline desde ocho cuerpos fijos, cabeza original, pala
  ilustrada y agarres medidos. Es un único paquete de remero con los remos,
  separado del casco. Atlas: `actor-100-row-e0f8cfd89c08.png`, 59.612 bytes.
- Asiento de la botella retrasado: `right` = `[-4,2]`, `left` = `[4,2]`,
  `down-right` = `[-3,-1]`, `down-left` = `[3,-1]`. Es configuración de esa barca,
  válida para cualquier remero; no un desplazamiento oculto en la anatomía del actor.
- Revisión final: `.local/vessel-art-reviews/100/fixed-body/all-32.png` y
  `fixed-body-webkit/all-32.png`. Ambos navegadores pasan la comprobación completa,
  no solo `--measure`. El ciclo real pasa en 1440×900, 768×1024 y 390×844,
  incluyendo movimiento reducido. DDEV sirve el atlas nuevo con el mismo hash
  que el archivo local; no hay errores JS/HTTP. Pasan las pruebas de integridad
  del elenco, los nueve cascos y el contrato de remada. Carrera y los demás
  paquetes no cambian en esta ronda.
- El recorte sigue nítido, sin opacidad parcial de palas bajo el agua. Las dos
  diagonales traseras conservan la fase 2 pasando sobre el casco, aprobada por el
  dueño: no se ha abierto su trayectoria. `hullSupportedOars` obliga a QA a medir
  solapamiento real con el casco, en vez de exigir inmersión a una pala elevada.
- `occludedOars` identifica únicamente las cuatro oclusiones secas; QA exige cero
  madera fuera de la máscara corporal. No debilita el contacto de las palas visibles.
- No se cambia el motor JS/PHP, otros personajes ni partidas. Se actualizan
  imágenes, datos de arte, sus pruebas y documentación. No publicar esta ronda.

## Maestros y reproducción

- Carrera: `../residents/actions/sources/brezo-alba-run-matte.png`.
- Remada: `../residents/actions/sources/brezo-alba-row-matte.png`.
- `php data/aventura/art/brezo-repair/prepare-run.php` reproduce la carrera en `review/`.
- `php data/aventura/art/brezo-repair/prepare-row.php` reproduce la remada en `review/`.
- `php data/aventura/art/brezo-repair/verify-refinement.php` verifica los píxeles
  corporales invariantes fuera de la cobertura de los remos, los agarres fijos,
  la correspondencia exacta del rig con la ilustración y las posiciones de asiento.
  Un control negativo altera una cara y comprueba que la prueba lo detecta.

La receta prepara cada cuerpo **fuera del bucle de fases**. Las cuatro vistas
laterales usan la primera postura de `row-empty-hands`; las cuatro restantes,
la primera postura de `row-matte-base-01`, separando sus remos mediante siluetas
de autoría. Se conserva el arte corporal original, sin nueva generación.
`review/row-fixed-bodies.png` guarda las ocho posturas; `row-oar-coverage.png`
delimita los únicos píxeles que pueden cambiar; `row-rig-source.json` conserva
los agarres/puntas medidos en píxeles fuente. El rig runtime es ese dato por
la escala de registro del actor, redondeado a dos decimales. Estos archivos
de autoría/prueba **no se descargan en el juego**.

Para revisar mientras otro agente o Studio construye, fijar el artefacto:
`node scripts/check-vessel-browser.cjs --variant=100 --vessel=bottle --label=fixed-body --release=<id>`.
Así no se mezcla una máscara nueva con un atlas anterior por cambios concurrentes
del puntero `current.json`.

Las recetas NO instalan ni sobrescriben los maestros seleccionados. Tras aprobar
un montaje nuevo, copiarlo a su fuente, actualizar su hash en el catálogo y usar
`prepare-adventure-cast.php --sheet brezo-alba-run-matte` / `brezo-alba-row-matte`;
después hornear y construir por el flujo normal. No cambiar los PNG antiguos:
siguen siendo procedencia de otros personajes. Los paquetes horneados anteriores
se sustituyen, pero fuentes, git y releases previas permiten recuperarlos.

Generación original: herramienta imagegen integrada, prompts exactos en `prompts/`.
Esta última corrección no ha usado nuevas generaciones: solo composición y anclas.

No declarar terminado por haber generado un PNG: revisar alternancia de piernas,
caras, siluetas, límites de celda y animación a escala de juego. El tamaño de
cuerpo no se normaliza por altura de cada pose agachada.
