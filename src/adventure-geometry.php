<?php
declare(strict_types=1);

/** One source for authored doors and interiors resized to fit live catalogue displays. */
function adventureDoorGeometry(array $scene, array $entity): array
{
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
