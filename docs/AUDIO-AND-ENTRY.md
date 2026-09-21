# Entrada, fullscreen y paisaje sonoro

Implementación del 16 de septiembre de 2026, posteriormente publicada en la web
con autorización expresa: [registro de producción](RELEASE.md).
No implica publicación en tiendas. Guía nativa: [MOBILE.md](MOBILE.md).

## Comportamiento

- El bosque real se dibuja detrás de «Explorar» / «Continuar explorando».
  No hay progreso ficticio ni descarga de música antes de ese gesto.
- «Con sonido» y «Pantalla completa» son elecciones independientes. El mute y
  la preferencia de fullscreen se conservan. Una visita nueva necesita un gesto
  nuevo: recordar una preferencia no equivale a obtener permiso del navegador.
- El clic inicia/resume audio **antes** de solicitar fullscreen, sin un `await`
  intermedio. Fullscreen puede consumir la activación transitoria.
- Fullscreen abarca `document.documentElement`: mapa, diálogos y controles.
  El botón superior izquierdo solo sirve para entrar, y desaparece mientras
  estamos dentro. Salir con los controles del sistema vuelve a mostrarlo.
- No se ofrece un botón imposible en navegadores sin Fullscreen API. En
  Capacitor se ocultan las barras del sistema mediante `SystemBars`, no mediante
  el fullscreen del navegador. No se bloquea la orientación.
- Si falla la preparación del mundo, la tarjeta muestra el error y «Reintentar»;
  no deja un botón desactivado para siempre.
- **Empotrado en la web la tarjeta no se muestra** (ver [EMBEDDING.md](EMBEDDING.md)):
  la página ya puso una puerta delante y la persona la cruzó, así que entrar es un solo
  gesto con un solo significado —el bosque, con sonido— y la pantalla completa la pide
  la página sobre su propio elemento. Bajar el bosque para y guarda, pero **no escribe
  `state.muted`**: callar por estar fuera de la vista no es elegir el mute, y escribirlo
  dejaría el botón de sonido mintiendo en la siguiente visita. Manda el sonido quien
  está en pantalla.

## Mezcla y prioridades

`WoodlandAudio` tiene un `AudioContext` y tres buses: música, ambiente y efectos,
con un master común. Las voces de contenidos siguen usando `WorldMedia` y su
elemento de audio existente: no se modifica su fichero ni su volumen.

Cuando una voz empieza, **los tres buses del juego pasan a cero**. No hay música
ni río compitiendo con la grabación. Al pausar/terminar/fallar la voz, la mezcla
vuelve suavemente. No se ha reintroducido la sección de expresiones en el juego;
el comportamiento de prioridad es común a cualquier narración que se reproduzca.

Al ocultar la pestaña o recibir `appStateChange` inactivo se pausan los streams,
el contexto, las voces y el bucle de juego; se guarda y se anula el movimiento.
La música intenta continuar al volver, sin cambiar la intención de mute.
Las voces requieren reanudación explícita. Si el navegador vuelve a exigir un
gesto, la siguiente interacción o el botón de sonido vuelve a intentarlo.
No se pide reproducción en segundo plano ni permisos de micrófono.

### Música

- Cuatro MP3, orden barajado sin repetir dentro de una vuelta ni entre sus extremos.
- Dos elementos HTMLAudio reutilizables. Se activan en el gesto inicial y se
  conectan al mezclador con `MediaElementAudioSourceNode`.
- Fundido cruzado de hasta tres segundos; la siguiente pista se prepara con
  antelación. Con red insuficiente puede haber espera: no se promete continuidad
  si el navegador no dispone del audio siguiente.
- Nunca se decodifica la playlist completa a PCM ni se crean reproductores
  nuevos por cada pista. Solo las dos pistas próximas están en los decks.
- Los errores de red no provocan un bucle de `play()` cada 200 ms; se informa y
  el botón de sonido permite reintentar.

### Río

- Una textura mono, cargada al acercarse por primera vez a agua navegable.
- Intensidad por proximidad **del personaje**, no por la cámara. En interiores
  no suena. La música se mantiene mientras no haya narración.
- Máximo del bus de río: 0,22; cambios suavizados. Ocho actualizaciones espaciales
  por segundo como máximo, con un número fijo de muestras.
- Un único buffer decodificado y un `AudioBufferSourceNode` en loop; no se
  reinicia por cada escena. Límite de descarga de 4 MB, PCM de 32 MB y reintento
  con espera. El recurso actual requiere aproximadamente 10,8 MB de PCM mono
  si el contexto funciona a 48 kHz: `decodeAudioData` remuestrea a la frecuencia
  del contexto, aunque el fichero esté codificado a 32 kHz.
- La costura del loop se prepara offline con 600 ms de fundido entre sus extremos.
  No se añade otra descarga ni se recodifica en el navegador.

Los efectos sintéticos previos de recoger/interactuar se conservan. No hay nuevos
efectos de gato o naturaleza inventados: se incorporarán cuando se aporten.

## Archivos y proceso de importación

```text
data/audio/originals/<md5>.mp3  originales intactos, fuera del artefacto web
data/audio/sources.json        procedencia, tipo y nombre original
public/assets/audio/          derivados MP3 + catálogo pequeño
tools/prepare-audio.cjs        importación/normalización reproducible
public/assets/js/adventure/
  audio.js                    fachada y mezcla
  audio/music.js              playlist y dos decks
  audio/ambience.js            proximidad y loop
  entry.js, fullscreen.js      activación y presentación
```

Se han trasladado los MP3 de `Downloads/game-music` conservando su contenido
original en `data/audio/originals`. La herramienta comprueba el MD5 de la copia
antes de retirar el fichero de entrada. No elimina la carpeta de entrada.

⛔ **LA HERRAMIENTA SE LLEVA EL FICHERO DE ENTRADA** (`--import` hace un movimiento, no
una copia, y por eso verifica el MD5 antes). Si la carpeta de origen es la de descargas
del dueño y se quiere conservar, se copia a un directorio temporal y se importa de ahí:
el resultado es el mismo y las descargas quedan intactas. Así se hicieron las 18 pistas
del 21-sep-2026.

Para añadir música (Node 22 y ffmpeg/ffprobe en PATH):

```sh
npm run audio:prepare -- --import /Users/alvarofranz/Downloads/game-music
npm run build
npm run install:local
```

Los MP3 de la raíz son melodías. De momento, el único loop con colocación semántica
definida es `sound-textures-loops/sound-loop-river.mp3`. No se asigna una textura
nueva a un lugar por adivinar su nombre. Antes de añadir mar, cueva, lluvia, etc.,
se declara su función en el catálogo y se amplía la política de ambiente.

Normalización de entrega: dos pasadas `loudnorm`; música -20 LUFS, pico verdadero
-2 dBTP, objetivo LRA 11, estéreo 44,1 kHz/128 kbit/s; río -24 LUFS,
mono 32 kHz/80 kbit/s. Los 23 derivados ocupan **64979984 bytes** (67 minutos de música).

⛔ **UNA LISTA LARGA NO CUESTA NADA AL QUE JUEGA** (21-sep-2026, al pasar de 4 a 22 pistas).
Los dos decks van con `preload="none"` y solo tienen cargadas la actual y la siguiente, así
que el navegador se descarga dos pistas haya cuatro o cuarenta: medido en producción, entrar
con el sonido puesto son dos peticiones de audio. Lo que sí crece es la RELEASE, que las lleva
todas: 62 MB de los 87 MB del artefacto. Comprimir más la música es bajar el bitrate, y eso
es una decisión de calidad, no una optimización: 128 kbit/s estéreo es el contrato de hoy.
Son objetivos de procesamiento, no promesas de medición auditiva perfecta;
escuchar y medir los nuevos archivos antes de publicarlos.

`npm run audio:prepare` reutiliza los derivados existentes. `--rebuild` los
regenera desde originales (no desde el MP3 ya comprimido). Los nombres usan el
hash del original como identidad, no títulos. El prefijo inmutable del artefacto
versiona cualquier cambio en los derivados.

La licencia general del código no debe interpretarse como autorización para
redistribuir música aportada: confirmar los derechos antes de publicar el commit
en un repositorio público o las apps en tiendas.

## Verificación

```sh
npm test
# Servidor offline de prueba; dejarlo abierto en otra terminal:
GAME_PORT=47842 node tools/preview.cjs --no-build --offline
npm run test:audio
```

`test:audio:core` cubre hashes de originales, catálogo, límites, proximidad,
playlist, guardados corruptos, prioridades y exclusión de masters del artefacto.
`test:audio` añade Chrome con política de autoplay estricta a 1440×900,
768×1024, 390×844 y 844×390: ausencia de descargas previas al clic, señal real en
un `AnalyserNode`, transición real, reproducción por el elemento de narración,
mezclador silenciado durante esa voz, pausa/reanudación de aplicación, fullscreen,
mute persistente y carga diferida del río. El fichero usado como voz es una
fixture local; no se crean ni modifican contenidos del sitio para estas pruebas.

Esto no sustituye escuchar físicamente el resultado ni probar Safari/iPhone,
Android WebView, auriculares Bluetooth, llamadas e interrupciones del SO.

Resultados medidos, artefacto y límites de publicación: [RELEASE.md](RELEASE.md).
Entrega nativa independiente: [MOBILE.md](MOBILE.md).

Referencias técnicas:
[autoplay de Chrome](https://developer.chrome.com/blog/autoplay),
[activación y fullscreen](https://fullscreen.spec.whatwg.org/),
[reutilización de elementos de audio en WebKit](https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/).
