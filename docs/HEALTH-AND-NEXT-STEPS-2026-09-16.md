# Salud del juego y próximos pasos

Revisión acotada del 16 de septiembre de 2026 tras adaptar los controles táctiles.
No equivale a una auditoría exhaustiva de seguridad, todos los módulos PHP ni
certificación de dispositivos físicos. El registro de publicación está en
[RELEASE-TOUCH-2026-09-16.md](RELEASE-TOUCH-2026-09-16.md).

## Diagnóstico

La base funciona y permite seguir iterando sin rehacer el motor. La separación
entre repos es real: juego/Studio/arte en el público; identidad, API, DB y web
normal en el privado. Los dos contratos OpenAPI coinciden, versión 2026-09-16.
La prueba de frontera comprueba que no haya una copia del motor en la web y que
el juego arranque, se mueva y recupere estado sin web/API. Los contenidos públicos
enriquecen el juego, no son el requisito para arrancarlo.

Los nuevos controles se han dividido en dos responsabilidades:

- `input-modality.js`: capacidades iniciales y elección dinámica según entrada.
- `world-controls.js`: dirección, captura del dedo y turbo asociado a esa dirección.

No hay UA sniffing, elección de dispositivo persistida, eventos nuevos de
analítica, llamadas API por movimiento ni imágenes adicionales. La detección
no añade trabajo al bucle de render: la presentación cambia solo al cambiar el
modo. Las reglas de navegación, colisión, misión, economía y guardado no cambian.
El joystick y el turbo llegan ocultos en HTML, también antes de ejecutar JS.

Estimación: `pointer: coarse`, sin `any-pointer: fine`, con `maxTouchPoints > 0`.
Después manda el uso real y se puede alternar cuantas veces haga falta. Toque:
mostrar. Ratón/lápiz o teclado de juego: ocultar. El ratón que se mueve mientras
hay dedos apoyados no corta el gesto; escribir/componer en formularios tampoco
oculta los controles. El recentrado no depende de que el joystick esté visible.
El turbo se cancela y desaparece al soltar dirección, cancelar o entrar en la zona
muerta, aunque el otro dedo siguiera pulsándolo.

Esto es una selección de interfaz, no una detección infalible de hardware. Los
estándares distinguen [puntero principal y punteros disponibles](https://www.w3.org/TR/mediaqueries-4/#pointer)
y [Pointer Events frente a eventos de ratón de compatibilidad](https://www.w3.org/TR/pointerevents3/).
No se confía en `ontouchstart` ni en listeners de un solo uso.

## Evidencia y límites

Pasaron la suite completa de núcleo/arte y las regresiones de controles, rutas,
los once muelles, escenas, siete tamaños, seis idiomas y Studio aislado. La suite
específica comprueba arranque sin destello, escritorio sin táctil, móvil/tablet,
híbrido simulado, cambios repetidos, dos dedos, cancelación, pérdida de foco,
teclado de formulario y recentrado sin joystick. En producción se repiten pruebas
de comportamiento con perfiles nuevos y se bloquean escrituras de red.

Los perfiles híbridos combinan eventos reales del navegador automatizado con
consultas de capacidades simuladas: no son pruebas en un Surface físico.
Falta una pasada física en Safari iPhone/iPad, Android y equipo táctil con ratón,
incluyendo rotación, teclado externo, cambio de aplicación y conexión/desconexión
de periféricos. Tampoco se debe presentar el rendimiento de Chrome de escritorio
emulando una pantalla pequeña como rendimiento medido de un móvil económico.

## Mantenimiento pendiente

1. **Un aviso bajo en la herramienta de compilación.** `npm audit` señala
   `esbuild` 0.27.4, sin avisos moderados/altos/críticos en este resultado. El
   [aviso del mantenedor](https://github.com/evanw/esbuild/security/advisories/GHSA-g7r4-m6w7-qqqr)
   afecta al servidor de desarrollo de esbuild en Windows y está corregido desde
   0.28.1. En este repo esbuild se invoca para compilar, no con su servidor
   `--serve`; el VPS sirve artefactos estáticos y no recibe esta dependencia.
   No he mezclado una actualización de herramientas con la corrección de entrada.
   Próximo cambio de mantenimiento: actualizar versión fijada/lockfile, reconstruir
   juego y Studio, comparar artefactos y pasar las regresiones antes de publicar.
2. **Auditoría PHP no renovada.** El CLI de DDEV/Docker quedó esperando tanto con
   `ddev exec composer audit` como con una ejecución Docker directa acotada a 30 s.
   Se cancelaron esos diagnósticos; no se reinició Docker ni se tocaron volúmenes.
   La web local por HTTP sí responde y la frontera estática/API pasa. Esto no
   permite afirmar que las dependencias Composer estén libres de avisos: hay que
   recuperar el canal CLI y repetir la auditoría de su lockfile.
3. **Automatización de la calidad.** No hay workflows versionados en `.github/`
   de ninguno de los dos repos. Hay pruebas ejecutables, pero no he verificado
   un servicio externo de CI. Conviene hacer obligatorios build + núcleo +
   entrada táctil/híbrida + contrato API + verificación del artefacto antes de
   activar un puntero. Las pruebas de backend deben usar una DB aislada, nunca
   usuarios de producción como fixtures.

## Orden recomendado de trabajo

### 1. Cerrar una base de controles medible

Primero la matriz física anterior y el mantenimiento de dependencias/CLI/CI.
Medir tiempos de cuadro, memoria y respuesta durante un recorrido que incluya
bosque, captura del gato, río, desembarco y construcción; también después de diez
minutos, no solo recién cargado. Si aparece un problema, corregir ese caso antes
de sumar más controles o animaciones. Mantener este comportamiento como contrato
de UX para las siguientes aventuras.

### 2. Una aventura completa que mejore el bosque

Mi candidata es **la primera farolita**: recuperar una bombillita de una zona humana
aprovechando cobertura/macetas/gatos ya existentes, llevarla al inventor, aprender
una familia pequeña de iluminación y recibir la primera pieza. Colocarla en un
rincón común debe cambiar visiblemente ese lugar de noche y ofrecer a los NPC
una actividad social. El conocimiento se gana individualmente; disfrutar de la
farola de otro no completa tu aventura. Reutilizar recetas, inventario, anclajes y
capacidades existentes, sin otro controlador de misiones por objeto.

La entrega se considera completa cuando un jugador nuevo entiende el objetivo,
puede recuperarse de cada fallo sin vidas, termina sin farmear y ve una consecuencia
bonita que sigue allí al volver. No empezar por diez familias de recetas.

### 3. Dar intención a un tramo grande del río

Diseñar un recorrido con remanso inicial, corriente claramente visible, una ruta
segura y un desvío opcional con recompensa visual/material. El retroceso debe ser
legible antes de sufrirlo; el turbo no sustituye la lectura del río. Verificar
entrada/salida, continuidad de márgenes y desembarcos, y medir cuánto tarda en
reintentarse una equivocación. Hacer memorable una región antes de añadir cinco
regiones parecidas.

### 4. Construir con consecuencias visibles, no con menús más grandes

Pulir el ciclo elegir → previsualizar → entender por qué encaja/no encaja →
confirmar → ver a un NPC utilizarlo. Un banco, una farola y un pequeño jardín
permiten probar casi todo sin llenar la paleta de objetos indistinguibles.
Mantener las actividades NPC locales y acotadas: no deben fabricar reputación ni
materiales por mandar supuestas interacciones desde el navegador.

No abriría todavía el desmontaje de construcciones ajenas. Antes hacen falta
restauración operativa, límites y trazabilidad demostrados, señales sociales
resistentes al abuso y una política clara de patrimonio. El cliente solo propone;
el servidor sigue siendo la autoridad. No ampliaría el reparto de cien NPC ni
sus poses hasta que estas aventuras demuestren cuáles hacen falta de verdad.
