# Datos del mundo

La documentación vigente se divide por responsabilidad; no hay una segunda guía
de juego que pueda contradecir las reglas actuales.

- [Diseño y experiencia](../../docs/JUEGO-AVENTURA.md).
- [Recorrido, río y bosque compartido](../../docs/SHARED-FOREST.md).
- [Escenas, comportamientos y recogibles](REFACTOR.md).
- [Arte y pipeline](ART.md), [familias y variantes](../../docs/WOODLAND-KIT.md).
- [Studio: una propuesta local revisable](../../tools/adventure-studio/README.md).
- [API, autoridad y guardado](../../docs/GAME-SAVE-API.md).
- [Desarrollo local](../../docs/LOCAL-DEVELOPMENT.md), [release vigente](../../docs/RELEASE.md).

Las escenas y comportamientos son fuentes; `elements.json` y `residents.json`
se generan con `npm run art:catalog`. Los maestros y prompts artísticos se
conservan en `art/`; no se incluyen en el artefacto servido al jugador.
