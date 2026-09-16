# Revisión del núcleo — 13/09/2026

Desarrollo local en DDEV. Sin despliegues, importaciones, consultas a producción,
pagos reales ni cambios de saldo de cuentas.

## Tres pasadas

1. **Contratos y limpieza.** Una clave de guardado, sin versiones de partida,
   búsqueda de registros anteriores, compensación de premios ni recetas retiradas.
   `geometry.js`, `placement.js` y `navigation.js` separan responsabilidades
   que antes estaban juntas en el modelo. Las reglas siguen siendo datos y
   propuestas atómicas; el motor económico no conoce IDs de misiones.
2. **Geografía y composición.** Fuente ampliada de 66×58 a 80×70 px, en su
   centro verde rodeado de caminos; conexión a la casita y pequeños grupos de
   vegetación. El lago deja de ser una elipse rodeable: costa continua hasta los
   bordes del escenario. Reubicados casita del pescador, banco, juncos y vecino.
   Hogueras, interiores, embarcadero y conjunto revisados también en imágenes.
3. **Regresión e integración.** Huella común de protagonista y vecinos, margen
   de orilla, segmentos de A* seguros y entradas laterales. Catálogo de textos
   plano: etiquetas y frases distintas, conversaciones abreviadas y español
   andaluz cercano. Otros idiomas con bromas adaptadas. Cierre «Ok», páginas
   adicionales explícitas y acciones con nombres propios.

La revisión encontró y corrigió nombres/frases que se pisaban, un acceso sin
camino a la casita, y dos fixtures que debían adaptarse a los nuevos cuerpos.
No se han debilitado las colisiones para hacer pasar las pruebas.

## Evidencias reproducibles

`bash scripts/build-world.sh` ejecuta contratos PHP, JavaScript, traducciones,
reglas, activos, controles, geografía y necesidades.

- **84 recorridos** de colocaciones transitables; spawns, destinos y umbrales.
- **34.243 posiciones** secas comprobadas en los exteriores; toda la suela en tierra.
- Diagonales y volteretas contra costas, puertas por ambos lados y barco no gratuito.
- Recogida en cualquier orden, premios únicos, vuelta cubierta y transacciones atómicas.
- Un solo registro de guardado y monedero que no inventa saldo al validar.
- Seis catálogos completos, etiquetas/pistas referenciadas y tokens coincidentes.
- **293 sprites / 25 paquetes**, 233.090 bytes de PNG; 50 derivados públicos,
  ningún archivo huérfano. Los hashes son identidad de contenido para caché,
  no una capa de compatibilidad.

Suites de navegador local:

```sh
node scripts/check-world.cjs
node scripts/check-world-controls.cjs
node scripts/check-world-life.cjs
```

Cubren web normal independiente, contenido real local, búsqueda, regiones,
audio, carrito, cancelación de solicitudes, seis idiomas, teclado y eventos
táctiles, escritorio/tablet/móvil vertical y horizontal, y movimiento reducido.
También ambas necesidades, las animaciones, consumo al terminar, interrupciones,
los dos trayectos visibles y saldo 10 → 5 → 0. Sin errores PHP o JavaScript detectados.

Capturas de esta pasada, temporales:

- `/var/folders/t3/5frkk18s0jg3tmsx2rx10w280000gn/T/magikitos-local-puzzles-pcUprr`
- `/var/folders/t3/5frkk18s0jg3tmsx2rx10w280000gn/T/magikitos-controls-fywzg2`
- `/var/folders/t3/5frkk18s0jg3tmsx2rx10w280000gn/T/magikitos-life-K2y15M`

La máscara navegable se calcula una vez, no cada vez que cambia el inventario.
En una medición local orientativa, refrescar ocupación pasó de unos 34 ms a 0,05 ms,
y una ruta larga de unos 135 a 37 ms tras evitar sondeos de agua lejos de orillas.
No son garantías para todos los dispositivos ni un benchmark de producción.

## Partida personal y recuperación

Se trasladó puntualmente la partida de Chrome al registro `magikitos.adventure`,
fuera del código de la aplicación. Se verificó después de recargar que posición,
banderas, inventario, saldo, necesidades y traza permanecían iguales.
Solo se quitaron los campos de formato del prototipo; no se regeneraron plazos.
Los tres registros antiguos ya no están en localStorage; solo queda el actual.

Copia recuperable de la partida y los dos derivados de la fuente sustituida:
`/tmp/magikitos-fountain-review.68A5e0/`.
La partida está en `session-before-cleanup.json`; los otros dos prototipos anteriores
están en `older-prototype-saves.json`. No restaurar esas copias sobre progreso
posterior sin comparar antes. Los originales artísticos siguen en el repositorio.
Las carpetas temporales no son copias de seguridad permanentes.

## Límites honestos

Listo para seguir probándolo localmente, no certificado para publicar.
Faltan pruebas con Safari/iOS físico, dispositivos modestos reales, revisión de
seguridad/integraciones y una pasada editorial nativa por idioma antes del lanzamiento.
No se han ejecutado pagos, envíos, correo o IA externos. El monedero y el progreso
siguen siendo locales y manipulables, no autoritativos.

La expansión debe conservar estos límites: más contenido mediante datos y módulos;
cuando haya decenas de escenas, cargar también geometría por escena, no entregar
todo el futuro mapa en el HTML. No hace falta introducir ahora un lenguaje de
scripting general ni una arquitectura multijugador.

## Ideas a largo plazo — no implementadas

1. **La fuente con hipo.** Algo atasca el surtidor: investigar el ruido, conseguir
   una herramienta prestada y sacar una bellota. El agua y los vecinos cambian
   de reacción al resolverlo. Una consecuencia visible en un sitio ya reconocible.
2. **El gorro que se llevó el viento.** Recuperarlo con una caña y una cuerda;
   después el vecino luce el gorro y recuerda el favor. Resolver por observación,
   no por una marca flotante ni una lista obligatoria.
3. **Un cartel muy mal colocado.** Travesura opcional junto al «prohibido cagar»:
   un vecino se indigna, otro se ríe, y ayudar a limpiar abre una segunda salida
   cómica. Nada importante exige esperar a una necesidad real ni molestar a otros.
4. **Las luciérnagas chivatas.** Un sendero nocturno se revela siguiendo su ritmo
   o escuchando una pista junto al fuego. Alternativa visual al sonido y sin
   ventanas de horario que obliguen a conectarse a una hora concreta.
5. **Correos de bolsillo.** Entregar objetos pequeños entre zonas y descubrir
   destinatarios por sus conversaciones. Dos encargos pueden resolverse juntos,
   sin convertir cada paseo en trabajo repetitivo.
6. **La casa humana como mundo gigante.** Una ruta entre costuras, cajones y
   cuerdas desbloquea un atajo permanente. Reutilizar verbos de herramientas,
   no crear una excepción del motor por mueble.
7. **Fiestas del pueblo en diferido.** El reparto cuenta aportaciones públicas
   seleccionadas con content pulse; decoración y conversaciones cambian con un
   evento publicado. Sin simular presencia online ni recargar continuamente.
8. **Una economía de pequeñas alegrías.** Setines para viajes, gorros o detalles
   de una casita, con fuentes y gastos equilibrados. Nunca bloquear el regreso
   ni pagar recompensas reales basándose en el guardado del navegador.

Mi orden sería: una consecuencia visible en la fuente, un enigma reutilizable
de herramientas y un atajo; después ampliar otra zona. Dar más significado a los
lugares existentes antes de llenar el mundo de recados.
