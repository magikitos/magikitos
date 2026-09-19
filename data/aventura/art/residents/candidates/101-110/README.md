# Candidatos residentes 101–110

19-sep-2026. Diez identidades nuevas, **todas aprobadas por el dueño como protagonistas**.
**No hay integración, altas de NPC, cambios de catálogo, build ni despliegue.**
Esta carpeta conserva la selección visual original; las acciones completas y las
cards se entregan aparte en `../../../playable-cast/`. Estado y reconstrucción:
[entrega 101–110](../../../playable-cast/HANDOFF-101-110.md).

Abrir [index.html](index.html) en un navegador. [Resumen de diez](review/overview.png).
Cada número designa un **archivo de residente**, no un ID de variante runtime (el antiguo
actor 101/Brezo bruma NO es el nuevo archivo resident-101).

## Diseños

| Fuente | Apodo provisional | Identidad visual |
|---|---|---|
| [101](sheets/resident-101.png) | Rizo | Pelirrojo pecoso, cara afilada y sonrisa pícara; gorro mostaza y chaquetilla petróleo. |
| [102](sheets/resident-102.png) | Chispa | Pelo blanco corto, piel tostada, cara angular y sonrisa con carácter; turquesa y ladrillo. |
| [103](sheets/resident-103.png) | Tizon | Bajito y ancho, nariz redonda, cejazas y barba oscura; gorro teja y peto de artesano. |
| [104](sheets/resident-104.png) | Nispera | Cara redonda madura, hoyuelos y sonrisa risueña; gorro coral largo y vestido ciruela. |
| [105](sheets/resident-105.png) | Trebol | Anciano delgado, cara alargada y perilla plateada; gorro espiral salvia y chaleco naranja. |
| [106](sheets/resident-106.png) | Mimbrera | Rostro anguloso, nariz marcada y trenza gris; gorro azul asimétrico y abrigo ocre. |
| [107](sheets/resident-107.png) | Avellano | Mandíbula ancha, patillas pelirrojas y sonrisa desdentada; gorro violeta y peto azul. |
| [108](sheets/resident-108.png) | Oria | Pómulos y ceja marcada, mirada de granuja; gorro corto canela con pluma y ropa teal. |
| [109](sheets/resident-109.png) | Silo | Nariz prominente, gafitas y curiosidad de inventor; gorro beige curvado y abrigo rosa viejo. |
| [110](sheets/resident-110.png) | Zarza | Complexión fuerte, piel oscura y sonrisa abierta; gorro largo burdeos, collar y bolsa tejida. |

## Qué incluye esta ronda

Diez grids de ocho columnas × cuatro filas: reposo y tres pasos, 32 vistas por
identidad. Orden D8: abajo, abajo-derecha, derecha, arriba-derecha, arriba,
arriba-izquierda, izquierda, abajo-izquierda. Son los originales de identidad;
las hojas finales de las ocho acciones están en `playable-cast/<key>/review/`,
con 156 frames por personaje, card alfa y comprobaciones independientes.

Estilo mate y ropa remendada coherentes con el arte original. Rasgos faciales,
siluetas de gorros, edades y complexiones distintos; tonos de piel naturales.
Collares, broches, bolsitos y decoraciones acotados, legibles al reducir.

Corrección expresa: cada oreja tiene un solo contorno y una sola punta; no debe
haber una segunda punta de piel entre oreja, pelo y gorro. Los primeros intentos
101/103 requirieron una edición específica. El primer 102 se sustituyó por una
identidad facial más diferenciada. No usar los intentos antiguos como referencia.

## Archivos reproducibles

- `prompts/`: prompts exactos, incluidos refinamientos y corrección de orejas.
- `sources/`: originales de imagegen integrado; se conservan los ensayos.
- `selection.json`: cuál es el original vigente de cada propuesta.
- `sheets/`: grids seleccionados con el matte de recorte limpiado, sin redibujar.
- `review/`: recortes frontales, resumen y hashes de procedencia.
- `candidates.json`: fichas de autoría iniciales; no es el catálogo del juego.
- `prepare-review.php`: presentación offline, sin registrar nada en el motor.

```sh
php data/aventura/art/residents/candidates/101-110/prepare-review.php
```

La selección del generador y el recorte local son procesos distintos: las
correcciones anatómicas se hacen con imagegen, NO borrando partes de la oreja
por código. La preparación local solo limpia alfa/matte, recorta vistas y
compone la hoja comparativa. Los originales no se sobrescriben.

Los avisos de margen quedan registrados en `review/provenance.json`: son
maestros para **elegir diseños**, no certificación de atlas listos para runtime.
La preparación posterior está medida y revisada en `playable-cast/`; no sustituir
sus maestros por estos grids de selección. Seguir la entrega específica y
`docs/ROWING-ART.md` al integrar. Los PNG de autoría no se envían al navegador.
