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
Los paquetes de entorno se cargan por escena y los duendes por viewport/acción.
La caché cuenta bytes RGBA, incluidas cargas pendientes; arco y rodar ya no
tienen declaración de producción. Política y pruebas en [RESIDENTS.md](../RESIDENTS.md).

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

La comparación original entre 1×/2×/3×, integrada/nítida y diferentes intensidades
de movimiento queda en el historial Git; no es una pestaña del Studio vigente.
La elección de producción es la descrita arriba, no una opción por dispositivo.

La galería activa usa el manifiesto actual 2× y los cambios del único workspace local.

Ver [Ascua y poses](DUENDES.md) y el [registro de verificación](../RELEASE.md).
