# Definición y vida ambiental · contrato vigente

Aprobado el 14 septiembre 2026 e implementado en el pipeline del juego:
**2× con reducción integrada; animación ambiental selectiva y lenta.**

## Textura, tamaño y memoria

`ADVENTURE_ART_PROFILE` en el empaquetador es la única política de producción.
Los originales se conservan; la reducción de área y el alfa se preparan offline.
El navegador recibe packs PNG nativos, no maestros ni un escaneo alfa al arrancar.

Dos píxeles de textura corresponden a una unidad lógica. El tamaño del duende,
la cámara, los pies, los crops del Studio y las colisiones no se duplican.
El manifiesto declara densidad, rectángulo físico, tamaño lógico, ancla y área
visible. Todo recorte del Studio transforma las coordenadas una sola vez.

A igualdad de área y RGBA, 2× ocupa cuatro veces la memoria de textura de 1×.
La compresión PNG y el peso transferido no siguen ese factor exacto.
Los paquetes se cargan por escena/acción, con caché acotada; arco y acciones
ocasionales no tienen que descargarse para empezar a caminar.

## Movimiento

- Árboles, helechos, arbustos y algunas flores: selección determinista,
  fases distintas, ráfagas pequeñas de 4,5 segundos y descansos largos.
  Raíz fija; nada de estirar casas, macetas o muebles.
- Picnic y momentos importantes: poses dibujadas, con pausas y gestos con
  intención. Pies sentados fijos; humo y objetos en capas independientes.
- No se convierten los elementos a GIF. Un atlas comparte decodificación,
  respeta la pausa del juego y permite cargar/liberar una acción como módulo.
- No existe un FPS global aprobado de 12 o 24. Cada clip declara duraciones.
  Cantidad de poses y frecuencia de actualización son cosas distintas.
- Movimiento reducido desactiva ambientación y acorta las presentaciones sin
  esconder su significado. El juego detiene el trabajo al ocultar la pestaña.

## Experimento archivado

Studio → Laboratorio → Trazo y vida conserva la comparación original entre
1×/2×/3×, integrada/nítida y diferentes intensidades de movimiento.
Su baseline es un archivo inmutable con hashes: no vuelve a hornearse desde el
arte actual, porque dejaría de representar la prueba que eligió el propietario.

La galería activa usa el manifiesto actual 2× y los cambios del único workspace
local. Visitar experimentos no cambia posiciones, crops ni guardados.

Ver [Ascua y poses](DUENDES.md), la
[guía del experimento](../../tools/adventure-studio/experiments/definition-motion/README.md)
y el [registro de verificación](../ASCUA-RELEASE.md).
