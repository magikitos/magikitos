# Retratos de protagonistas

## Contrato visual

Una tarjeta ilustrada propia por protagonista, sin texto, nombre, marco dibujado
ni interfaz dentro de la imagen. El fondo evoca un rincón del juego; la figura
se reconoce inmediatamente y conserva su diseño original.

**La identidad no se regenera.** El personaje procede de la primera celda
`down / idle` de su `resident-NNN.png` original. Se elimina únicamente el matte
con el pipeline de alfa y se compone sobre un fondo individual generado con
imagegen integrado. Cara, orejas, gorro, ropa y proporciones son los píxeles
originales, con una única escala uniforme; nunca se estiran piernas o cabeza.

El primer intento de retrato completo de Mora (`portrait-01.png`) se conserva
como referencia de proceso, **no se publica**: alargaba su anatomía. Su fondo
se extrajo mediante una edición de imagen; la figura final es la original.

## Archivos y reconstrucción

Cada protagonista tiene en `data/aventura/art/playable-cast/<key>/`:

- `prompts/portrait-background.txt`: prompt exacto de su ambiente individual.
- `sources/portrait-background.png`: original generado, sin personaje.
- `review/portrait.png`: composición final de 240×320 píxeles.
- `review/portrait.json`: procedencia SHA-256, recorte, escala y destino.

```sh
php scripts/prepare-playable-portrait.php --character=mora-alba
php scripts/review-playable-portraits.php
php scripts/prepare-cast-portraits.php
node tools/build.cjs
```

La hoja de revisión `playable-cast/portraits-review.png` muestra los ocho
protagonistas, pero no los habilita por sí sola. El juego solo ofrece personajes con sus
siete acciones completas y rig de remada registrado. El retrato por sí solo
no convierte un NPC en protagonista.

## Exportación y UI

El empaquetador usa tamaño lógico 120×160 y textura 2×, con reducción integrada.
No entrega al navegador los originales de generación. Un único atlas
`cast-portraits`, inferior a 4 MiB decodificados para el elenco actual, se pide
al abrir «Yo» y se libera al cerrarlo. No se precargan las hojas de caminar de
todos los candidatos para enseñar el selector.

Medición del elenco de ocho (18-sep-2026): atlas 1024×648, **390.505 bytes PNG**,
2.654.208 bytes RGBA decodificados. Son presupuestos distintos: la descarga
comprimida no representa la memoria de la textura. El test limita esta última
a 4 MiB y comprueba que no se acumulen hojas al cambiar de personaje.

Tarjetas táctiles de más de 44 píxeles, rejilla adaptable y altura acotada con
desplazamiento. Selección visible por contorno, foco de teclado y `aria-pressed`.
Los nombres no se pintan dentro de las imágenes; las etiquetas accesibles
permanecen fuera del arte.

## Para añadir otro

1. Mantener su fuente residente original y resolver su ID en el catálogo.
2. Generar **solo** un fondo vertical 3:4: ilustración mate, entorno coherente,
   centro despejado, sin figuras ni letras. Guardar prompt y fuente en su carpeta.
3. Componer con el script; revisar rostro, gorro entero, pies, contraste y
   ausencia de deformación al tamaño real del selector, no solo ampliado.
4. Habilitarlo únicamente cuando también estén terminadas todas sus acciones.
5. Ejecutar `check-playable-cast.cjs` y `check-cast-browser.cjs`: presupuesto,
   elenco, selección persistente, liberación de atlas y tres tamaños de pantalla.

Los cien NPC originales se conservan; este sistema afecta únicamente al
retrato de los protagonistas seleccionables.
