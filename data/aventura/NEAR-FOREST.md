# Bosque Cercana · mapa jugable

Implementación local del estudio de escala aprobado. La web normal no se modifica.

## Dirección visual

El protagonista conserva sus 24×32 píxeles nativos. Las casas son refugios hechos
con bota, tocón, hojas, tronco, seta y maceta. Solo las cuatro entradas transitables
se muestran abiertas; los umbrales siguen exigiendo caminar hacia dentro.
Los IDs de colocaciones existentes conservan su identidad y punto de regreso:
un ID interno como `human-door` ya representa el refugio de hojas, no una casa humana.

Los árboles completos tienen copas, tronco y raíces sin cortes horizontales. Se
hornean a 368×440 (roble) y 302×428 (abedul), con ejemplares al 75 %; nunca se
amplifica un árbol antiguo de 54 píxeles. Plantas grandes tienen paquetes propios.
El culling usa los límites transformados del dibujo, no un margen fijo que haría
desaparecer una copa grande con los pies fuera de pantalla.

Los humanos sentados son de 106×108 y 110×105: adultos mayores que los duendes,
sin gigantismo. Manta, adultos, tortilla, cesta y cuchillo son piezas independientes.
La manta se ordena debajo de actores; los cuerpos y los objetos interactivos
mantienen colisión. Los utensilios son alcanzables desde suelo libre.

## Ruta y estado

Inicio/barbacoa → explorar al norte → picnic humano → utensilios → porción de seta
con cuchillo + palo → cocinar → entregar → humanos ausentes / Brizno satisfecho.

La primera entrega paga 10 setines locales, dos pasajes de 5. Después, la comida
se puede repetir cada cinco horas reales, sin repetir ese premio inicial.
`picnicFed` es memoria permanente; `timers.picnic` es la fecha de próxima hambre.
No hay estado por frame, escritura a SQL ni cambios de saldo en la web.
Al volver al juego se conservan herramientas, progreso y plazo.

Las porciones se cortan de una seta que permanece en el mapa. No se admite recoger
otra si ya hay porción o brocheta; el palo vuelve a estar disponible al consumirlo.
Partidas locales previas que ya terminaron la antigua receta pueden recoger el
cuchillo olvidado aunque los humanos se hayan ido; no se borran ni resetean partidas.

## Autoría y pruebas

Fuentes originales y prompts: [art/near-map-prompts.json](art/near-map-prompts.json).
Generación integrada image_gen; transparencia real preservada. Dos intentos de
editar entradas devolvieron un damero pintado y NO se usan en el juego.
El atlas definitivo se generó de nuevo. Crop, tamaño, anclas y empaquetado se
resuelven offline con el pipeline PHP/GD existente, sin escaneos al arrancar.

Se incorporó el cambio de camino hacia [57,54.5] y la reorganización del entorno
de la taberna del Studio. Las terminaciones se ajustaron a las nuevas puertas y
se añadió el ramal de picnic. La propuesta original conserva copia de recuperación.

- `npm test`: reglas, todos los órdenes de ingredientes, rutas, geometría y ahorro.
- `npm run test:picnic`: recogidas y receta por clic, cinco tamaños de pantalla,
  primera recompensa, humanos ausentes, recarga y vencimiento con reloj de prueba.
- `npm run test:browser`: siete viewports, interiores, seis idiomas, puertas y barca.
- `npm run test:native`: las actividades JSON siguen funcionando en sus zonas.

Los tests usan perfiles aislados y peticiones solo locales. El reloj adelantado
pertenece al navegador desechable del test, nunca a la sesión del usuario.
