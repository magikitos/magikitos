# El Diario del Bosque

Implementado el 23-sep-2026 en el juego (este repo) y en la web (`magikitos`, dueña del API, la
base, el juez y las cuentas). Arte: [`REQUIRED-ART.md`](REQUIRED-ART.md).

## Qué es

Un libro gordo sobre una mesa de la plaza del restaurante, en la pradera. Cualquiera que pasa lo
lee; quien tiene cuenta deja **una página al día como mucho**, de **10 a 400 palabras**. Es un
registro colectivo de lo que siente el bosque: la alegría de hoy, un examen de mañana, el gato que
se ha muerto.

- **El nombre**: «El Diario del Bosque», y lo que se deja dentro es **una página**. «Diario de
  sentimientos» se quedaba estrecho y sonaba a ficha de terapia; «confesiones» pesaba demasiado.
- **Un diario por idioma**, como el diccionario: una confesión traducida deja de ser de quien la
  escribió.
- **Sin setines, rachas ni avisos.** Si una página diera puntos, el diario se llenaría de páginas
  escritas por los puntos. Escribir es opcional siempre.
- Se firma con el **nombre visible del momento** (se copia al publicar). Si se borra la cuenta, la
  página se queda firmada como «Alguien del bosque».

## El recorrido

1. Se toca el libro (o su mesa) y se abre por la página de hoy. En ancho se leen dos páginas; en
   el teléfono, una, y se pasa de una en una.
2. Se escribe pulsando la pluma dorada pintada en la esquina de la página. La página en blanco
   del libro se vuelve el papel (a la derecha, junto a la última publicada; en el teléfono, la
   única página), con el contador, descartar y «Dejarla en el diario» en su pie: nada debajo del
   libro, así que nunca hay que hacer scroll para enviar. El borrador vive en el navegador
   (`localStorage`, `magikitos.diary.draft`) hasta publicarse o descartarse.
3. Al enviar **sin cuenta real** se abre el panel de cuenta del juego (Google o código). Nada sale
   del navegador; al volver con cuenta, el libro se abre con el borrador.
4. Con cuenta: Turnstile (la ventana de una hora de la casa) y el juez. Veredictos:
   - **publicada**: aparece la primera y el día queda gastado;
   - **rechazada**: se dice por qué y **no gasta el día**, se corrige y se vuelve a intentar;
   - **pide ayuda**: no se publica, se contesta con cariño y con el teléfono de ayuda del país
     (024 en España), y le llega un aviso al dueño sin el texto en el asunto.

## El juez (web)

`prompts/diario/juez.md`. Solo DECIDE: `publicar`, `rechazar` con un motivo cerrado
(`datos_personales`, `terceros`, `no_es_una_pagina`, `odio`, `sexual`, `instrucciones`) o
`acompanar`. La página viaja como DATO, nunca como instrucción. Las frases que ve la persona son
textos fijos traducidos (`diario.*` en `lang/*.php`): el modelo no escribe nada, así que no puede
inventarse un teléfono ni prometer nada. Un nombre de pila suelto vale («soy Álvaro y me siento
triste porque se ha muerto mi gato»); apellidos, teléfonos, correos, enlaces o señalar a alguien
reconocible, no.

Antes del juez, sin gastar un céntimo: forma (palabras, cuenta real, una al día) y una regex de
datos de contacto (correos, teléfonos, enlaces, @usuarios) que rechaza sola.

## Nombres: el cambio global

Google trae nombre y apellidos, y hasta hoy iban a `users.name`, o sea a cada firma pública y al
handle de la URL del perfil. Desde el 23-sep-2026:

- `users.real_name` (privado, no se pinta en ninguna parte) guarda el nombre de Google y el nombre
  y apellidos que se escriben al guardar la cuenta desde el modal o desde el peldaño del aporte.
  Sirve para tratar a la persona por su nombre y para saber a quién dar un premio.
- La cuenta nace con su **nombre del bosque** («Lechuza Traviesa») y su handle sale de él.
- Firmar con el nombre real es decisión de la persona: lo escribe ella en Ajustes.
- Las cuentas que ya existían no se renombran solas. La privacidad lo explica en seis idiomas.
- `real_name` viaja en la fusión de cuentas (rellena huecos, no pisa).

## Dónde vive

| Pieza | Fichero |
| --- | --- |
| Tabla `forest_diary` y `users.real_name` | web `migrations/4243_diario_del_bosque.sql` |
| Lógica, juez, lista y moderación | web `src/functions-forest-diary.php` |
| API `diary` (GET) y `diary-write` (POST) | web `src/world-diary.php`, contrato en `docs/world-api.openapi.json` |
| Panel: leer, ver lo rechazado y lo que pide ayuda, borrar | web `/administrar-el-mambo/diario` |
| Barrido: lo no publicado se borra a los 30 días | web `cron/cron.php` (bloque nocturno) |
| El libro | juego `public/assets/js/adventure/diary.js`, `public/assets/css/adventure-diary.css` |
| La mesa, el libro que pasa hojas y la sala `diary` | juego `data/aventura/scenes/overworld.json`, `catalog.json` |
| Los vecinos que se acercan a leerlo | juego `data/aventura/life.json` (`forest-diary: read`) |
| Prueba en navegador | juego `npm run test:diary` |

Borrar una página publicada desde el panel le devuelve el día a quien la escribió.

## Decisiones tomadas

- Se firma siempre con el nombre visible; no hay «firmar como alguien del bosque» a voluntad (sí
  queda así al borrar la cuenta).
- No hay reacciones: una confesión no se puntúa.
- El diario vive en el bosque; no tiene página propia en la web.
