# Trazo y vida · experimento de definición y movimiento

**Cerrado: 2× integrado y animación selectiva aprobados por el usuario.** Ver la
[decisión formal](../../../../docs/art-direction/DEFINITION-MOTION.md). La prueba se
conserva como comparación histórica; el pipeline jugable aún no se ha migrado.
Juego, arte publicado, posiciones, colisiones, partida y
versión del mapa del usuario permanecen intactos. No hay despliegue ni instalación
de un artefacto nuevo del juego.

Abrir [Studio → Laboratorio → Trazo y vida](http://127.0.0.1:47832/#experiments/definition-motion).
El mismo Studio conserva Cámara libre, Escala de duende y Conversar / Acercarse
como archivo. No hay otro editor ni otra versión de mapa.

## Cómo decidir mirando

1. Empieza en **Detalle → Navaja**. El duende es una referencia del juego actual.
   A y B usan exactamente la misma escala y composición.
2. Compara **1× actual / 1× integrada**: cambia solo la preparación de imagen.
   Después compara **2× nítida / 2× integrada**. 3× muestra el coste y el límite.
3. Repite con margaritas, helecho, maceta y refugio. Mira la silueta, los detalles
   interiores y si el objeto sigue pareciendo parte del mundo del duende.
4. Pasa a **Escena**. La cortina A/B revela la misma escena, cámara y momento:
   desplázala de 0 a 100 para no confundir una zona del mapa con otra.
5. Visita **Jardín** y alterna **Quieta / Selectiva / Todo**. Observa al menos
   veinte segundos: los movimientos tienen descansos, no un balanceo continuo.
6. Arrastra **Instante congelado** para comparar la misma pose entre resoluciones.
   Pausar conserva el instante; Quieta enseña las poses de reposo.
7. En móvil/tablet estrecha, **Ajustes** abre el panel. Listo, Escape o tocar el
   escenario lo cierra. Rueda/pellizco amplían; arrastrar recorre la escena.
8. **Descargar esta combinación** produce un JSON marcado como candidato. No
   guarda una preferencia oculta, no crea borradores ni aplica cambios al mapa.

**Ver propuesta de partida** abre 2× integrada + vida selectiva a 24 fps en el
jardín. Es una hipótesis para comparar, no una decisión tomada por el agente.

## Qué se compara realmente

| Eje | A, control | Opciones de B |
| --- | --- | --- |
| Píxeles de textura | Exactos del atlas actual | 1×, 2×, 3× desde el mismo original |
| Reducción offline | Método actual | Vecino próximo o integración con GD |
| Tamaño en el mundo | Frame/anchor actuales | Exactamente iguales |
| Dibujo en pantalla | Sin suavizado | Sin suavizado también |
| Humanos, duende y suelo | Arte actual | Se mantienen para juzgar coherencia |
| Movimiento | Mismo modo e instante | Mismo modo e instante |
| Edición del juego | Ninguna | Ninguna |

Ejemplo: navaja de **48×28 unidades visuales**, textura 48×28, 96×56 o 144×84.
Una densidad distinta no debe aumentar el objeto ni mover el punto de apoyo.

La alternativa integrada usa `imagecopyresampled` **offline**; no se añade blur
al canvas. Se mantiene alfa binaria y cuantización a canales de cinco bits en
las candidatas. A se extrae del atlas, no se reconstruye: el test compara todos
sus píxeles visibles y su alfa con el juego. Las candidatas parten del original,
no de una ampliación de A. La paleta final específica del atlas actual no se
impone a las candidatas: esa compresión se evaluaría al adoptar el pipeline.

No se han generado ni rediseñado imágenes para esta prueba. Así no confundimos
una ilustración nueva con una mejor preparación del mismo recurso.

## Vida ambiental, no una carpeta llena de GIF

La palabra «GIF» describe aquí el efecto deseado, pero la animación actual del
picnic son **poses dibujadas en PNG**, controladas por el reloj del renderer.

- **Quieta:** sin gestos ni deformaciones. Sirve como referencia visual y de reposo.
- **Selectiva:** los dos humanos y tres instancias de vegetación del escenario.
  Fases independientes, pausas largas, maceta con recipiente quieto.
- **Todo:** añade flexión a toda la vegetación y una oscilación mínima a los objetos
  rígidos, incluida la casa. Es una prueba deliberada del exceso: permite juzgar
  si parecerían vivos o si el escenario parece blando/inestable.

En Detalle, Selectiva anima la planta elegida o el humano; deja quieto un cuchillo.
El protagonista de referencia nunca se deforma.

Dos técnicas quedan claramente separadas:

1. **Poses dibujadas:** se reutilizan los ocho frames actuales del picnic y su
   renderer de cuerpo inferior fijo. No se necesitan más imágenes en esta prueba.
2. **Flexión por bandas:** veinte franjas horizontales de una planta, con la base
   fija y desplazamiento máximo de 2,1 unidades en el helecho, menor en las flores.
   No descarga frames extra; cuesta llamadas de dibujo. No es una animación
   anatómica final de una hoja plegándose: para revelar el reverso o abrir una flor
   hacen falta nuevas poses o partes articuladas revisadas.

La comparación «Todo» NO permite estimar el coste de dibujar cuatro poses nuevas
para cada objeto del catálogo. Solo mide el prototipo procedural actual. No
confundir bajo peso de PNG con coste cero de dibujo o batería.

## Rendimiento y límites honestos

- Imágenes de la prueba: carga por vista/objeto y perfil, con deduplicación.
  Entrada por Detalle: únicamente navaja A, navaja B y duende de referencia.
- Conserva las imágenes de la comparación actual, cierra bitmaps descartados y
  aborta peticiones al salir. No precarga las seis variantes.
- Suelo compartido del juego, cacheado por chunks. No se recalcula por cambiar
  densidad, modo de vida, cámara o instante.
- El reloj es común; no hay un temporizador por objeto ni red por frame.
- Pausa, escena quieta y una mesa sin elementos animables dejan de repintarse
  hasta recibir un cambio. La pestaña oculta pausa; salir destruye el iframe,
  controles, observador y bitmaps.
- Movimiento reducido empieza en pausa. El botón Animar permite probarlo
  expresamente; activar esa preferencia durante la visita vuelve a pausar.
- 12/24/30/60 son objetivos de actualización visual, no cantidad de poses dibujadas.
  El panel enseña la cadencia observada y trabajo JS p95 del dibujo, no tiempo GPU.
- DPR limitado a 2 en esta prueba. Los tamaños de viewport automatizados no
  sustituyen Safari iOS ni un Android físico de gama modesta.

Los PNG se exportan como RGBA sin pérdida para esta comparación. El presupuesto
NO predice cuánto pesaría un atlas de producción optimizado con otra compresión.
La estimación RGBA es ancho × alto × 4: no incluye GPU, duplicados internos del
navegador, buffers del canvas, HTML/CSS/JS ni el editor Mapa que contiene la prueba.
La comparación A/B repinta dos veces.

### Medición local y comprobaciones — 14 de septiembre de 2026

Biblioteca completa de **25 imágenes** de esta prueba, incluidos los humanos y
el duende que no cambian de densidad:

| Perfil | PNG | RGBA estimada |
| --- | ---: | ---: |
| Actual 1× | 275,0 KiB | 0,74 MiB |
| Integrada 2× | 475,5 KiB | 2,14 MiB |
| Integrada 3× | 807,8 KiB | 4,48 MiB |

No se descarga esa biblioteca al abrir: la mesa inicial de la navaja pide solo
tres PNG (A, B y duende), **6.843 bytes en total**. Son bytes de imágenes, no el
peso completo del Studio ni un presupuesto del juego entero. El manifiesto generado
registra cada archivo; `budget.json` registra el JS y su tamaño gzip calculado.

Pruebas automatizadas en Chrome: 1440×1000, 1024×768, 768×1024, 390×844,
844×390 y 320×568. Se comprueban píxeles de A, huella constante, cambios reales
de píxeles al mover vegetación, rueda, arrastre, pinch de dos contactos, pausa,
exportación, movimiento reducido, recuperación de un PNG fallido y cambios rápidos
de perfil sin acumular bitmaps. Los controles quedan fuera de la imagen comparada.

También se revisan la galería/editor y el acceso a experimentos archivados.
Los hashes del workspace del usuario, escenas y artefacto del juego deben permanecer
idénticos antes y después. Las capturas se han revisado visualmente; **no se ha
probado en dispositivos físicos**. Las cadencias de una pasada corta de Chrome
son una comprobación funcional, no un benchmark de batería ni garantía móvil.

## Validación técnica pendiente al migrar

La densidad 2×, reducción integrada y movimiento selectivo están elegidos. Antes
de aplicarlos al juego, validar y fijar los detalles de producción:

- Excepciones justificadas por familia y máximo de zoom de referencia.
- Método de preparación, alfa, paleta y compresión.
- `logicalSize`, `anchor` y cuerpos en unidades del mundo; `pixelRatio` y rectángulo
  del atlas en píxeles de textura. El Studio debe convertir entre ambos sin mezclar
  recorte, tamaño físico y colisión.
- Tipo de movimiento por recurso: ninguno, poses, parte articulada, viento o partícula.
- Periodo, pausas, amplitud, semilla de fase por instancia y pose de movimiento reducido.
- Política por zona y por distancia: animar solo lo visible, priorizar gestos relevantes,
  impedir que decorado móvil parezca señal de interacción.
- Presupuesto de transferencia, memoria, dibujo y prueba en dispositivos físicos.

La elección aprobada mantiene los objetos rígidos quietos. El movimiento debe
sugerir una causa —viento, conversación, agua, fuego— y dejar descansos. Revisar
también el conjunto, legibilidad del protagonista y sesiones largas al integrarlo.

Una adopción exige adaptar y probar el renderer compartido, iconos, picking,
recortes de Studio, anclajes de animación, colisiones y empaquetado. Este experimento
no introduce campos experimentales en el contrato del juego.

## Código y pruebas

- `assets.json`: selección del catálogo y seis perfiles.
- `bake.php`: lectura del arte actual, preparación aislada y registro de bytes.
- `art.js`: densidad desacoplada, carga/caché de texturas y frames lógicos.
- `motion.js`: activación selectiva y flexión experimental; reutiliza las poses del picnic.
- `scene.js`: composición de prueba, no una escena del juego.
- `runtime.js`: dos formas de comparar, cámara, reloj, pausa, métricas y lifecycle.
- `entry.js`, `index.html`, `style.css`: controles adaptables y exportación de candidato.
- Salida generada únicamente en `.local/adventure-studio/experiments/definition-motion/`.

```sh
npm run studio
npm run test:definition
npm run test:gallery
```

`test:definition` necesita el Studio local encendido. Comprueba los píxeles de A,
densidades/anclajes, cambios de perfil, cámara y pinch, pausa, movimiento reducido,
exportación, salida/reentrada y hashes de los archivos del juego y workspace.
Capturas y mediciones quedan en `.local/screenshots/definition-motion/`.

## Referencias técnicas

El filtro de escalado del canvas se controla independientemente del tamaño del
sprite: [MDN · imageSmoothingEnabled](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/imageSmoothingEnabled).
Se mantiene desactivado en ambos lados para comparar la textura.

La planificación de repintado se coordina con el navegador mediante
[requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame);
la prueba añade su propio límite de cadencia y pausa explícita.

La preferencia del sistema se consulta con
[prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion).
La caché del suelo y la separación de trabajo estático siguen las recomendaciones de
[optimización de canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas).
