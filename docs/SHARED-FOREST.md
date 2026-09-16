# El bosque es de todos

Dirección aprobada, septiembre de 2026. La aventura y los conocimientos se ganan
individualmente; disfrutar de una construcción ajena no completa tu aventura.
Sin vidas, combate, Libro del Bosque, fiambreras ni parcelas privadas.

## Recorrido de esta entrega

1. Merendero humano al noroeste. Los humanos no detectan al duende; su gato sí.
   Mira su dirección, aprovecha los obstáculos y consigue navaja y mechero.
   El gato avisa antes de perseguir; si te pilla, te lleva por el pantalón, con el
   culete arriba y las extremidades colgando. Te deja más lejos, nunca en el agua,
   sin quitar objetos ni puntos de vida. Hay margen para escapar tras soltarte.
2. Con la navaja cortas seta. Recoges una ramita, enciendes y cocinas. Los humanos
   y el gato del picnic se marchan **al cocinar**, no al entregar. Brizno recibe
   la primera brocheta y entrega diez setines y sus remos reutilizables. Vuelve a
   tener hambre cada cinco horas; la recompensa inicial no es una granja infinita.
3. Recuperas una botella de la papelera. En el embarcadero: botella + navaja +
   remos del viejo. Solo se consume la botella. La navegación queda desbloqueada.
4. Cinco regiones de río de 128 × 144 tiles, con orillas explorables, desembarcos,
   vegetación, recursos y corrientes. Las rápidas empujan de verdad: busca remansos.
   La dirección de las estelas usa el mismo campo que la física; no es una flecha
   decorativa que promete una corriente inexistente.
5. Desde las raíces sale un brazo hacia el seto humano. Cuatro gatos, macetas
   movibles que tapan la visión, cuenco y semillas. El cuenco permite una piscinita;
   las semillas abren jardinería. «Recolocar las macetas» reinicia solo ese puzle.
6. Tocón del Mirlo y Remanso del Musgo son rincones comunitarios. Hay vallitas,
   bancos, mesas, flores, macetas, farolitas y piscina. Todos ven la misma versión
   confirmada del rincón al visitarlo. No son visitantes conectados en tiempo real.

## Controles y construcción

- Clic/toque en suelo: caminar/correr hasta allí, rodeando obstáculos sin activar
  conversaciones. Clic en objeto: acercarse y realizar esa interacción.
- Flechas/WASD: movimiento directo. Espacio sostenido: correr o remar más rápido.
  Espacio en diálogo: siguiente; Enter/Escape: cerrar. **No hay rodar** en el juego.
- Arrastrar: desplazar mapa; moverse retoma seguimiento. Pellizco/rueda: zoom del
  mapa, no de diálogos/botones. La navegación en barco tiene cruceta y acelerador táctil.
- En un rincón construible, abrir el botón de construcción. Elegir pieza, variante
  y vista disponible, tocar el suelo y confirmar. Se ve coste, huella y motivo si
  no cabe. Las vallas tienen dos vistas dibujadas; no giramos un PNG como una pegatina.
- Un objeto propio no patrimonial permite mover/retirar. Retirar devuelve materiales
  una vez y conserva historial. El bosque de aventura y sus accesos son intocables.

## Datos pequeños y responsabilidades claras

| Módulo/dato | Responsabilidad |
| --- | --- |
| behaviors/*.json + rules.js | Reacciones y recetas declarativas; sin ramas por misión en interact |
| resource-nodes.json + resources.js | Registro estable de recogidas; un bit por nodo y ciclo por región |
| cat-encounters.js | Visión, cobertura, patrulla, persecución, transporte y salida segura locales |
| river-navigation.js / river.js | Geometría del casco/corrientes y ciclo de navegación |
| construction.json | Costes, conocimiento, superficies, huellas, vistas, capacidades y zonas |
| construction-layout.js | Previsualización pura, paridad con el validador PHP |
| material-account.js | Cola durable de comandos, reconciliación y recuperación, sin subir saldos |
| community.js | Snapshot compartido, colocación y confirmaciones de API |
| ambient-activities.js | Reservar puntos de actividad y escogerlos por capacidades, no por mueble |
| cloud-save.js | Posición/progreso privado, conflictos y archivos de recuperación |
| tools/community-terrain.cjs | Máscara de suelo compilada desde colisión real para ambos validadores |

Ramitas/hojas son contadores, no millones de instancias con ID en inventario.
La ramita del suelo sí tiene un nodo estable: desaparece al recogerla y renueva en
el siguiente ciclo diario. Plantas de hojas conservan su planta y renuevan cada dos
minutos; conchas cada cinco horas. La cosecha usa tiempo del servidor al sincronizar.
Los 44 nodos de ramitas repartidos por las orillas permiten construir explorando,
sin golpear árboles ni un bucle obligatorio de farmeo.

Definiciones estáticas se comparten; un objeto persistido guarda únicamente tipo,
variante, media-tile x/y, orientación, autor, revisiones y agregados sociales. No se
duplica su imagen, coste o árbol de comportamiento. Historial aparte, nunca enviado
en los snapshots normales. Máximos actuales: 96 objetos/rincón y 24/autor/rincón.

IA ambiental: máximo tres vecinos activos en tareas, un cálculo de ruta cada medio
segundo y reserva de plazas. Solo quien ya tiene poses de sentarse las utiliza;
los demás conversan/cuidan rincones sin inventar sprites. Los NPC no gastan tus
recursos, no fabrican reputación y no producen eventos de red. Ampliar acciones
futuras significa añadir una capacidad con animación, no un if por cada mueble.

## Arte y rendimiento

Cinco gatos originales de ocho direcciones; hojas registradas, no cinco GIFs DOM.
Ascua tiene la pose específica colgante. Sus maestros y prompts quedan en
`data/aventura/art/cats/`; `scripts/prepare-adventure-cats.php` prepara alfa/celdas
localmente conservando originales. Los primeros intentos descartados no se exportan.
Los remos de madera regalados por Brizno están también en la barca vacía y las
32 poses de navegación; maestros, referencias y prompts exactos en
`data/aventura/art/river/catalog.json`. Se retienen los maestros anteriores.
Se mantiene **2x con reducción integrada**, movimiento selectivo y sutil.

Se conservan los cien NPC existentes y el arte de rodar, sin cargarlo en el juego.
El experimento antiguo importa su copia archivada del controlador, no el runtime.
Los packs se piden por escena/acción, las escenas preparadas se limitan a cuatro,
el terreno por chunks visibles y los gatos a ocho por escena. No se descargan
maestros, se escanean imágenes fuente ni se manda movimiento al servidor.

Los márgenes de ríos principales se alinean en ambos extremos: mismo centro,
anchura y transición de meandro. El contrato de navegación y pruebas de casco
comprueban que se puede remontar por un remanso sin cruzar tierra ni saltar paredes.
Las zonas siguen siendo lugares grandes, no pantallitas de una sola curva.

## Studio y expansión

Un único workspace local, sin editar producción: http://127.0.0.1:47832/#map.
Escala continua 25–300% en elementos admitidos; las colisiones escalan con ellos.
Puertas/actores protegidos conservan restricciones. Galería con cinco variantes
de gato, tres de valla, cuenco/piscina y el repertorio anterior. Caminos, posición,
crop y colisión siguen pasando por diff, validación y rebase; no se borran cambios
del usuario para actualizar la base.

Para otra construcción: definición, arte/familia, coste/conocimiento, huella,
superficie y capacidades; pruebas JS/PHP; nuevo arte solo si aporta algo. Para otra
aventura: reglas y desbloqueo individual, no modificar interact(). Para un molino:
primero diseñar una aventura y anclajes RIVER_EDGE reales. El esquema admite
superficies; esta entrega solo publica construcciones de suelo firme. No fingimos
que ya exista toda la futura rama mecánica, pesca, comercio o reputación avanzada.

Seguridad, límites, migración y operación: [GAME-SAVE-API.md](GAME-SAVE-API.md).
La autorregulación social es una dirección de diseño; las modificaciones ajenas
siguen cerradas en esta primera entrega hasta tener evidencia para abrirlas.
