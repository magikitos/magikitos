# Magikitos Studio · exclusivamente local

## Abrir

Desde la raíz del proyecto:

```sh
node tools/adventure-studio/server.cjs
```

http://127.0.0.1:47832

Solo escucha en este Mac. No es una ruta pública, no está bajo `public/` y no se añade al router PHP.
Requiere Node, PHP y esbuild ya instalados. Si no se encuentran: `STUDIO_PHP=/ruta/php` y `WORLD_ESBUILD=/ruta/esbuild`.
No instala dependencias, arranca contenedores, consulta producción ni necesita base de datos.

## Uso

1. Elige una de las seis escenas.
2. Selecciona en el mapa o busca un elemento en la lista.
3. Arrástralo; ajusta X/Y, escala y reflejo en el inspector.
4. Activa colisiones o cuadrícula cuando necesites comprobar un paso.
5. Pon nombre al borrador y guárdalo. También se guarda automáticamente tras una pausa.
6. Usa **Ver cambios** para revisar y **Exportar diff** para entregar la propuesta.

Arrastrar el fondo mueve la cámara. Rueda o pellizco ajustan el zoom; **Encajar** muestra toda la escena.
**Mano**, botón central o Espacio + arrastrar permiten desplazar el mapa sobre objetos.
Flechas ajustan el objeto seleccionado según el paso del inspector; Shift multiplica el paso por cuatro.
⌘/Ctrl Z deshace; ⌘/Ctrl Shift Z o Ctrl Y rehace; ⌘/Ctrl S guarda.
El historial de deshacer admite 100 acciones. Abrir otro borrador empieza un historial nuevo, no borra sus cambios.
Cancelar un gesto restaura su posición anterior.

**Mover también piezas apoyadas** mueve conjuntamente objetos con la misma ancla: por ejemplo, mesita, mechero y florero.
Afecta a arrastrar y a cambiar coordenadas. No agrupa por cercanía arbitraria ni convierte toda una habitación en un bloque.

## Qué permite, y qué no

- Reordenar entidades existentes y la vegetación generada; inspeccionar anclas y cuerpos.
- Escalas discretas con píxel sin interpolación: 0,75×, 1×, 1,25× y 1,5× para arte compatible.
- Reflejo horizontal cuando es compatible.
- Giros de 90° solo para arte plano, actualmente hojas de limpieza, marcas del suelo y conchas.
- Puertas, actores, barcas y elementos animados críticos no ofrecen deformaciones que rompan su perspectiva o funcionamiento.
- El estudio no permite cambiar comportamientos, recompensas, identificadores, reglas o destinos mediante JSON libre.
- No crea escenas, no pinta caminos/agua y no añade ni elimina elementos en esta entrega.
- El taller muestra su **plano fuente**. El juego dimensiona el interior y crea expositores desde el catálogo; esos objetos dinámicos no son colocaciones manuales del plano. El inspector y el revisor avisan de ello.

Una colisión superpuesta puede ser intencionada —un objeto sobre una mesa— o un problema.
Los avisos ayudan a revisar, pero no sustituyen probar los recorridos después de aplicar el cambio.
Mover una puerta exige comprobar ambos sentidos; mover la hoguera puede exigir recolocar zona y luz.

## Separación de borradores y juego

Archivos persistentes, ignorados por Git:

- `.local/adventure-studio/drafts/*.json`: borradores.
- `.local/adventure-studio/drafts/<id>-history/`: copias de guardados anteriores.
- `.local/adventure-studio/snapshots/`: base de cada borrador, identificada por hash.
- `.local/adventure-studio/build/`: bundle del editor.
- `.local/adventure-studio/ui-lab/`: copia conservada del laboratorio A/B y sus medios locales.

No borrar esa carpeta para «limpiar el build»: también contiene trabajo del usuario.
El laboratorio temporal original se conserva además; el enlace **UI Lab** abre la copia persistente en otra pestaña.
Si se clona el repositorio en otra máquina, esa copia privada no viaja con Git y debe copiarse también.
El editor del mapa usa los sprites y el código compartidos del proyecto, no depende de esa copia para funcionar.

El servidor solo escribe en su directorio local. No tiene endpoint de aplicación, de edición de escenas ni de DB.
Valida Host y Origin, exige token para guardar, limita el tamaño del cuerpo y valida cada transformación.
El guardado es atómico, conserva historial y comprueba la revisión: una pestaña no pisa a otra.
Una base antigua se conserva como tal, sin mezclarla automáticamente con el mapa nuevo.
**Nuevo** vuelve a leer la base actual; abrir un borrador conserva su base original.

## Vegetación estable y formato del diff

El mundo actual genera parte del bosque de forma determinista. Mover una entidad puede afectar a las exclusiones del generador.
Para evitar que al mover una mesa cambie medio bosque, cada borrador conserva la vegetación de su base.
La propuesta de una escena editada incluye `scenery`: esas colocaciones explícitas, en tiles, con sus cuerpos cuando los tienen.
Sin `scenery`, el juego sigue usando su generador actual. No se ha congelado ni recolocado ningún bosque del juego por abrir el studio.

El diff contiene:

- Hash global de la base y hash del archivo fuente por escena.
- Capa, ID, sprite y valores anteriores/nuevos de cada colocación.
- Escena propuesta completa, conservando el resto de sus reglas y propiedades.

`draft.js` define y valida ese contrato. `entity-art.js` comparte geometría de dibujo, hit-test, colisiones transformadas y capacidades entre editor y juego.

## Revisar antes de aplicar

```sh
node scripts/review-adventure-draft.cjs /ruta/al/mapa-diff.json
```

Este comando es **solo lectura**. Comprueba que la base siga siendo la misma y que la exportación no altere reglas u otras propiedades.
Después se revisan composición, puertas, luces, zonas, objetos relacionados y rutas.
La aplicación al juego se hace como un cambio de código separado, con revisión del diff y pruebas. Nunca desde un botón del editor.

## Verificar

```sh
node scripts/check-adventure-studio.cjs
node scripts/check-adventure-studio.cjs --unit
```

La suite de navegador arranca otra instancia en 47833 y usa una carpeta temporal propia.
Comprueba transformaciones, bosque congelado idéntico, agrupación, ratón, guardado/recarga, exportación, deshacer/rehacer,
rechazo de escrituras sin token/origen, nombres inválidos, conflictos de revisión y que no cambien las fuentes del juego.
Se revisan tamaños de escritorio, tablet, móvil y horizontal. No certifica dispositivos iOS físicos.

Arquitectura: `snapshot.cjs` (lectura), `draft.js` (contrato puro), `viewport.js` (cámara/hit-test/gestos),
`app.js` (herramientas), `server.cjs` (persistencia aislada), `build.cjs` (build local).
