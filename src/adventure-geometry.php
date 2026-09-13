<?php
declare(strict_types=1);

/** One source for authored doors and interiors resized to fit live catalogue displays. */
function adventureDoorGeometry(array $scene, array $entity): array
{
    if (!empty($scene['indoor'])) {
        $top = $entity['y'] - 0.6;
        $depth = $scene['height'] - 2 - $top;
        if ($depth <= 0) {
            throw new RuntimeException('Indoor door outside walkable floor');
        }
        return [
            'threshold' => [$entity['x'] - 0.75, $top, 1.5, $depth],
            'arrival' => [$entity['x'], $top - 2],
        ];
    }
    $floor = isset($entity['solid'])
        ? floor($entity['y'] + $entity['solid'][1] + $entity['solid'][3]) + 1.4
        : $entity['y'] - 0.3;
    return [
        'threshold' => [$entity['x'] - 0.6, $floor, 1.2, 0.6],
        'arrival' => [$entity['x'], $floor + 2],
    ];
}
