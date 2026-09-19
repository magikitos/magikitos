# Pareja protagonista — entrega exclusivamente visual

Encargo del dueño, 18-sep-2026: mantener únicamente los dos protagonistas
activos, uno hombre (slot 100) y una mujer claramente diferente (slot 101).
Corregir la identidad/anatomía variable entre andar, correr y otras acciones.

**Decisión posterior explícita: UN SOLO SHEET con TODO por duende.** Cada PNG
se genera como hoja completa, no se entregan paquetes separados por acción.
La propuesta anterior de separar la producción queda descartada. Solo se
recortarán ampliaciones para revisión, no como assets alternativos de entrega.

## Coordinación con el agente de código

Esta carpeta contiene arte candidato, prompts y revisión. **No la consume el
motor automáticamente.** No se modifican JS/PHP, scripts, catálogos activos,
manifest, selección de avatares, partidas, barcos ni despliegues desde este
trabajo. No hornear el catálogo entero ni sobrescribir originales publicados.
El otro agente conserva el control de integración y publicación.

La aceptación anterior de los dos Brezos no resuelve el defecto observado por
el dueño: andar y correr tienen distinta anatomía. No usar el número de frames
o el encaje del pie como prueba de consistencia visual.

## Dirección visual fijada

- Referencia de estilo confirmada por el dueño: `residents/sources/resident-001.png`.
  El acabado redondeado/brillante de `brezo-alba-run-stride.png` está rechazado:
  no usarlo como referencia artística ni considerar arreglado el problema al
  igualar solamente alturas. Conservar el trazo fino, textura mate, cara y
  proporciones del original también en las acciones nuevas.
- **100 / Brezo, hombre:** duende joven adulto esbelto, orejas puntiagudas,
  rizos negros, nariz expresiva y sonrisa pícara. Gorro alto verde junco con
  pico doblado y remiendo óxido cosido; camisa ocre de puños de lino crudo,
  chaleco corto remendado, pantalones verdes con remiendos y botas marrones.
- **101 / Bruma, mujer:** duende joven adulta aventurera, orejas puntiagudas,
  piel humana cálida con pecas y trenza cobriza. Gorro ciruela de pico más
  lateral/doblado con remiendo mostaza, chaqueta corta turquesa remendada,
  pantalones oscuros cortos, medias y botines marrones. Ni cambio de color del
  hombre ni disfraz de princesa: silueta, pelo, cara y ropaje propios.
- Mismo lenguaje de dibujo y cámara elevada de tres cuartos. Detalle de píxel
  definido, sin plástico/brillos 3D. Los parches y costuras pertenecen a la
  ropa y no cambian de sitio entre frames. Sin armas ni accesorios nuevos.
- Cabeza, ancho del torso, longitud de brazos/piernas y volumen corporal son
  constantes. Correr cambia la pose, no convierte el duende en otro más gordo.
- Remero y sus dos remos, **sin casco ni asiento**. Conservar los ocho ángulos
  y su perspectiva; no reutilizar máscaras de otro cuerpo sin revisarlas.

## Alcance de cada set

Base: 8 direcciones × (quieto + 3 pasos). Acciones: correr 32, remar 32,
empujar 16, trabajar/cocinar 16, llevado por gato 16, necesidades 8 y hallazgo 4.
Total: **156 poses por personaje, 312 para la pareja**, incluidas las bases que
deben concordar con las acciones. Solo estos dos; no iniciar el elenco de 30.

Estado: **tanda detenida; las tres pruebas están RECHAZADAS**. El dueño rechaza
explícitamente la calidad. No importar estos PNG al catálogo ni usarlos como
referencia de estilo para la mujer. Cero protagonistas nuevos aprobados en esta
revisión. Los originales publicados siguen intactos.

## Resultado de las pruebas completas

Generación con la herramienta integrada `image_gen`; prompts exactos en
`prompts/`. Son pruebas fallidas, no entregables finales:

- `sources/100-complete-candidate-01.png`: 793 × 1983. Omite filas/fases,
  altera el estilo y no resuelve la postura llevado por gato.
- `sources/100-complete-candidate-02.png`: segunda prueba vertical; vuelve a
  omitir fases y no alcanza el trazo ni la anatomía del original.
- `sources/100-complete-candidate-03.png`: 1586 × 992. Prueba horizontal;
  incumple columnas/direcciones, pierde detalle y tampoco se acepta.
- `review/100-existing-pose-layout.png`: guía de distribución hecha con
  recortes del arte existente, incluida la carrera que el dueño ha rechazado.
  **No es arte nuevo ni una corrección de estilo**, solo una guía de poses.

La referencia original tiene 1774 × 887 para 32 poses; las generaciones han
devuelto aproximadamente la misma cantidad total de píxeles intentando incluir
156. No son los másteres de alta resolución solicitados. Ampliarlas no recupera
detalle ni corrige la deriva de diseño. No marcar fases como terminadas solo
porque haya dibujos en la hoja. La entrega pedida sigue siendo un solo sheet
por personaje; la producción necesita revisión antes de continuar.

## Distribución solicitada del único sheet

8 columnas × 20 filas, 160 celdas cuadradas, 156 poses y 4 celdas vacías.
Direcciones de ocho vistas: abajo, abajo-derecha, derecha, arriba-derecha,
arriba, arriba-izquierda, izquierda, abajo-izquierda.

| Filas (desde 1) | Contenido |
|---|---|
| 1 | Quieto, ocho direcciones |
| 2–4 | Andar: tres pasos, ocho direcciones |
| 5–8 | Correr: cuatro fases, ocho direcciones |
| 9–12 | Remar: cuatro fases, ocho direcciones |
| 13 | Empujar fases 0 y 1, cada una abajo/derecha/arriba/izquierda |
| 14 | Empujar fases 2 y 3, mismo orden |
| 15 | Trabajar fases 0 y 1, cada una abajo/derecha/arriba/izquierda |
| 16 | Trabajar fases 2 y 3, mismo orden |
| 17–18 | Llevado por gato: dos fases, ocho direcciones |
| 19 | Mear 0–3; cagar 0–3. Poses cómicas vestidas, sin anatomía explícita |
| 20 | Hallazgo 0–3 en columnas 1–4; columnas 5–8 vacías |

Esta es la distribución PEDIDA al generador. Se contrasta contra los píxeles
obtenidos antes de entregar; no asumir que el modelo respeta una cuadrícula.
