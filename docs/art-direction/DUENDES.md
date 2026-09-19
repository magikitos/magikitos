# Duendes · Ascua y repertorio aprobado

Decisión del propietario, 14 septiembre 2026: **Ascua es el protagonista**.
Todos llevan gorro de pico; la silueta cobriza/petróleo de Ascua se reserva al jugador.
El reparto usa los cien perfiles de [la biblioteca de residentes](../RESIDENTS.md),
asignados de forma determinista, con pieles naturales y sin repetir familia en la zona.
Brizno tiene identidad propia (12), fuera del reparto aleatorio.

## Arte implementado

El contrato de producción es
[`data/aventura/art/cast/catalog.json`](../../data/aventura/art/cast/catalog.json).
Cada ficha declara fuente, rejilla, direcciones, acción, paquete y altura lógica.
Los maestros y prompts están en esa misma carpeta; no se descargan al jugar.

| Módulo de Ascua | Direcciones × poses | Uso |
| --- | ---: | --- |
| Reposo + andar | 8 × 4 | Una neutral y tres pasos, gobernados por distancia |
| Correr | 8 × 4 | Zancada propia, inclinación, brazos y botas; ciclo por distancia |
| Rodar archivado | 8 × (3 + 1) | Arte conservado, sin habilidad activa |
| Empujar | 4 × 4 | Rodillas flexionadas, cara de esfuerzo, manos al objeto |
| Manipular / ofrecer | 4 × 4 | Gesto genérico, objetos y herramientas separados |
| Enseñar hallazgo | 1 × 4 | De frente, manos sobre el gorro, objeto independiente |
| Necesidades | 2 secuencias × 4 | Mear y cagar/limpiarse, cómico y discreto |
| Arco reservado | 8 × 3 | Arte preparado para una misión futura; no arma jugable |

Las hojas de rodar y arco se conservan, pero no son habilidades activas ni se cargan
por defecto. Cada residente tiene 32 celdas de reposo/paseo. Ascua además dispone
de remado y pose colgante para el gato, documentados en sus catálogos de arte.
Brizno tiene 32 de reposo/paseo y 32 sentado: ocho direcciones × hambre, hablar,
contento y parpadeo. De momento solo está sentado; la hoja de paseo no se carga
en el mapa hasta necesitarla. El banco de ramas es un objeto de arte independiente,
compuesto mediante `seat`, reutilizable con cualquier actor sentado compatible.

Empujar funciona por eje dominante y al 42 % de la velocidad de paseo. La
postura y el desplazamiento siguen la fuerza real, no un ciclo de paseo
acelerado. Diagonales de paseo, carrera y rodar están dibujadas, no son flotación lateral.

## Un gesto, muchos objetos

`Presentation` presenta; `planReaction` decide. Ningún fotograma añade objetos,
cobra monedas ni resuelve misiones. El plan es puro, se preparan recursos y
destino, se reproduce la secuencia y se confirma el estado una sola vez.
Recargar antes de confirmar no consume ingredientes ni dinero.

- Hallazgo: un duende de frente más cualquier sprite sobre el gorro; después,
  el mismo objeto vuela hacia el saco.
- Manipulación: acercar manos, trabajar, ofrecer y retirar. La barbacoa compone
  seta, navaja y palo en este gesto, sin atlas de «cortar esta receta».
- Fuente: el gesto de ofrecer más trayectoria y moneda; los setines pequeños
  son recuerdos del estado local, no parte de la imagen de la fuente.
- Barco: ocho orientaciones de remado; la física mueve el casco y el personaje
  permanece sentado. Captura del gato: pose colgante, sin paseo independiente.

## Registro y definición

Lienzo compartido de **48 × 48 unidades**, apoyo [24, 46], textura **2× integrada**.
Escala común por hoja, alineación al apoyo y offsets conservados: no estirar ni
reencajar cada pose. Rodar hereda la escala del cuerpo de paseo, no agranda la
bola agachada. La reducción final se hace una sola vez desde el maestro.

El recorte alfa conserva anclas, tamaño lógico y colisión. `ink` describe el
área visible para retratos e iconos; no altera el cuerpo ni la física.
`pixelRatio` solo multiplica las coordenadas de lectura de la textura.

## Ampliaciones, cuando exista la mecánica

Levantar/cargar/depositar, lanzar, trepar y nadar son módulos posibles, no
promesas de acciones existentes ni una orden de dibujarlos ahora. Diseñar cada
agarre y sus direcciones al aprobar el puzzle. No hay pesca ni tirachinas.
El arco necesita aún integración de apuntado, proyectil y revisión contextual
antes de convertirse en mecánica.

Los experimentos siguen accesibles en Studio → Laboratorio como archivo.
La antigua lista de 46 acciones/1.076 poses era una exploración y queda
sustituida por este contrato compacto. No existe compatibilidad de runtime con
aquella propuesta.

Ver [definición y vida](DEFINITION-MOTION.md) y
[verificación de la entrega](../RELEASE.md).

## El elenco jugable: 18 protagonistas (19-sep-2026)

Ocho protagonistas anteriores (100–107) y los diez aprobados como 200–209, con el mismo contrato
de 156 poses cada uno y tarjetas con alfa para «Yo». Los cien NPC conservan su identidad.

El dueño ha aprobado **los diez nuevos diseños `resident-101`–`resident-110`**
como protagonistas. No confundir estos números de fuente con el antiguo actor
101/Brezo bruma. Los nuevos IDs son 200–209. Los cien NPC originales
y los ocho protagonistas anteriores se conservan.

Se preparan uno por uno: andar/quieto, carrera, ocho cuerpos sentados con remos
sincronizados, empujar, trabajar, llevado por gato, necesidades, hallazgo y card.
Las cards conservan los píxeles originales del personaje: ambiente muy tenue,
transparencia real y halo suave individual. Nada de reinterpretar su identidad.

| Fuente | Key / ID previsto | Arte y revisión |
|---|---|---|
| 101 | rizo-alba / 200 | Completo: 156 frames, card alfa, rig y nueve barcas; registrado para «Yo» |
| 102 | chispa-sol / 201 | Completo: 156 frames, card alfa, rig y nueve barcas; registrado para «Yo» |
| 103 | tizon-musgo / 202 | Completo: 156 frames, card alfa, rig y nueve barcas; registrado para «Yo» |
| 104 | nispera-sol / 203 | Completo: 156 frames, card alfa, rig y nueve barcas; registrado para «Yo» |
| 105 | trebol-bruma / 204 | Completo: 156 frames, card alfa, rig y nueve barcas; registrado para «Yo» |
| 106 | mimbrera-noche / 205 | Completo: 156 frames, card alfa, rig y nueve barcas; registrado para «Yo» |
| 107 | avellano-cobre / 206 | Completo: 156 frames, card alfa, rig y nueve barcas; registrado para «Yo» |
| 108 | oria-musgo / 207 | Completo: 156 frames, card alfa, rig y nueve barcas; registrado para «Yo» |
| 109 | silo-bruma / 208 | Completo: 156 frames, card alfa, rig y nueve barcas; registrado para «Yo» |
| 110 | zarza-sol / 209 | Completo: 156 frames, card alfa, rig y nueve barcas; registrado para «Yo» |

Autoría en `data/aventura/art/playable-cast/<key>/`; diseños aprobados y originales
en `residents/candidates/101-110/`. La orden posterior del dueño amplía esta ronda
a registro, selector «Yo» y despliegue. Una hoja generada no cuenta como terminada hasta pasar
recorte, registro, escala, revisión de poses y composición de barcas. No se
declara una integración ni un despliegue que no se haya realizado. No falta
world art para esta petición: son exclusivamente estos diez protagonistas y cards.

Revisión del dueño: al ser transportado por el gato, el gorro debe seguir bien
asentado sobre la frente/coronilla, compacto y parcialmente oculto por el cuerpo.
No cuelga como un cono bajo la barbilla. Revisado en los diez; en las tres vistas
traseras se ve la nuca, no una cara frontal. Las últimas correcciones de Chispa
y Níspera conservan expresiones de susto; Zarza tiene un solo gorro y mantiene
mangas ocres y pantalones índigo. Se retiró un bolso duplicado en la remada de Oria.
Selección de fuentes, escalas y puntos de agarre: `authoring.json` de cada duende.

**Contrato idéntico para todos, incluidos los ocho protagonistas anteriores:**
andar/quieto 8×4; correr 8×4; remar 8×4; empujar 4×4; trabajar 4×4;
llevado por gato 8×2; necesidades 4×2; hallazgo 4×1. Total **156 frames**.
Mismos nombres, orden, lienzos lógicos y anclas por acción. Masters de esta tanda
con celdas de 384px; exportación de revisión a 2× con reducción integrada.
Los estudios intermedios de cuatro poses o con otra disposición **no son hojas
de entrega**: las correcciones sustituyen slots, nunca añaden fases.
`php scripts/check-playable-sheet-contract.php --prepared` comprueba todas las
entregas disponibles y enumera las pendientes; `--all-approved` exige las diez.
Incluye controles negativos: eliminar una fase debe fallar. Usa el catálogo de
acciones existente como autoridad, sin registrar protagonistas en el juego.

**Resultado de esta tanda:** 80 hojas finales de sprites, 1.560 fotogramas y diez
cards con alfa. Contrato completo con 80 controles negativos, invariancia corporal
de remada y 5.760 composiciones de barcas entre Chrome/WebKit. Tres tamaños por
duende: 1440×900, 768×1024 y 390×844. Las pruebas de renderer no equivalen a una
partida integrada. El registro preserva la escala nominal 384 en andar y acciones;
el selector usa tarjetas alfa paginadas. El estado del despliegue se registra
en `docs/RELEASE.md`. No queda otra familia de world art
por generar para esta petición. Los ocho protagonistas anteriores y los 100 NPC
no se han sustituido.

Abrir la [galería local animada](../../data/aventura/art/playable-cast/review-101-110/index.html):
cambio de personaje/acción, pausa, fase manual, fondos y capturas de las barcas.
Fuentes, prompts, reconstrucción y advertencias concretas de integración:
[la entrega de los diez protagonistas](../../data/aventura/ART.md#protagonistas-101110-integrados-el-19-sep-2026-como-200209).

### Necesidades y tarjetas: contrato común de los 18

Los 18 protagonistas conservan exactamente las mismas 156 poses. En las mujeres,
`pee` reutiliza las cuatro fases agachadas `poop` **solo al dibujar**. La acción
sigue siendo orinar: chorro corto, charco de orina, sin caca, sin gastar hoja y sin
reiniciar el reloj de defecación. El mismo selector de postura se usa para otros
jugadores visibles. No se alteran los PNG ni se crean sheets específicos por sexo.

Las 18 tarjetas usan `prepare-playable-card.php`, con identidad original, fondo
al 16 % y halo al 24 %. Tres atlas de hasta ocho tarjetas evitan superar 4 MiB
decodificados por textura. El selector los toma prestados solo mientras está abierto.
Los diez perfiles nuevos son `playableOnly`: los 100 NPC originales no cambian
de identidad, reparto determinista ni familias del Studio.
