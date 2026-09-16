# Release vigente

Registro operativo único. El historial de entregas y decisiones descartadas vive
en Git, no en varias guías contradictorias. Actualizar este archivo al publicar.

## Producción

Última activación verificada: `18b22405a8894271294f`, 16 septiembre 2026.
Fuente del artefacto: `b683ed8960cf7c5cb240409cf836cca9f028b626`.
Activación web: `750eecfd38377bcfe4c70571091fca9db30e7c11`.
Anterior conservada: `04c689f5c4a7b20aab65`.
Rutas: /aventura y cinco traducciones; web y API independientes.

SHA-256 de `release.json`:
`c2f4928fa9cec700907e0979ae30aa1657ae5ccd056af732dcea7d2c460d58d2`.
397 archivos verificados antes de activar el puntero. Despliegue fast-forward
limitado al puntero, documentación y herramientas de prueba/autoría inertes:
sin cambios de backend, migraciones, seed, importaciones ni escrituras en partidas.

## Pulido publicado

- Botella independiente en el suelo junto a la papelera; mismo ID autoritativo.
- Doce palos colocados: cuatro en el bosque y dos por tramo recolector del río.
- Galería Recogibles: palos, plantas culilimpia y botella; familias reproducibles.
- Seta de Brizno al 85 %, dibujo y cuerpo transformados juntos.
- Índices estables de plantas/palos; sin resetear inventarios ni partidas.
- Quince documentos obsoletos retirados, recuperables en Git. Guías vigentes
  consolidadas; `REPOS.md` privado resume la separación real sin duplicar este registro.

## Verificación

Local: `npm test`; recogibles en cuatro tamaños; galería/autoría y receta
completa en cinco tamaños; 33 comprobaciones locales de autoridad, 13 de
concurrencia/restauración/identidad y 167 peticiones de contrato API local en
seis idiomas. Las fixtures locales se retiran al terminar; no se usan cuentas
reales para estas pruebas. Studio principal conserva su workspace sin conflictos.

Integración general: siete tamaños de 320×568 a 2560×1440; cinco interiores en
cuatro tamaños; seis idiomas; puertas, escaleras, barca, guardado y pruebas aisladas
de recorte/colisión/autosave/diff del Studio.

Producción: seis rutas exactas byte a byte en origen; shell y hashes de JS/CSS,
manifest y contrato en el dominio público; API, galería plana, mundo compartido,
web tradicional y accesos protegidos. Bosque, navegación, desembarco, controles y
carga diferida probados en 1440×900, 768×1024 y 390×844. Cero escrituras enviadas;
también se bloquearon los POST de seguridad inyectados por Cloudflare.
Prueba pública específica de recogibles: botella/papelera, partida con barca,
seta reducida, desaparición de palos y persistencia tras recargar en 1440×900,
768×1024, 390×844 y 844×390, con todas las escrituras bloqueadas.

Entrada explícita, fullscreen y música/ambiente se conservan sin cambios. Sus
pruebas públicas de señal, voces y crossfade pertenecen a la entrega anterior;
el núcleo de audio se vuelve a comprobar en `npm test`. No es una compilación
nativa ni certificación de Safari/iOS o dispositivos físicos.
Procedimiento repetible: [RELEASING.md](RELEASING.md).

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
