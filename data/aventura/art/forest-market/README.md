# Arboledas, setas y balanza — 21 septiembre 2026

Arte original generado con imagegen; prompts exactos en `prompts.json`.
Los cuatro PNG de `sources/` son los másteres inmutables. `sources.json`
fija su SHA-256, celdas, tamaño nativo y ancla; `preparation.json` deja la
medición del recorte. El fondo RGB oculto del generador NO se usa: el canal
alfa se conserva y se limpia fuera del navegador.

Reconstruir: `php scripts/prepare-forest-market.php`, después
`php scripts/bake-adventure-atlas.php` y `node tools/build.cjs --reuse-art`.
No se dibujan detalles por código ni se escanea alfa al arrancar el juego.

- **Arboledas:** ocho siluetas completas, con troncos y raíces en perspectiva
  2.5D. Dos tramos horizontales, dos verticales y cuatro esquinas. Remates
  naturales; solapar moderadamente, sin un marco obligatorio. Las rocas
  anteriores no cambian. Las antiguas copas cenitales quedan como referencias
  de autoría en `../delimiters/`, fuera del atlas distribuido.
- **Setas:** boletos, rebozuelos y níscalos, cada especie con pareja y trío.
  La familia `ground-mushrooms` declara `yield.mushroom` en cada variante:
  dos visibles = dos recogidas; tres = tres. No se inventa un tipo de inventario
  por especie: todas son `mushroom`. La receta de brocheta consume cinco,
  conserva cuchillo/mechero y consume una ramita. Los trueques del almacén
  siguen usando setas; no es una moneda ni se liga al ranking del Setómetro.
- **Balanza:** avellano, bellotas y cuerda, sobre un tocón. Paquete propio,
  cargado al acercarse. Objeto `setometro-balance` junto a la taberna:
  solo reto diario y ranking mediante API, no sesiones colaborativas.

Las familias se editan en `data/aventura/element-families.json` y se
reconstruyen con `node scripts/build-woodland-kit.cjs`. El selector de variantes
`element-appearance.js` lo comparten juego, Studio y compilador. Este último
resuelve el rendimiento de las setas antes de emitir mundo y contrato del
servidor: no hay una segunda tabla de recompensas en PHP. Los IDs y bits de
recolección no cambian. Una bolsa sin espacio para todo el grupo no consume
la mata parcialmente.

El tamaño de los másteres no es el coste de descarga. Se distribuyen tres
paquetes independientes con textura 2× y reducción integrada; las fuentes
y el Studio nunca forman parte del artefacto público.

Pruebas: `check-forest-market.cjs`, `check-studio-delimiters.cjs`,
`check-studio-delimiters-browser.cjs`, `check-setometro-browser.cjs`,
Ascua y los recorridos de la receta. Las capturas de revisión están en
`.local/screenshots/` (fuera de Git).
