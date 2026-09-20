<?php
declare(strict_types=1);

/**
 * ⛔ LA ENTRADA DE UNA CASA SE PUEDE DIBUJAR A MANO (20-sep-2026, decisión del dueño: «debo poder
 * definir bien las entradas de las casitas y edificios yo manualmente porque hay algunos que no
 * cuadran»). `entrance` = [dx, dy, ancho, alto] en casillas RELATIVAS al pie de la puerta: la
 * franja que abre la puerta. Se escribe desde el Studio, viaja en el JSON de la escena y aquí se
 * convierte en el mismo `threshold`/`arrival` que la puerta derivada, así que el motor, el
 * contrato del bosque vivo y las pruebas no distinguen una entrada dibujada de una calculada.
 * Sin `entrance`, todo sigue derivándose del pie de la puerta como siempre. Gemelo en JS:
 * `doorGeometry` (portals.js), con prueba de paridad (`check-door-geometry.cjs`).
 */
const ENTRANCE_LIMITS = ['offset' => 12, 'width' => [0.25, 2], 'height' => [1 / 16, 0.5]];

function adventureEntrance(array $entity): ?array
{
    if (!array_key_exists('entrance', $entity)) {
        return null;
    }
    $e = $entity['entrance'];
    if (!is_array($e) || count($e) !== 4 || array_keys($e) !== [0, 1, 2, 3]) {
        throw new RuntimeException('Entrance must be [dx, dy, width, height]: ' . $entity['id']);
    }
    foreach ($e as $v) {
        if (!is_int($v) && !is_float($v) || !is_finite((float) $v)) {
            throw new RuntimeException('Entrance must be numeric: ' . $entity['id']);
        }
    }
    [$dx, $dy, $w, $h] = array_map(static fn($v) => (float) $v, $e);
    if (
        abs($dx) > ENTRANCE_LIMITS['offset'] || abs($dy) > ENTRANCE_LIMITS['offset']
        || $w < ENTRANCE_LIMITS['width'][0] || $w > ENTRANCE_LIMITS['width'][1]
        || $h < ENTRANCE_LIMITS['height'][0] || $h > ENTRANCE_LIMITS['height'][1]
    ) {
        throw new RuntimeException('Entrance out of range: ' . $entity['id']);
    }
    if (($entity['portal'] ?? null) === 'stairs') {
        throw new RuntimeException('Stairs derive their landing; no authored entrance: ' . $entity['id']);
    }
    return [$dx, $dy, $w, $h];
}

/** One source for authored doors and interiors resized to fit live catalogue displays. */
function adventureDoorGeometry(array $scene, array $entity): array
{
    $entrance = adventureEntrance($entity);
    if ($entrance !== null) {
        [$dx, $dy, $w, $h] = $entrance;
        $indoor = !empty($scene['indoor']);
        if ($indoor && $entity['y'] >= $scene['height'] - 2) {
            throw new RuntimeException('Indoor door outside walkable floor');
        }
        $top = $entity['y'] + $dy;
        return [
            'threshold' => [$entity['x'] + $dx, $top, $w, $h],
            'entryDirection' => $indoor ? 1 : -1,
            'arrival' => [$entity['x'] + $dx + $w / 2, $indoor ? $top - 2 : $top + $h + 2],
        ];
    }
    if (($entity['portal'] ?? null) === 'stairs') {
        // Cover the landing up to the physical stair face. A player may already be
        // against it when the arrival cooldown ends, including after a diagonal approach.
        $front = $entity['y'] + $entity['solid'][1] + $entity['solid'][3];
        return [
            'threshold' => [$entity['x'] - 0.7, $front, 1.4, $entity['y'] + 0.35 - $front],
            'arrival' => [$entity['x'], $entity['y'] + 1.7],
        ];
    }
    if (!empty($scene['indoor'])) {
        // Feet can approach to 5 native pixels from the room boundary.
        $top = $scene['height'] - 2 - 9 / 16;
        if ($entity['y'] >= $scene['height'] - 2) {
            throw new RuntimeException('Indoor door outside walkable floor');
        }
        return [
            'threshold' => [$entity['x'] - 0.5, $top, 1, 4 / 16],
            'entryDirection' => 1,
            'arrival' => [$entity['x'], $top - 2],
        ];
    }
    $floor = isset($entity['solid'])
        ? $entity['y'] + $entity['solid'][1] + $entity['solid'][3] + 6 / 16
        : $entity['y'] - 0.3;
    return [
        'threshold' => [$entity['x'] - 0.5, $floor, 1, 6 / 16],
        'entryDirection' => -1,
        'arrival' => [$entity['x'], $floor + 2],
    ];
}
