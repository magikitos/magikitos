<?php
/** Compile scene placements and reusable interactions. No quest-specific PHP branches. */
declare(strict_types=1);
require_once __DIR__ . '/../../src/adventure-geometry.php';

return (static function (): array {
    $read = static fn(string $file): array => json_decode(
        file_get_contents($file), true, flags: JSON_THROW_ON_ERROR
    );
    $world = $read(__DIR__ . '/catalog.json');
    $world['resourceRegions'] = $read(__DIR__ . '/resource-nodes.json');
    // Only lightweight identities ship to browsers, never the production prompts or source masters.
    $world['avatarProfiles'] = $read(__DIR__ . '/residents.json');
    $world['avatarVariants'] = array_column($world['avatarProfiles'], 'id');
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
    $families = $read(__DIR__ . '/elements.json')['families'];
    $world['homesteads'] = $read(__DIR__ . '/homesteads.json');
    $world['construction'] = $read(__DIR__ . '/construction.json');
    foreach ($world['construction']['definitions'] as &$construction) {
        if (isset($construction['family'])) {
            $family = $families[$construction['family']] ?? throw new RuntimeException('Unknown construction family');
            $construction['variants'] = array_map(static fn($v) => ['id'=>$v['id'], 'sprite'=>$v['sprite']], $family['variants']);
        } else {
            $construction['variants'] ??= [['id'=>'original', 'sprite'=>$construction['sprite']]];
        }
        $construction['scale'] ??= 1;
    }
    unset($construction);
    foreach ($world['homesteads']['stock'] as $id => &$item) {
        $family = $families[$id] ?? throw new RuntimeException('Unknown homestead family');
        $item['variants'] = array_map(static fn($v) => ['id' => $v['id'], 'sprite' => $v['sprite']], $family['variants']);
        $item['solid'] = $family['template']['solid'] ?? null;
        $item['scale'] ??= 1;
    }
    unset($item);
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
        foreach ($scene['navigation']['landings'] ?? [] as $landing) {
            $dock = array_values(array_filter($scene['entities'], static fn($e) => ($e['landing'] ?? null) === $landing['id']))[0] ?? null;
            if (!$dock) throw new RuntimeException('Landing without dock: ' . $landing['id']);
            $scene['entities'][] = [
                'id' => 'moored-' . $landing['id'], 'sprite' => 'bottle-boat',
                'x' => $landing['water'][0], 'y' => $landing['water'][1],
                'rules' => [], 'interactAs' => $dock['id'], 'generated' => 'landing-vessel',
                'visibleWhen' => ['items' => ['boat' => 1]] + (count($scene['navigation']['landings']) > 1 ? ['landing' => $landing['id']] : []),
                'hiddenWhen' => ['navigation' => 'boat'],
            ];
        }
        $seen = [];
        foreach ($scene['entities'] as &$entity) {
            foreach ($families as $familyId => $family) {
                if (($entity['family'] ?? null) !== $familyId && !in_array($entity['sprite'] ?? null, $family['aliases'], true)) continue;
                if (($family['entrance'] ?? null) === 'open') {
                    $entity = array_replace($family['template'], $entity);
                    if (empty($entity['portal']) || !array_filter($entity['rules'], static fn($r) => array_filter($r['effects'], static fn($e) => $e['type'] === 'travel')))
                        throw new RuntimeException('Open building without entrance: '.$entity['id']);
                }
                break;
            }
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
            $resources = $world['resourceRegions'][$name] ?? null;
            $nodeIndex = $resources ? array_search($entity['id'], $resources['nodes'], true) : false;
            if ($nodeIndex !== false) {
                $entity['resource'] = ['region' => $name, 'index' => $nodeIndex, 'renewMs' => $resources['renewMs']];
            }
            if (isset($entity['harvest'])) {
                $region = 'harvest-' . $name . '-' . $entity['harvest']['renewMs'];
                $world['resourceRegions'][$region] ??= ['renewMs' => $entity['harvest']['renewMs'], 'nodes' => []];
                $index = count($world['resourceRegions'][$region]['nodes']);
                $world['resourceRegions'][$region]['nodes'][] = $entity['id'];
                $entity['resource'] = ['region'=>$region, 'index'=>$index, 'renewMs'=>$entity['harvest']['renewMs'], 'keepVisible'=>true, 'empty'=>$entity['harvest']['empty']];
                foreach ($entity['rules'] as &$r) if (array_filter($r['effects'], static fn($e) => $e['type']==='item' && $e['amount']>0)) array_unshift($r['effects'], ['type'=>'collect']);
                unset($r);
            }
            foreach ($entity['rules'] as $resourceRule) foreach ($resourceRule['effects'] as $resourceEffect)
                if ($resourceEffect['type'] === 'collect' && !isset($entity['resource'])) throw new RuntimeException('Pickup missing stable resource index: ' . $entity['id']);
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
    // Read-only visits reuse the same authored spaces, not copied maps per owner or visitor.
    foreach ($read(__DIR__ . '/scene-instances.json') as $id => $instance) {
        if (isset($world['scenes'][$id]) || !isset($world['scenes'][$instance['template']])) throw new RuntimeException('Invalid scene instance');
        $scene = $world['scenes'][$instance['template']];
        $scene['id'] = $id;
        $scene['label'] = $instance['label'];
        foreach ($scene['entities'] as &$entity) foreach ($entity['rules'] as &$rule) foreach ($rule['effects'] as &$effect)
            if ($effect['type'] === 'travel') $effect['scene'] = $instance['destinations'][$effect['scene']] ?? $effect['scene'];
        unset($entity, $rule, $effect);
        $world['scenes'][$id] = $scene;
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
                }
            }
        }
    }
    unset($scene, $entity, $rule, $effect);
    return $world;
})();
