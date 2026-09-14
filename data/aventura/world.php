<?php
/** Compile scene placements and reusable interactions. No quest-specific PHP branches. */
declare(strict_types=1);
require_once __DIR__ . '/../../src/adventure-geometry.php';

return (static function (): array {
    $read = static fn(string $file): array => json_decode(
        file_get_contents($file), true, flags: JSON_THROW_ON_ERROR
    );
    $world = $read(__DIR__ . '/catalog.json');
    // Resolve fare references once; condition consumers do not need a global catalogue.
    $resolve = static function (array $node) use (&$resolve, $world): array {
        foreach ($node as &$value) {
            if (is_array($value)) {
                $value = $resolve($value);
            }
        }
        unset($value);
        if (isset($node['funds'])) {
            $amount = $world['economy']['fares'][$node['funds']] ?? null;
            if (!is_int($amount) || $amount <= 0) {
                throw new RuntimeException('Unknown condition fare');
            }
            $node['funds'] = $amount;
        }
        return $node;
    };
    $behaviors = [];
    foreach (glob(__DIR__ . '/behaviors/*.json') as $file) {
        foreach ($read($file) as $id => $behavior) {
            if (isset($behaviors[$id])) {
                throw new RuntimeException("Duplicate behavior: $id");
            }
            $behaviors[$id] = $behavior;
        }
    }
    foreach (glob(__DIR__ . '/scenes/*.json') as $file) {
        $scene = $read($file);
        $name = basename($file, '.json');
        if ($scene['id'] !== $name) {
            throw new RuntimeException("Scene filename mismatch: $name");
        }
        $seen = [];
        foreach ($scene['entities'] as &$entity) {
            if (isset($seen[$entity['id']])) {
                throw new RuntimeException("Duplicate entity in $name");
            }
            $seen[$entity['id']] = true;
            if (isset($entity['behavior'])) {
                $id = $entity['behavior'];
                if (!isset($behaviors[$id])) {
                    throw new RuntimeException("Unknown behavior: $id");
                }
                $entity = array_replace($behaviors[$id], $entity);
                unset($entity['behavior']);
            }
            foreach ($entity['rules'] as &$rule) {
                foreach ($rule['effects'] as &$effect) {
                    if ($effect['type'] === 'travel' && !isset($effect['scene'])) {
                        if (!isset($entity['destination'])) {
                            throw new RuntimeException('Missing travel destination');
                        }
                        $effect = array_replace($effect, $entity['destination']);
                    }
                }
                unset($effect);
            }
            unset($rule, $entity['destination']);
            if (!empty($entity['portal'])) {
                $entity = array_replace($entity, adventureDoorGeometry($scene, $entity));
            } elseif (!isset($entity['solid']) && !empty($entity['rules'])) {
                $entity['solid'] = [-0.4, -0.5, 0.8, 0.7];
            }
        }
        unset($entity);
        foreach ($scene['entities'] as $entity) {
            if (isset($entity['interactAs'])) {
                $target = array_values(array_filter($scene['entities'], static fn($e) => $e['id'] === $entity['interactAs']))[0] ?? null;
                if (!$target || isset($target['interactAs']) || empty($target['rules'])) {
                    throw new RuntimeException('Invalid interaction target: ' . $entity['id']);
                }
            }
        }
        $world['scenes'][$name] = $resolve($scene);
    }
    // Portal arrivals follow authored buildings; return trips never duplicate their coordinates.
    $arrivals = [];
    foreach ($world['scenes'] as $id => $scene) {
        foreach ($scene['entities'] as $entity) {
            if (!empty($entity['portal']) && isset($entity['arrival'])) {
                $arrivals[$id][$entity['id']] = $entity['arrival'];
            }
        }
    }
    foreach ($world['scenes'] as &$scene) {
        foreach ($scene['entities'] as &$entity) {
            foreach ($entity['rules'] as &$rule) {
                foreach ($rule['effects'] as &$effect) {
                    if ($effect['type'] === 'travel' && !isset($world['scenes'][$effect['scene']])) {
                        throw new RuntimeException('Unknown travel destination');
                    }
                    if ($effect['type'] === 'travel' && !empty($effect['spawn'])) {
                        $effect['x'] = $world['scenes'][$effect['scene']]['spawn']['x'];
                        $effect['y'] = $world['scenes'][$effect['scene']]['spawn']['y'];
                        unset($effect['spawn']);
                    }
                    if ($effect['type'] === 'travel' && isset($effect['arrivalAt'])) {
                        $id = $effect['arrivalAt'];
                        if (!is_string($id) || !isset($arrivals[$effect['scene']][$id])
                            || isset($effect['x']) || isset($effect['y'])) {
                            throw new RuntimeException('Invalid or ambiguous portal arrival');
                        }
                        [$effect['x'], $effect['y']] = $arrivals[$effect['scene']][$id];
                        unset($effect['arrivalAt']);
                    }
                    if ($effect['type'] === 'travel' && isset($effect['presentation'])
                        && !isset($world['transports'][$effect['presentation']])) {
                        throw new RuntimeException('Unknown travel presentation');
                    }
                }
            }
        }
    }
    unset($scene, $entity, $rule, $effect);
    return $world;
})();
