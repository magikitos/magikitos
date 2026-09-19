# Contrato de datos y extensión del mundo

## Fuentes y responsabilidades

| Fuente | Función |
| --- | --- |
| catalog.json | Objetos, banderas, plazos, zonas de contenido y economía |
| scenes/*.json | Geometría y colocaciones en tiles de 16 px |
| behaviors/*.json | Reacciones, acciones y visuales reutilizables |
| resource-nodes.json | Identidad persistente de recogibles por región/ciclo |
| element-families.json + art/* | Familias, variantes y maestros de arte |
| assets/*.json | Tamaños, anclas, recortes y frames por paquete |
| locales/*.json | Un catálogo por cada uno de los seis idiomas |
| construction.json | Requisitos, costes, huellas, capacidades y zonas comunes |
| world.php | Compilación offline, composición y validación |
| tools/game-contract.cjs | Contrato de datos que instala y valida la API privada |

`elements.json` y `residents.json` son derivados. Cambiar familias en su fuente y
ejecutar `npm run art:catalog`; también las familias de río y recogibles pertenecen
a esa fuente. El catálogo no puede perder entradas al regenerarse.

## Reacciones como datos

Una colocación referencia un comportamiento, sin copiar sus reglas:

```json
{"id":"picnic-neighbor","behavior":"picnic-neighbor","x":22.5,"y":71}
```

Las reglas se evalúan en orden: gana la primera compatible. Acción predeterminada:
`interact`; `action` admite una cadena o varias. Condiciones compartidas:
`flags`, mínimos `items`, máximos `maxItems`, `timers`, `using`,
`navigation`, `landing` y `funds`. Visibilidad, variantes y acciones usan
la misma gramática. Una cantidad máxima cero expresa ausencia.

Efectos de estado: `item`, `flag`, `collect`, `reward`, `spend`,
`timer`, `keepsake`. Presentación: `dialogue`, `sound`, `travel`,
`content`, `presentation`. `rules.js` propone un estado sin mutar el original:
no inventar saldos, exceder capacidad ni consumir herramientas reutilizables.
Las presentaciones no son una segunda fuente de inventario. Viajes preparan sus
recursos antes de confirmar; recoger oculta el original mientras se presenta.

Una frase = string; varias páginas = array explícito. Seis idiomas, claves y tokens
coherentes. Reutilizar comportamientos, nunca ramas por ID de misión en el motor.

## Recogibles en el Studio

Galería → **Recogibles** ofrece **Palo recogible**, **Planta culilimpia** y
**Botella tirada**. Colocar, mover, escalar dentro de los límites, guardar; después
el agente revisa `npm run studio:diff`. No es una edición del juego en vivo.

Al incorporar un recogible nuevo desde el diff:

1. Copiar la colocación propuesta con su ID y referencia `behavior`, sin añadir
   `rules: []`: esa lista vacía anularía el comportamiento.
2. Para palos, añadir su ID **al final** de `resource-nodes.json[scene].nodes`
   (crear la región si no existe, `renewMs: 86400000`).
3. Para plantas, añadirlo al final de `harvest-SCENE-120000.nodes` con
   `renewMs: 120000`. Se conservan visibles durante su reposo.
4. No reordenar/reutilizar índices ni borrar las entradas del registro al retirar
   una colocación: los guardados compactan cada recogida en un bit. El registro
   reserva su significado; no crea objetos en el mapa.
5. Compilar y probar acceso, repetición, saco lleno, recarga y ambos contratos.
   El compilador rechaza recogibles sin registro. `check-pickups.cjs` comprueba
   el recorrido real propuesta Studio → compilación → cliente/API en una copia aislada.

La familia de botellas usa disponibilidad por inventario: no aparece si hay
botella o barca. La colocación del picnic añade `flags.skewerCooked: true` en
`visibleWhen`: solo aparece cuando se han marchado los humanos. Esa condición
se exporta al contrato autoritativo, no es un mero ocultamiento gráfico.
La recogida publicada conserva su ID estable `picnic-bin` aunque ahora representa
la botella en el suelo. La papelera física es `picnic-trash-bin` y nunca da botín.
Esto mantiene válidos los comandos pendientes sin migrar partidas.

Los palos retirados conservan un comando terminal vacío **solo en el contrato de
autoridad**: la API devuelve `no_material_action`, sin conceder recursos. Así una
cola offline anterior puede continuar. No se conservan entidades invisibles ni
fuentes de farmeo retiradas en el mundo. Los recursos ya confirmados no se borran.

Inventario = cantidades; recogidas = bitsets por ciclo; no instancias de cada palo
en el saco. La hora del servidor manda al sincronizar. Reglas de seguridad,
reintentos y recuperación: [../../docs/API.md#save-protocol-and-server-authority](../../docs/API.md#save-protocol-and-server-authority).

## Geometría, arte y guardado

Render, selección y colisión comparten ancla, escala y huella. Recortar transparencia
no cambia el cuerpo; escalar una instancia transforma dibujo y cuerpo conjuntamente.
Las puertas derivan umbral y llegada del mismo portal; un regreso usa
`arrivalAt`, no coordenadas duplicadas. Caminos, agua, orillas y cuerpos se validan
en las mismas funciones que navegan los personajes.

Arte 2× integrado, paquetes con hash por familia/actor/acción, cachés acotadas y
escenas preparadas antes de viajar. Maestros solo offline. El Studio usa el mismo
modelo/render pero no instancia cuentas, partidas ni APIs.
[Navegación](../../docs/NAVIGATION.md) · [Arte](ART.md) ·
[Arquitectura comunitaria](../../docs/SHARED-FOREST.md).

Antes de ampliar: `npm test`, prueba visual/clic de la aventura, galería/Studio,
escritorio/tablet/móvil y la API local si se alteran reglas autoritativas. Probar
con perfiles desechables, no borrar el guardado ni workspace del propietario.
