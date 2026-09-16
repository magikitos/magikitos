# Después del río: propuestas para decidir

15-sep-2026. Ideas, **no implementación ni alcance aprobado**. Parten del río
navegable, la barca de botella, la parcela editable y el guardado por identidad
de esta entrega. No recuperan el barquero de pago, el Libro del Bosque ni la
expansión de poses de los cien NPC.

## La siguiente entrega que elegiría

**«La primera cena en mi kelihouse».** No ampliar kilómetros: cerrar una pequeña
aventura que conecte lo que ya tenemos. Salgo porque quiero preparar algo,
me pasa una historia en el bosque o el río, vuelvo con un recuerdo y alguien
se sienta en mi casa. La parcela deja de ser un editor y se convierte en un
lugar al que apetece regresar.

Una meta de diseño, no una estimación de desarrollo: que en una sesión de unos
20–30 minutos pueda vivirse un episodio completo, con un secreto opcional y
un cambio visible al terminar. Sin exigir esperar cinco horas ni volver mañana.

## 1. La fiambrera que se resiste

En el merendero queda una fiambrera tras la marcha de los humanos. Por una
rendija se ve una servilleta estampada, perfecta para la mesa del duende.
El cierre de plástico parece enorme, pero su funcionamiento se entiende mirando.

Primera solución: empujar un tapón hasta el apoyo y usar el palo como palanca.
Segunda, si merece la pena producirla: cortar una atadura que permite desplazar
el recipiente y alcanzar el cierre trasero. Las dos son soluciones diseñadas;
no prometemos que cualquier objeto sirva ni física universal.

Al abrir, una aceituna sale rodando y desplaza al protagonista unos pasos, sin
daño ni pérdida. Dentro hay un ingrediente y la servilleta: una recompensa útil
y otra que se ve en casa. El recipiente abierto permanece así al regresar.

**Base aprovechable:** empujes, cuchillo, inventario, colisiones, variantes y
reglas de reacción. Harían falta dos estados artísticos del recipiente, anclas
de interacción y quizá un interior pequeño. Complejidad media. El mayor riesgo
es que las pistas no se entiendan: hay que probarlo con alguien que no conozca
la solución. No introduciría hormigas simuladas, cuerdas y electricidad juntos.

## 2. El río cuenta tres historias, no tiene cien obstáculos

Elegiría tres encuentros repartidos entre los tramos actuales:

- **La rama atravesada:** el cauce parece cerrado; mirar el remolino revela un
  paso lateral. Usar la corriente hace el viaje más fácil, no solo más difícil.
- **El pez bajo la botella:** una sombra y una estela avisan antes de un coletazo.
  Esperar en el remanso o bordear su zona son respuestas válidas. Equivocarse
  devuelve a una orilla conocida, nunca a una pantalla de muerte.
- **El embarcadero escondido:** una luz entre raíces señala un desvío tranquilo.
  Encontramos una concha que hace de cuenco o un farol para casa. No todo acaba
  en persecución o premio monetario.

**Base aprovechable:** campos de corriente, colisiones de casco, salidas y carga
por tramo. El pez puede ser una secuencia local con estados, no una criatura
simulada en todo el río. Complejidad media; antes de dibujarlo, probar la lectura
de señales en móvil, donde se ve menos río. Entrada segura y margen para frenar.

Una vez conocido un recorrido, permitiría tomar un atajo entre embarcaderos
descubiertos. Navegar por gusto sí; repetir obligatoriamente los rápidos cada
vez que visitamos a alguien, no. El atajo necesitaría reglas propias y una
transición breve, no está implementado en esta entrega.

## 3. Mi casa reacciona a lo que pongo

Tres relaciones pequeñas bastan para empezar:

- Un conjunto de flores favorece una visita de mariposas.
- Un rincón de hojas y sombra trae un caracol ocasional.
- Una mesa, un asiento y una comida preparada permiten invitar a un vecino.

No se trata de llenar una barra invisible de decoración. Cada relación tiene
una pista visual, una consecuencia reconocible y variantes para que dos
parcelas no representen exactamente la misma escena.

**Cómo:** evaluar etiquetas de los objetos y condiciones al entrar o terminar
una edición; seleccionar uno o dos visitantes con una semilla estable para esa
visita. Animación en el navegador. No simular parcelas vacías ni generar fauna
sin límite, y no alterar objetos ajenos cuando se visita una instantánea.
Complejidad baja/media para ambiente; invitar y recompensar requiere estado
adicional. No debería morir un jardín por no conectarse.

## 4. Brizno deja de ser una máquina de brochetas

Tres recetas, tres pequeñas historias. La primera ya existe. La siguiente puede
usar una hierba aromática que se reconoce por su olor; otra, el ingrediente de
la fiambrera. Cada comida revela una preferencia, una anécdota o una contradicción
del personaje, y provoca algo visible: aparece en nuestra cena, trae una silla
vieja o enseña una manera de cocinar.

La repetición cada cinco horas permanece como actividad opcional. No bloquearía
la historia detrás del hambre real ni multiplicaría recetas que solo cambian
de nombre. Inicialmente: ingrediente + preparación + reacción. Sin árbol de
habilidades, energía, desgaste ni diez estaciones de cocina.

**Cómo:** recetas como datos, requisitos, consumo atómico y consecuencias por
bandera, reutilizando el motor existente. Nuevas animaciones de cocina solo
cuando una acción las necesite. Complejidad media. Una mesa para dos prueba la
fantasía del futuro restaurante antes de construir empleados, horarios y cajas.
La muerte del anciano no debería ser el siguiente paso: primero debe importarnos
por lo que hemos vivido con él, no por el terreno o los premios que entrega.

## 5. Visitar una casa me da ganas de salir de aventura

Los recuerdos especiales podrían dar una pista al tocarlos: «Esta concha apareció
en el recodo donde el agua corre al revés». Nada de inventarios del dueño, guías
automáticas completas ni un botón para comprar la misma recompensa.

Después añadiría guardar una dirección conocida y viajar directamente desde el
muelle. La dirección sigue a la parcela, no a un lugar aleatorio del río. Se puede
representar con una hoja marcada en el embarcadero, sin recuperar un cuaderno
gordo de navegación.

**Cómo:** catálogo de recuerdos/pistas del lado juego; favoritos asociados a
identidad por la API privada. El estado público sigue siendo una instantánea,
sin sockets. Complejidad baja para pistas; media para direcciones guardadas y
viaje directo. No metería comercio, regalos transferibles o mensajes libres en
esta primera capa: necesitan reglas económicas, abuso y moderación aparte.

## 6. Una herramienta nueva que cambie tres lugares conocidos

Mi candidata sería un **gancho de alambre con hilo**, no otra llave de una sola
puerta. Puede recuperar una chapa al otro lado de una raíz, acercar una pasarela
ligera y alcanzar un pequeño saliente en un refugio que ya conocíamos.

Primero marcaríamos solo tres puntos coherentes de enganche y una distancia
clara. Acción contextual con el mismo clic, sin añadir botones permanentes ni
rotación de cámara. Más adelante se amplía el vocabulario.

**Cómo:** anclas y conexiones definidas en las escenas, condición de herramienta,
trayectoria y animación del protagonista. No cuerda física universal ni trepa
libre sobre todo sprite. Complejidad media/alta; es la propuesta que dejaría
para después de comprobar las primeras cenas y visitas.

## Orden y prueba de calidad

1. Observar cinco partidas nuevas de principio a parcela, sin dar instrucciones:
   ¿se entiende la receta de la barca, la corriente, desembarcar y guardar?
   Anotar tropiezos manualmente; no hace falta enviar cada movimiento a events.
2. Producir un episodio con fiambrera, una recompensa de hogar y primera cena.
3. Hacer reaccionar la parcela e introducir un encuentro fluvial memorable.
4. Conectar recuerdos públicos y direcciones guardadas.
5. Introducir el gancho cuando haya tres lugares reales que lo aprovechen.

Para cada episodio probar: jugarlo sin saber la solución; resolverlo en distinto
orden; salir y volver a mitad; perder conexión; repetir interacciones sin duplicar
premios; navegar en móvil; tener un motivo para recordar el lugar después.

## Lo que no conviene prometer todavía

El monedero actual es progreso aportado por el cliente y validado en forma y
límites, **no una economía resistente a trampas**. Antes de intercambiar objetos,
ofrecer premios competitivos o conectar dinero/reputación reales, hace falta
autoridad del servidor para premios, compras y existencias. No basta con ocultar
el JavaScript. No lo tocaría para las pequeñas aventuras personales propuestas.

Tampoco construiría aún prestigio territorial, simulación universal, clima que
bloquee la partida, un MMO, centenares de animaciones de avatar ni una caravana
completa. Son proyectos distintos en coste y pruebas. La ventaja ahora es cerrar
una historia con los sistemas que ya existen y comprobar que apetece volver.
