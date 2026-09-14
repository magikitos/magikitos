# Un bosque enorme — experimento de escala

> Archived on 14 September 2026. The current game keeps its fixed camera and approved close-scale direction. This experiment is preserved in Studio → Archivo de pruebas.

Activo, aislado del mapa y progreso del juego. Arte y código solo para Studio.
Los originales en `art/` son nuevos, generados con la herramienta integrada de
imágenes. `prompts.json` conserva los tres prompts completos. No se reutilizan
casas humanas: los habitantes se construyen viviendas con objetos encontrados.

El personaje conserva su definición y animaciones. Probamos proporciones entre
personaje, arquitectura y naturaleza, no un zoom global disfrazado de escala.
Las casas son referencias de diseño, no interiores funcionales ni misiones.

El empaquetado local se ejecuta al arrancar Studio: GD solo recorta las celdas y
reduce a tamaño de muestra, preservando el alfa generado. No modifica originales.
Los packs, la escena experimental y las preferencias no entran en el build del
juego, su monedero, su guardado ni el diff de colocaciones.
## Cómo probar

Studio → Laboratorio → Escala de duende. **Cercana / Diminuta / Minúscula**
cambian las proporciones de naturaleza y objetos encontrados, conservando el
personaje y el zoom. Los cinco botones de rincones sirven para comparar sin
caminar todo el mapa. También se puede caminar con clic o teclado, rodar, arrastrar
la cámara y usar rueda/pellizco. **Arte y escala** carga la ilustración de intención
y la galería de piezas; la ilustración no es una captura del prototipo.

No hay interiores funcionales, economía ni misiones nuevas. El experimento no
retira las casas humanas del juego: solo este escenario no las utiliza.
Cada visita conserva su estado en memoria al cambiar de pestaña; recargar lo reinicia.

## Piezas y proporciones

- `art/habitats.png`: seis viviendas — bota, tocón, hojas, seta, tronco y maceta.
- `art/nature.png`: seis elementos — raíz monumental, helecho, trébol, boleto,
  arco de raíces y setas rojas.
- `art/concept.png`: dirección artística, cargada solo en la vista de arte.
- `prompts.json`: prompts completos, generador integrado y finalidad del material.

Las viviendas se empaquetan en celdas de 192 píxeles y la vegetación en 384 para
no perder el detalle de las raíces al ampliarlas. `designSize: 192` separa esa
resolución de imagen de la geometría del escenario; dibujo e hit-test usan la
misma conversión. Las colisiones, posición y proporciones no cambian al subir
la resolución del atlas. Los originales generados no se modifican.

La escena, controles, presentación y composición visual viven en módulos
separados. Se reutilizan `World`, navegación, movimiento, volteretas, animaciones,
terreno, agua, límites de cámara y cargador de sprites del juego. No se reutiliza
su arranque ni se copia un segundo motor completo.
