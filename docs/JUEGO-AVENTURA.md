# La aventura de los Magikitos

Documento de diseño vigente. La versión publicada y sus verificaciones se consultan
en [RELEASE.md](RELEASE.md); este documento no es una autorización de despliegue.

## Identidad

Aventura cenital de pixel art cálido y original, con cámara fija, exploración
agradable, pequeños enigmas y humor cotidiano. Sin combate, vidas ni muerte del
jugador: las consecuencias son físicas y recuperables, como un gato que te aleja
o una corriente que te obliga a intentarlo por otra orilla.

Ascua es el protagonista exclusivo. Todos los duendes llevan gorro de pico.
Se conserva la biblioteca de cien NPC, con siluetas y pieles naturales variadas.
Sus acciones y conversaciones son ambientales/asíncronas, no presencia online.
En español: andaluz cercano, callejero y buen rollo; una caja de diálogo cuando baste.
Los otros cinco idiomas adaptan el tono, no traducen cada muletilla literalmente.

## Web y juego

El juego vive en /aventura y sus cinco traducciones. La web conserva portada,
contenidos, tienda, formularios, SEO y admin. No páginas embebidas ni navegación
por parámetros de contenido: entrar recupera la partida; un nuevo jugador aparece
en el claro, sin diálogo obligatorio. “Explorar / Continuar explorando” activa
audio y solicita fullscreen; siempre se puede jugar si el navegador lo rechaza.

Cuentos junto a la hoguera nocturna; chistes en la taberna; láminas en el rincón
artístico, como un catálogo plano; productos en el taller. Expresiones y concurso
no forman parte del juego. Las actividades son UI propia sobre el mundo y JSON
de la API, conservando la selección de content pulse. Leer/imprimir/comprar/grabar
y gestionar cuenta siguen siendo acciones explícitas hacia la web.
Durante una voz se silencia todo el audio del juego.
[Audio y entrada](AUDIO-AND-ENTRY.md) · [Frontera y API](REPOSITORY-BOUNDARY.md).

## Mundo y primera aventura

Árboles y plantas grandes, duendes pequeños, setas aproximadamente de su talla,
casas de botas, troncos, hojas, setas y macetas. Interiores naturales recortados,
con decoración coherente y espacio para caminar. Puerta abierta implica acceso
real al andar hacia el umbral. No hay casas humanas en esta etapa: sí un picnic.

El protagonista no tiene hambre ni una obligación inicial. Brizno, el abuelete
barrigón junto a la barbacoa, sí. La secuencia y las reglas comunitarias están
en [SHARED-FOREST.md](SHARED-FOREST.md), única guía detallada del recorrido:
navaja y mechero vigilados por un gato → porción de seta y palo → brocheta →
remos y setines → botella del suelo junto a la papelera → navegación libre.
Los humanos se marchan al cocinar: aparece la botella y se suma un segundo gato,
sin retirar el primero. Brizno vuelve a tener hambre cada cinco horas;
solo la primera entrega paga el premio y da los remos. No hay ferry de pago.

Palos y plantas culilimpia se colocan deliberadamente, no se esparcen al azar.
El bosque inicial contiene cuatro palos; cada tramo recolector del río, dos.
Los palos desaparecen al recogerlos y vuelven en el siguiente ciclo diario.
Las plantas permanecen y renuevan hojas por ciclos de dos minutos.
El saco apila cantidades. Autoría y persistencia: [contrato de datos](../data/aventura/REFACTOR.md).

## Controles y presentación

Un mismo motor de entrada para ratón, teclado y táctil. Clic en suelo significa
llegar esquivando sin activar otros objetos; clic en objeto significa interactuar.
Espacio sostenido corre/rema más rápido. Rodar no está activo; se conserva su arte.
Arrastrar explora el mapa y caminar retoma seguimiento. El zoom afecta únicamente
al mapa. El joystick se adapta a entrada táctil real; el turbo izquierdo solo
aparece mientras hay dirección. Diálogos: Espacio avanza, Enter/Esc cierran;
clic fuera cierra y usa ese mismo clic como destino.
[Navegación](NAVIGATION.md) · [Controles detallados](SHARED-FOREST.md#controles-y-construcción).

Arte: 2× con reducción integrada; animación selectiva, sutil para vegetación y
más cuidada en personajes relevantes. Paquetes gráficos por escena/acción, sin
maestros descargados ni procesamiento alfa en el navegador.
[Arte y variantes](WOODLAND-KIT.md) · [Reparto](RESIDENTS.md).

## Necesidades y persistencia

“Yo” ofrece solo la necesidad activa: mear a las 6–10 horas reales, cagar a las
8–16. Si coinciden, cagar tiene prioridad y al completarlo alivia ambas.
Cagar consume una hoja al terminar; sin hoja da la pista, sin penalizaciones.
Las trazas son privadas y temporales: caca 24 horas, charco 5 minutos, máximo 48.

Guardado local primero; sincronización privada por la identidad web existente.
Materiales, setines del juego y construcción compartida tienen autoridad en la API,
separados de la reputación y del dinero de la web. No eventos por movimiento.
El bosque de aventura está protegido; solo ciertos rincones permiten construir.
[Contrato de guardado y seguridad](GAME-SAVE-API.md).

## Lo siguiente no está implementado

Aventuras que enseñen familias de construcciones: iluminación, tejidos, huertos
y mecanismos. Primero una aventura bien cerrada, sin farmeo obligatorio.
La línea narrativa de cocinar para otros y levantar un restaurante sigue siendo
una posibilidad: Brizno puede ser el vínculo emocional del lugar.
Patrimonio y modificación ajena requieren límites y evidencia antes de abrir más
permisos. Sin Libro del Bosque ni fiambrera; el conocimiento se gana individualmente.

## Trabajar en el proyecto

[Desarrollo y pruebas](LOCAL-DEVELOPMENT.md) · [Studio](../tools/adventure-studio/README.md)
· [Datos y reglas](../data/aventura/REFACTOR.md) · [Publicación](RELEASING.md).
No duplicar aquí cifras de builds ni listas históricas de pruebas.
