# Movimiento, cámara y Brizno

**Registro histórico de la ronda del 14 de septiembre.** Los controles actuales
están en [SHARED-FOREST.md](SHARED-FOREST.md): se retiró rodar (incluido doble
espacio/toque y ruta larga), se conserva su arte y se corre/rema con espacio.
Caminar vuelve a centrar la cámara. No aplicar las filas de roll de abajo al runtime.

Implementación local, 14 septiembre 2026. No cambia misiones, saldos ni guardados
del usuario. La anterior elección de arte **2× integrado y animación selectiva**
ya estaba aplicada; los nuevos módulos usan el mismo pipeline, sin GIF ni
maestros en navegador. No se ha desplegado esta ronda.

## Controles

| Intención | Resultado |
| --- | --- |
| Flechas/WASD/ZQSD | Paseo a 72 unidades/s |
| Mantener Espacio + dirección | Carrera a 138 unidades/s con ocho direcciones propias |
| Dos Espacios en 320 ms | Un roll: hasta 112 unidades en 0,34 s |
| Doble toque/clic en destino | Un roll, limitado por el tramo recto disponible |
| Toque cercano | Paseo |
| Ruta ≥80 unidades | Carrera; paseo en las últimas 48 |
| Ruta ≥240 unidades | Un roll inicial si hay 112 unidades rectas; después carrera y paseo |
| Arrastrar con ratón, lápiz o un dedo | Mirar el mapa sin caminar ni interactuar |
| Mira abajo a la derecha | Volver a seguir al protagonista |
| Rueda o pellizco | Zoom de todo el mundo, limitado a la cobertura del mapa |
| Espacio en diálogo | Siguiente mensaje; Enter/Escape cierran |

El roll automático puede esperar a salir de una esquina inicial; se descarta si
quedan menos de 180 unidades. No se repite durante ese viaje. Las distancias son
de ruta en unidades lógicas: el zoom y el dispositivo no cambian la decisión.
Mantener una tecla no encadena rolls. Quieto no rueda. Se mantienen colisiones,
puertas direccionales y esfuerzo al empujar. El presupuesto de movimiento se
consume entre waypoints sin perder velocidad en dispositivos de menor frecuencia.
Los clics en suelo esquivan cuerpos sin activar diálogos ni empujes. La intención
se conserva durante el roll y cualquier desvío; el clic en objeto activa solo ese
objeto. Detalle vigente: [contrato de navegación](NAVIGATION.md).

El aterrizaje tiene una pose erguida nueva. No reproduce el agachón del maestro
antiguo al acabar. La carrera es un ciclo de cuatro poses dibujadas por dirección,
no un paseo acelerado. La hoja de roll conserva su original, pero no exporta la
última fila descartada.

La cámara libre es temporal, no parte del guardado. Arrastrar pausa el recorrido;
permanece separada hasta centrar o cambiar de escena. Un clic desde esa vista sí
puede ordenar un destino. La mira desaparece al centrar y no tapa diálogos,
fichas o modales. El umbral de arrastre es de 8 píxeles CSS. Se cancelan capturas
al perder foco; levantar el segundo dedo no dispara un toque accidental.
La misma implementación se usa con ratón y táctil.

El encuadre inicial exterior es más abierto (ajuste local del 15 de septiembre):
1,25× en móvil y tablet, 1,5× a 1440×900, 1,75× a 1920×1080 y como máximo 2×
en monitores grandes, salvo lo necesario para cubrir completamente el viewport.
`camera.js` usa el lado corto de la pantalla y pasos de 0,25, sin detectar dispositivos.
La vista automática se adapta al girar/redimensionar; tras usar rueda o pellizco
respeta la elección manual. Se conserva el acercamiento máximo anterior y los
interiores mantienen su encuadre propio. No se guarda el zoom ni se cambia la partida.
`npm run test:zoom` verifica arranque, giro, elección manual y límites hasta ultrawide.
Entrega local de este ajuste: `2138911a511a09aa53d1`, verificada en preview y DDEV.
Pasan pruebas puras, navegador general, movilidad y zoom; zoom también contra DDEV.
La partida y el workspace del Studio permanecen intactos. Sin despliegue a producción.

## Arte y composición

- Reparto aleatorio: variantes 1, 2, 4, 6, 7, 8, 10 y 11; pieles naturales claras,
  tostadas y oscuras. Ascua queda exclusivo. Remo mantiene su identidad en tierra
  y durante el viaje. El vigilante también usa una apariencia natural.
- Brizno: anciano de gran barriga, gorro musgo con bellotas, chaleco castaño,
  barba corta blanca y camisa crema. Identidad 12, fuera del reparto aleatorio.
- Brizno tiene 32 poses de reposo/paseo y 32 sentado: ocho direcciones por cuatro
  estados. El banco es arte separado, compuesto con escala y offset en `seat`.
  Los ciclos de sentado fijan botas/asiento y cambian la parte superior.
  Su paseo queda preparado y sin cargar durante el juego; no se levanta todavía.
- El paquete del picnic tiene totopos triangulares, a juego con el guacamole.
- Originales/prompts: `data/aventura/art/cast/mobility-*.json`. Se rechazaron una
  hoja con botas cortadas y un fondo ajedrezado pintado; se conservaron originales,
  generaron revisiones y prepararon recortes locales sin alterar las siluetas.

`locomotion.js` decide impulsos y ritmos; `movement.js` mueve y colisiona;
`characters.js` elige poses; `map-gestures.js` interpreta gestos;
`camera.js` calcula límites; `seating.js` compone asiento y ciclos reutilizables.
Ninguna imagen o animación concede recompensas ni cambia recetas.

## Dirección narrativa futura — no implementada

El restaurante será un proyecto que crece al alimentar a otros, no una obligación
de mantener vivo al protagonista. Ingredientes en casas humanas y huertos;
explorar pesca y caza cuando se diseñen esas mecánicas. Preparar recetas cada vez
mejores, recibir pagos y conocer a quienes disfrutan de ellas.

Brizno ofrece su terreno y ayuda para montar un restaurante si seguimos llevándole
buena comida. Más adelante fallece; el lugar crece en su honor, buscando músicos,
colocando hamacas y tiendas y reuniendo vecinos en fiestas. Sería una despedida
narrativa, no muerte del jugador ni penalización. Orden, tono y condiciones de
estos hitos pendientes de definir.

Mantener el mundo abierto y el primer enigma fácil. Cada persona puede aportar
una pequeña historia, receta, utensilio o mejora del lugar. No se han añadido
terrenos, caza, pesca, fallecimiento, construcción ni nuevas misiones en esta ronda.

## Verificación

`npm test` incluye `check-adventure-mobility.cjs`: distancias, curvas, presupuesto
20/30/60/120 Hz, prioridad de umbrales, poses y arbitraje de punteros.
`npm run test:mobility` comprueba en Chrome escritorio/tablet/móvil el arrastre
con ratón y dedo, centrado, tres distancias de viaje, Espacio mantenido/doble,
aislamiento del diálogo, reparto y carga diferida.
Capturas y trazas: `.local/mobility-review/`.

Las suites de navegador existentes comprueban además siete tamaños, seis idiomas,
interiores, límites, puertas, cocina, barco, guardado y Studio aislado.

Verificado en esta entrega: `npm test`, navegador general, movilidad (preview y
DDEV), Ascua, picnic, raster de animación (incluye las ocho orientaciones sentado),
galería y experimentos archivados. Sin errores JS en esas pruebas. La inspección
visual usa también `php scripts/review-mobility-art.php`; los fragmentos sueltos
de celdas vecinas se retiran offline antes del registro y del horneado.

Artefacto verificado al cerrar la ronda de movilidad: `0d9fa86be10f52e9e616`;
la entrega local posterior de navegación está registrada en [NAVIGATION.md](NAVIGATION.md).
711 fotogramas en 75 paquetes,
3.144.941 bytes PNG en la biblioteca completa, no en una descarga inicial única.
El Studio sigue en `http://127.0.0.1:47832`, con su workspace e historial preservados
y sin cambios de escena/crop pendientes ni conflictos al verificarlo. Ocho archivos
intermedios de horneado de esta ronda se apartaron a `.local/retired-mobility-art-lL4mMO/`,
recuperables; ningún original ni partida se ha eliminado.

La web solo recibe el artefacto local y su puntero `public/game/current.json`;
no se han cambiado sus motores PHP/API ni importado datos. No despliegue, push ni
operaciones contra producción en esta ronda.
