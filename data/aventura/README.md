# Datos del mundo

La documentación vigente se divide por responsabilidad; no hay una segunda guía
de juego que pueda contradecir las reglas actuales.

- [Diseño y experiencia](../../docs/JUEGO-AVENTURA.md).
- [Recorrido, río y bosque compartido](../../docs/SHARED-FOREST.md).
- [Escenas, comportamientos y recogibles](REFACTOR.md).
- [Arte y pipeline](ART.md), [familias y variantes](../../docs/WOODLAND-KIT.md).
- [Studio: una propuesta local revisable](../../tools/adventure-studio/README.md).
- [API, autoridad y guardado](../../docs/API.md#save-protocol-and-server-authority).
- [Desarrollo local](../../docs/LOCAL-DEVELOPMENT.md), [release vigente](../../docs/RELEASE.md).

Las escenas y comportamientos son fuentes; `elements.json` y `residents.json`
se generan con `npm run art:catalog`. Los maestros y prompts artísticos se
conservan en `art/`; no se incluyen en el artefacto servido al jugador.

## El texto: el motor es global, lo demás es de cada pantalla

Desde el 17-sep-2026 no hay un fichero de textos por idioma con todo dentro.
`locales/core.json` guarda lo que dice el MOTOR (menús, botones, avisos, el
nombre de lo que llevas en el saco) y viaja incrustado en la página; lo que dice
cada pantalla vive en `locales/scenes/{escena}.json`, y lo que comparten unas
pocas por usar la misma familia de comportamientos, en `locales/packs/*.json`.
El artefacto publica un fichero por pantalla y por idioma que `SceneDirector`
pide junto a los sprites de esa pantalla, así que una pantalla nueva no engorda
ni un byte lo que se carga al entrar al bosque.

Cada clave lleva sus seis idiomas juntos (`{clave: {es, en, de, fr, it, pt}}`):
la paridad deja de ser algo que comprobar y al tocar una frase se ven las seis.
`tools/locales.cjs` compone y ABORTA si una clave falta, se repite en dos
sitios, la guarda un pack con un solo cliente o ya no la dice nadie;
`scripts/check-adventure-locales.cjs` lo comprueba además EN NEGATIVO.

Al escribir una frase: un diálogo no dice dónde está algo ni lo que ha pasado
fuera de plano, no enuncia lo que el jugador ve, y no repite instrucciones de
manejo. Lo que Ascua piensa en voz alta sí se queda: eso es el protagonista,
no un cartel.

## Los setines no se ganan en el bosque

El viejo del picnic da SUS REMOS y nada más, la vecina de las conchas recibe un
regalo y la fuente no cobra por un deseo (decisiones del dueño, 17-sep-2026).
Los setines son reputación y se ganan en la web.

Lo que NO se ha tirado es la maquinaria: los efectos `reward` y `spend`, los
peajes, los recuerdos que se dejan en un sitio y los tokens de precio siguen en
el motor y en el contrato del servidor, porque esto es un «de momento». Por eso
`catalog.json` conserva `economy.rewards` aunque ninguna regla lo use: es el
vocabulario de las partidas que ya están guardadas ahí fuera, y sin él una
partida con `claimed.picnic` dejaría de validar. `check-adventure-ascua.cjs`
comprueba las dos mitades por separado: que el mundo no cobra, y que la máquina
sigue sabiendo cobrar.
