# Bosque compartido — implementación aprobada

Estado: implementación y batería principal local verificadas; despliegue coordinado pendiente de registrar en [la entrega](RELEASE-SHARED-FOREST-2026-09-16.md). Ese registro distingue los resultados locales de los de producción.

## Alcance implementado

- Cinco gatos reutilizables y captura cómica por el pantalón: culete arriba, extremidades colgando, cara de susto. Sin vidas ni pérdida de objetos; retroceso seguro y tregua.
- Picnic: cuchillo necesario para cortar seta, mechero, ramitas y brocheta. Humanos/gato marchan al cocinar; Brizno entrega setines y remos en la primera ayuda. Hambre posterior cada cinco horas.
- Botella + cuchillo + remos regalados. Barca vacía y 32 poses con los mismos remos de madera.
- Seto humano con cuatro gatos, cinco macetas móviles que bloquean la visión, cuenco y semillas. Reinicio acotado a ese puzle.
- Cinco regiones de río grandes, corrientes dibujadas y remansos navegables. Espacio/acelerador táctil para remar rápido.
- Dos rincones comunitarios; siete familias construibles, variantes/vistas, costes, huellas, acceso protegido, colocación y retirada propias.
- Cuenta de materiales y confianza separada de la reputación web. API transaccional, revisiones, reintentos idempotentes, historial, restauración de moderación y patrimonio.
- Ramitas desaparecen al recogerlas; inventario apilado y bitsets por ciclo. 44 nodos distribuidos, sin identidades individuales en el saco.
- Actividades NPC locales por capacidades, máximo tres simultáneas; no generan reputación ni mensajes de red.
- Rodar retirado del juego (arte/experimento conservados), zoom solo del mapa y escala continua en Studio.
- Se conservan los cien NPC. Sin Libro del Bosque, fiambrera ni nuevas poses masivas.

## Evidencia reproducible

- `npm test`: motor/arte completo; 237 rutas, 346.826 puntos de suelo, cien identidades, atlas modular, controles, guardado y Studio.
- 61 fundamentos de recursos/receta/visión/escala; 81 comprobaciones de río.
- 128 comparaciones JS/PHP del validador constructivo con terreno real.
- Cola de materiales: respuesta perdida, reintento tras recarga, cambio de identidad, migración parcial y límites.
- Backend DDEV: 29 pruebas de autoridad/patrimonio; 13 de concurrencia real, restauración e identidad; 17 de guardado privado; 15 de HTTP/autenticación.
- Chrome escritorio/tablet/móvil: captura real y bloqueo de movimiento, recolocación segura, navegación/corrientes/siete desembarcos, construcción por API y pellizco sin ampliar UI.
- Merendero en cinco viewports; Studio galería/caminos, persistencia y escala 137% en workspace temporal. Los cambios del usuario no se descartan.
- Contrato OpenAPI idéntico en ambos repositorios; frontera web/juego y catálogo plano conservados.
- Ejemplos locales creados y repetidos idempotentemente mediante API: tres identidades inequívocamente de prueba, nueve construcciones. No se atribuyen acciones a personas reales.

## Límites deliberados

Las modificaciones ajenas siguen cerradas en esta entrega. La confianza no es todavía una autorización general para desmontar. El servidor valida inventario, recetas, requisitos, permisos y geometría; no demuestra que un humano recorrió cada metro del mapa ni ofrece anti-bot competitivo. Las pruebas responsive son Chrome automatizado, no certificación de todos los dispositivos físicos/Safari.

Los perfiles privados anteriores siguen archivados, no publicados como si fueran parcelas compartidas. El corte de importación se congela con la migración 4231; futuros snapshots no acuñan materiales. Nunca restaurar una DB antigua sobre partidas nuevas para revertir una UI.

## Operación

[Arquitectura y reglas](SHARED-FOREST.md) · [Contrato y seguridad](GAME-SAVE-API.md) · [Despliegue](RELEASING.md) · [Registro concreto](RELEASE-SHARED-FOREST-2026-09-16.md)
