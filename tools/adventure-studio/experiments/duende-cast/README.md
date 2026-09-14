# Duendes · laboratorio de identidad

**Archivo cerrado. Ascua elegido, los otros once duendes aprobados como vecinos.**
Esta interfaz conserva la comparación original. Su listado amplio de poses fue
sustituido por el contrato compacto de `docs/art-direction/DUENDES.md`.
Visitarla no modifica el juego ni el único workspace del Studio.

[Abrir Studio → Laboratorio → Duendes](http://127.0.0.1:47832/#experiments/duende-cast)

## Qué probar

1. Diseños: cuatro protagonistas, cada uno con dos vecinos. Pulsa la tarjeta para
   ver su familia, carácter y limitaciones. El original completo solo se descarga
   si abres su enlace.
2. En el bosque: compara el candidato con el protagonista actual y los vecinos.
   Misma altura lógica, misma composición. Cambia luz, zoom o siluetas; las cuatro
   miniaturas permiten comparar sin cambiar de pantalla. No se finge animación
   a partir de una imagen quieta.
3. Plan de poses: 46 familias agrupadas, búsqueda y descarga JSON. Las cifras son
   estimaciones de arte, no FPS. Los módulos futuros no se dibujan ni cargan ahora.

La elección de **2× integrado y movimiento selectivo** ya quedó
[documentada](../../../../docs/art-direction/DEFINITION-MOTION.md).
El [contrato de personaje y repertorio](../../../../docs/art-direction/DUENDES.md)
detalla direcciones, apoyos, herramientas, prioridades, producción y límites.

## Arte y procedencia

Generación con la herramienta integrada **image_gen**. Cuatro encargos separados:
Ascua, Zarzal, Trasto y Candil. Tres figuras originales por familia. Los nombres
son etiquetas de trabajo, no canon. No se reprodujo ningún personaje de otra saga.

- `sources/<familia>.png`: maestro original generado, preservado sin edición.
- `sources/<familia>-matte.png`: edición del generador que sustituye el fondo por
  magenta plano para preparar el recorte. Revisada visualmente; no es otra skin.
- `prompts.json`: prompts completos de generación.
- `cutout-prompts.json`: instrucción de fondo y nombres de salida originales.
- `bake.php`: usa el recorte local ya autorizado, detecta calles vacías entre las
  tres figuras, preserva cada silueta y prepara retratos de 400 px y texturas de 80 px.
  Reducción integrada, paleta de 5 bits/canal y alfa binario para la textura del
  estudio: el mismo perfil técnico comparado en Trazo y vida.
- `catalog.json`: identidad, paletas y roles. `poses.json`: única fuente de datos
  para las tarjetas y descarga del repertorio.
- El fondo oscuro de las láminas originales **no forma parte del sprite**. Los
  recortes no hacen transparentes los personajes detrás de árboles.

Los PNG de revisión y el bundle solo se escriben en
`.local/adventure-studio/experiments/duende-cast/`. No se añaden packs al juego.

## Código y carga

- `entry.js`: selección efímera, pestañas, carga y ciclo de vida.
- `preview.js`: comparación estática con Terrain/World y StudyArt compartidos
  en lectura; sin controlador, guardado, colisiones activas ni bucle de animación.
- `plan.js`: filtro y recuentos derivados del catálogo; exporta el JSON original.
- `build.cjs`: recursos locales regenerables al iniciar Studio.
- Recursos del experimento solo al entrar en su pestaña; escenas y texturas nativas
  solo al entrar en En el bosque. Las láminas maestras son explícitamente opt-in.
- La comparación conserva como máximo las 12 texturas nativas y cinco recursos
  de entorno. Dispose cancela peticiones y cierra ImageBitmaps; no hay RAF continuo.
- No hay POST, APIs del juego, localStorage, borradores, reproducción automática
  ni selección de personaje persistida. El JSON descargado no cambia nada.

Medición de esta entrega: las **12 texturas nativas suman 42.114 bytes PNG** y
138.880 bytes RGBA sin comprimir. Los 12 retratos de revisión a 400 px suman
1.283.604 bytes PNG y se solicitan según las familias consultadas; los maestros
originales se abren aparte. Estas cifras no incluyen el entorno ni el bundle y
no son una predicción del coste del futuro catálogo de animaciones.

## Verificación

Con el Studio local iniciado:

```sh
npm run test:duendes
npm run test:definition
npm run test:experiments
npm run test:gallery
```

La prueba nueva recorre seis tamaños (1440×1000, 1024×768, 768×1024, 390×844,
844×390 y 320×568), carga diferida, familias, luz/silueta, filtros, descarga y
salida/reentrada. Verifica ausencia de errores de navegador y de escrituras, más
hashes del mapa, manifiesto, artefactos instalados y workspace antes/después.

Capturas y reporte: `.local/screenshots/duende-cast/`.
Es Chrome automatizado con viewports táctiles: no sustituye pruebas físicas de
Safari/iPhone ni permite afirmar un presupuesto de batería.
