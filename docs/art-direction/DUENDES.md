# Duendes · Ascua y repertorio aprobado

Decisión del propietario, 14 septiembre 2026: **Ascua es el protagonista**.
El reparto ambiental activo tiene ocho apariencias con piel natural, no familias obligatorias. Todos
llevan gorro de pico; la combinación cobriza/petróleo y la silueta de Ascua se
reservan al jugador. La identidad pública de cada vecino se asigna de forma
determinista a una de las ocho apariencias; no cambia el avatar de su cuenta web.
La lista explícita `avatarVariants` excluye las pieles verde, gris verdosa y azul
(3, 5, 9). Sus conceptos solo permanecen en el archivo de arte/experimentos.
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
| Rodar | 8 × (3 + 1) | Tres poses de giro + recuperación erguida de otra hoja |
| Empujar | 4 × 4 | Rodillas flexionadas, cara de esfuerzo, manos al objeto |
| Manipular / ofrecer | 4 × 4 | Gesto genérico, objetos y herramientas separados |
| Enseñar hallazgo | 1 × 4 | De frente, manos sobre el gorro, objeto independiente |
| Necesidades | 2 secuencias × 4 | Mear y cagar/limpiarse, cómico y discreto |
| Arco reservado | 8 × 3 | Arte preparado para una misión futura; no arma jugable |

**164 celdas de Ascua**, 140 utilizadas por el core y 24 reservadas para el arco.
La última fila agachada del roll antiguo no se exporta (`exportRows`); la hoja
original queda intacta. Cada otro duende tiene 32 celdas de reposo/paseo.
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
- Barco: asiento y trayecto pertenecen al transporte. No hay control de paseo
  durante el viaje.

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
agarre y sus direcciones al aprobar el puzzle. No hay pesca, tirachinas ni mapa.
El arco necesita aún integración de apuntado, proyectil y revisión contextual
antes de convertirse en mecánica.

Los experimentos siguen accesibles en Studio → Laboratorio como archivo.
La antigua lista de 46 acciones/1.076 poses era una exploración y queda
sustituida por este contrato compacto. No existe compatibilidad de runtime con
aquella propuesta.

Ver [definición y vida](DEFINITION-MOTION.md) y
[verificación de la entrega](../ASCUA-RELEASE.md).
