# Release vigente

Registro operativo único. El historial de entregas y decisiones descartadas vive
en Git, no en varias guías contradictorias. Actualizar este archivo al publicar.

## Producción

Última activación verificada: `04c689f5c4a7b20aab65`, 16 septiembre 2026.
Runtime fuente: `9298174d7e96fbe214893ae9207756fcbc74d4b1`.
Activación web: `4b098e8fb94ce5d43e56017dc719989cea224f74`.
Anterior conservada: `49cef729900e43397250`.
Rutas: /aventura y cinco traducciones; web y API independientes.

Incluye entrada explícita, fullscreen y música/ambiente. Audio real, voces,
transición entre pistas y río probados públicamente en cuatro tamaños.
No es una compilación nativa ni certificación de dispositivos físicos.

## Pulido preparado para activar

Artefacto verificado y staged, aún no activo: `18b22405a8894271294f`.
SHA-256 de `release.json`:
`c2f4928fa9cec700907e0979ae30aa1657ae5ccd056af732dcea7d2c460d58d2`.

- Botella independiente en el suelo junto a la papelera; mismo ID autoritativo.
- Doce palos colocados: cuatro en el bosque y dos por tramo recolector del río.
- Galería Recogibles: palos, plantas culilimpia y botella; familias reproducibles.
- Seta de Brizno al 85 %, dibujo y cuerpo transformados juntos.
- Índices estables de plantas/palos; sin resetear inventarios ni partidas.
- Documentación consolidada y guías antiguas retiradas, recuperables en Git.

Verificado: `npm test`; recogibles en cuatro tamaños; galería/autoría y receta
completa en cinco tamaños; 33 comprobaciones locales de autoridad, 13 de
concurrencia/restauración/identidad y 167 peticiones de contrato API local en
seis idiomas. Las fixtures locales se retiran al terminar; no se usan cuentas
reales para estas pruebas. Studio principal conserva su workspace sin conflictos.

Integración general y comprobación pública pendientes de cerrar; no confundir
el build local con una activación ya verificada.
Procedimiento: [RELEASING.md](RELEASING.md).

## Recuperación y límites

Conservar el artefacto anterior y revertir solo el puntero con revisión explícita;
no restaurar bases de datos encima del progreso nuevo. Mantener medios, partidas,
Studio y construcciones existentes. No ejecutar ejemplos/seed al pulir escenas.

La publicación usa cuenta personal `alvarofranz`; ver `AGENTS.md`. La consolidación
de los dieciséis commits de desarrollo del 16-sep conservó el commit fundacional
`ce13ac20b4045e87345ba576b93b950c112ca000`; recuperación local:
`.local/history/before-personal-squash-20260916.bundle`,
`refs/backup/pre-personal-squash-20260916` y
`refs/backup/audio-before-personal-squash-20260916`. La web no reescribió historial.

La entrega nativa queda para su agente responsable: [MOBILE.md](MOBILE.md).
No hay nuevas misiones ni expansión de mapa en este pulido.
