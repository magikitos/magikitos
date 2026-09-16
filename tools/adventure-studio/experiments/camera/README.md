# Cámara libre · experimento local

> Archived on 14 September 2026. The current game keeps its fixed camera and approved close-scale direction. This experiment is preserved in Studio → Archivo de pruebas.

Abrir **Studio → Laboratorio → Cámara libre**:
http://127.0.0.1:47832/#experiments/camera

Ejecutar desde el repositorio del juego:

```sh
npm ci
npm run studio
npm run test:camera
```

No es una migración del juego. No modifica escenas, sprites publicados, partidas,
economía, API ni la versión del estudio. No hay nada que publicar o aplicar al mapa.
El experimento anterior de escala y el archivo Conversar / Acercarse siguen accesibles.

## Las tres alternativas

| Variante                | Qué estás viendo                                                 | Qué resuelve                                                                                | Límite principal                                                                               |
| ----------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| A · Bosque ilustrado    | Terreno 3D y arte actual sobre planos orientados hacia la cámara | Conserva las ilustraciones y añade perspectiva, giro y desnivel con poco arte nuevo         | Las casas y árboles no tienen trasera; una lámina sigue enseñando la misma cara                |
| B · Volumen + pixel art | Entorno modelado y duendes con los ocho ángulos actuales         | Laterales, traseras, solapamientos y alturas reales, conservando la identidad del personaje | El personaje sigue siendo una imagen; los ángulos muy bajos o muy altos revelan esa diferencia |
| C · Pequeña maqueta     | Entorno y personajes con geometría real                          | Libertad de cámara también alrededor del cuerpo, orejas, gorro y mochila                    | Hace falta diseñar/modelar/animar el elenco; estos personajes son una maqueta, no arte final   |

Las tres comparten ubicación, cámara, recorridos, escala aproximada y colisiones.
Cambiar A/B/C no reposiciona al duende ni la cámara. El puente y la escalera son
geometría común, también en A: no hay un puente invisible al cambiar de estilo.

### Mi recomendación

**B es la primera candidata a desarrollar**, si gusta al probarla. Mantiene los
personajes que ya funcionan y permite construir un bosque con volumen. Para jugar
a diario empezaría con una inclinación cómoda y un botón de reencuadre; dejaría la
vista muy baja como exploración opcional. C gana si la prioridad absoluta es mirar
todo desde cualquier ángulo, aceptando una nueva dirección artística.

A no es una forma honesta de prometer 3D completo sin rehacer arte: demuestra
precisamente el efecto de las láminas. Puede funcionar con giro/inclinación
contenidos, pero no crea información que una ilustración no tiene.

La cámara en sí ya es viable en este prototipo. **El trabajo importante de una
adopción sería el mundo y sus sistemas**, no añadir una transformación al canvas:

1. Decidir estilo y ángulos jugables; cerrar un pequeño kit de árboles, setas,
   viviendas y personaje antes de convertir el resto.
2. Un renderer 3D independiente del estado/reglas/API actuales. Añadir catálogo
   de modelos, niveles de detalle, anclajes, alturas y picking 3D en Studio.
3. Migrar una sola escena completa: interacciones, recogidas, puertas, interiores,
   barco, colisiones y superposición de UI. Resolver cámara contra paredes/copas,
   visibilidad del protagonista y entradas táctiles cuando hay paneles.
4. Probar en dispositivos reales de gama modesta y Safari iOS, fijando presupuestos
   de transferencia, memoria gráfica, batería y tiempo de frame.
5. Ampliar por zonas, con paquetes descargados al aproximarse y liberación de
   recursos al alejarse. No cargar el mundo completo de golpe.

A es el camino de menor esfuerzo artístico; B es una conversión de renderizado
y entorno de alcance considerable; C añade además un pipeline de personajes y
animaciones. No son simples interruptores para el juego actual. Este experimento
no permite dar un plazo serio para toda esa conversión.

## Cómo comparar

- Arrastra con ratón o un dedo: giro completo e inclinación de **18° a 82°**.
- Rueda o pellizco: acercar/alejar. Los dos gestos se admiten sin detectar dispositivo.
- Toca el suelo para andar. WASD/flechas usan la orientación de la cámara; Q/E giran.
- Clásica / Bajita / Desde arriba cambian la inclinación.
- Perspectiva u ortográfica, con encuadre aproximadamente conservado al cambiar.
- Plaza / Puente / Mirador recolocan al personaje para comparar rápido.
- En Mirador se puede bajar por una escalera; el agua y los laterales del desnivel
  bloquean el paso.
- Girar activa una órbita de inspección. No se activa automáticamente.
- En pantallas estrechas, Ajustes abre el panel; Listo, Escape o tocar el escenario
  lo cierra. El escenario sigue usando el espacio disponible.

## Qué cuesta ahora, medido

Prueba de Chrome headless local, septiembre de 2026:

- Bundle independiente: aproximadamente **641 KiB sin comprimir**.
- El mismo JS comprimido con gzip: aproximadamente **169 KiB**.
  Studio sirve los archivos sin gzip; esa segunda cifra es una medición de build,
  no el tráfico real del servidor local.
- B/C arrancan con **35 KiB de PNG** de los actores. El entorno se genera con
  geometría en el navegador; no hay modelos ni texturas pesadas que descargar.
- Visitar A lleva los PNG acumulados a **288 KiB**. No se piden esos props antes.
- El suelo se rasteriza una vez en 1024×1024, por pequeñas tandas, reutilizando el
  material del juego. Eso evita transferencia, pero **sí cuesta CPU y memoria**.
- Un encuadre de B ronda 27.000 triángulos / 50 llamadas de dibujo; C ronda 30.000
  triángulos / 80 llamadas. Varía con encuadre, variante, sombras y calidad.
- La prueba local registra aproximadamente 16,7 ms entre frames y alrededor de
  0,6 ms de trabajo JS en el bucle. No son mediciones GPU ni garantías de 60 fps
  en móviles. No extrapolar este Mac a un teléfono.
- La UI muestra PNG acumulados solicitados (no memoria GPU) y estadísticas de
  dibujo. No incluye el coste del editor Mapa, HTML/CSS, metadatos JSON o HTTP.
  El editor sigue siendo una herramienta local, no el contenedor del futuro juego.

La densidad se limita a 1,5×; Modo ligero usa 1× y desactiva sombras.
Las sombras del entorno se calculan al cambiar la variante/calidad, no cada frame.
La geometría estática se agrupa por material. No hay reflejos de agua, posprocesado,
física de fluidos, luces por objeto, telemetría ni red por frame.

La pestaña oculta pausa el bucle. Salir del experimento destruye su contexto,
aborta peticiones, suelta eventos y libera geometrías/materiales/texturas. Reabrir
empieza limpio. Los PNG se reutilizan dentro de una visita; no hay caché persistente
ni escritura en localStorage/IndexedDB.

## Límites deliberados

- Terreno 2D con un campo de alturas: no permite dos superficies caminables
  superpuestas, caminar debajo del puente ni interiores apilados.
- Colliders simplificados de bases. No hay física 3D, saltos, cámara anticolisión,
  cutaways de tejados ni garantía de que una copa no oculte al protagonista.
- Las casas son exteriores de muestra, no puertas funcionales.
- El fondo continúa en una pradera con niebla para no enseñar bordes negros:
  no es una ampliación del mapa ni terreno navegable infinito.
- A usa billboards orientados a cámara; B usa sprites de ocho direcciones
  recalculadas respecto a ella. El personaje C mueve las piernas con la distancia
  recorrida, pero no pretende sustituir todavía la animación final.
- WebGL 2 es obligatorio para este renderer. Si falta, aparece una explicación
  y la posibilidad de reintentar; no se cambia el renderer del juego.
- Las cinco resoluciones automatizadas **no equivalen a cinco dispositivos**.
  Safari/iOS, Android físico, ahorro de batería y sesiones largas quedan pendientes
  antes de adoptar una variante.

## Módulos y aislamiento

- `config.js`: variantes, props, vecinos, caminos, colliders, destinos y alturas.
- `models.js`: kit geométrico reutilizable; agrupación de mallas por material.
- `terrain.js`: material de suelo y superficies sobre las que caminar/tocar.
- `art.js`: carga diferida de paquetes nativos, UV, anclajes y poses.
- `controls.js`: órbita, rueda/pellizco, distinguir toque de arrastre y teclado.
- `runtime.js`: renderer/cámara, navegación compartida, animación y ciclo de vida.
- `entry.js`, `index.html`, `style.css`: UI de comparación, sin reglas del juego.
- `build.cjs`: bundle separado, copia local de los packs necesarios y presupuesto.
  Su salida va a `.local/adventure-studio/experiments/camera/`.

Three.js está fijado como dependencia **de desarrollo**. No se importa en el bundle
principal de Studio ni en el del juego. El iframe usa código local de confianza:
aísla DOM y ciclo de vida, **no es una barrera de seguridad contra código malicioso**.
El servidor restringe recursos a loopback, rutas locales y CSP; el experimento no
llama a endpoints de escritura. La revisión de mapa conserva su flujo habitual.

## Pruebas

`npm run test:camera` usa un Studio temporal en el puerto 47846, nunca la versión
guardada del usuario. Comprueba rutas y recorrido real por la escalera, tres modos,
carga diferida, teclado relativo, toque/arrastre/pellizco nativo de Chrome, zoom y
proyección, cinco viewports, error sin WebGL, carreras al cambiar de modo y
destrucción/reentrada. Compara hashes de datos, workspace y artefacto instalado.

Las capturas y mediciones se guardan en `.local/screenshots/camera/`.
También se han comprobado las suites de escala/archivo y edición de caminos de
Studio, además de los checks de núcleo, Studio y cámara del juego existente.

## Referencias técnicas

- [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html):
  requisitos WebGL 2, estadísticas y liberación de recursos.
- [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html):
  órbita, límites, ratón y tacto.
- [Licencia MIT de Three.js](https://github.com/mrdoob/three.js/blob/dev/LICENSE).
  El build conserva los avisos y copia la licencia completa junto al bundle.
