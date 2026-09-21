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
    /**
     * ⛔ EL ELENCO QUE SE PUEDE ELEGIR SE DERIVA, NO SE ESCRIBE.
     *
     * Era una lista a mano en `player-art.json` y una lista a mano caduca: el dueño va subiendo
     * hojas de arte de una en una, y cada vez habría que acordarse de tocar el JSON —o peor, se
     * ofrecería un duende a medio dibujar—. Un personaje se puede ELEGIR cuando tiene sus siete
     * acciones horneadas y su remo medido, y eso se puede preguntar. Así el elenco crece solo el
     * día que su arte entra, y nunca antes.
     *
     * Las dos condiciones son las mismas que ya exige `check-rowing-contract.cjs`; aquí se
     * calculan en vez de repetirse, que es lo que impide que las dos versiones se separen.
     */
    $world['playerArt'] = $read(__DIR__ . '/player-art.json');
    $acciones = array_keys($read(__DIR__ . '/art/residents/actions/catalog.json')['actions']);
    $paquetes = $read(__DIR__ . '/../../public/assets/aventura/manifest.json')['packs'];
    $ofrecidos = [];
    foreach (array_keys($world['playerArt']['rowingRigs']) as $id) {
        foreach ($acciones as $accion) {
            if (!isset($paquetes["actor-$id-$accion"])) {
                continue 2;
            }
        }
        $ofrecidos[] = (int) $id;
    }
    sort($ofrecidos);
    $world['playerArt']['enabledVariants'] = $ofrecidos;
    if (!in_array($world['playerArt']['defaultVariant'], $ofrecidos, true)) {
        throw new RuntimeException('The default duende is not fully drawn');
    }
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
    $world['construction'] = $read(__DIR__ . '/construction.json');
    // ⛔ EL NOMBRE DE UNA VARIANTE VIENE DE AQUÍ Y NO DE LA FAMILIA. `elements.json` ya trae un
    // `label` por variante, pero es del Estudio: está en castellano y solo en castellano. El
    // catálogo de construir lo leen seis idiomas y enseña las variantes una al lado de otra, así
    // que sin esto salían dos baldosas llamadas igual —el mismo banco dos veces— y parecía un
    // fallo. El mapa va por ID de variante porque dentro de construir un id significa siempre lo
    // mismo («ramitas» son ramitas en el banco y en la mesa), así que doce palabras cubren las
    // siete cosas con variante y la octava que nazca las hereda.
    $variantLabels = $world['construction']['variantLabels'] ?? [];
    unset($world['construction']['variantLabels']);
    $variant = static function (array $v) use ($variantLabels): array {
        // El `label` de la familia se queda fuera A PROPÓSITO: es castellano del Estudio. El que
        // viaja al juego es una clave de textos, y solo si el mapa la tiene.
        if (isset($variantLabels[$v['id']])) $v['label'] = $variantLabels[$v['id']];
        else unset($v['label']);
        return $v;
    };
    foreach ($world['construction']['definitions'] as &$construction) {
        if (isset($construction['family'])) {
            $family = $families[$construction['family']] ?? throw new RuntimeException('Unknown construction family');
            $construction['variants'] = array_map($variant, array_map(
                static fn($v) => ['id' => $v['id'], 'sprite' => $v['sprite']],
                $family['variants'],
            ));
        } else {
            $construction['variants'] = array_map($variant, $construction['variants'] ?? [['id'=>'original', 'sprite'=>$construction['sprite']]]);
        }
        $construction['scale'] ??= 1;
    }
    unset($construction);
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
                'id' => 'moored-' . $landing['id'], 'sprite' => 'boat-bottle-down-right-0',
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
                // Scene order is editable in Studio; saved bits must keep their meaning.
                $index = array_search($entity['id'], $world['resourceRegions'][$region]['nodes'] ?? [], true);
                if ($index === false) {
                    throw new RuntimeException("Register harvest node $name/{$entity['id']} in resource-nodes.json ($region); append, never reorder IDs");
                }
                $entity['resource'] = [
                    'region' => $region, 'index' => $index,
                    'renewMs' => $entity['harvest']['renewMs'],
                    'keepVisible' => $entity['harvest']['keepVisible'] ?? true,
                ];
                if ($entity['resource']['keepVisible']) {
                    $entity['resource']['empty'] = $entity['harvest']['empty']
                        ?? throw new RuntimeException('Visible resting harvest needs a dialogue: ' . $entity['id']);
                }
                foreach ($entity['rules'] as &$r) if (array_filter($r['effects'], static fn($e) => $e['type']==='item' && $e['amount']>0)) array_unshift($r['effects'], ['type'=>'collect']);
                unset($r);
            }
            foreach ($entity['rules'] as $resourceRule) foreach ($resourceRule['effects'] as $resourceEffect)
                if ($resourceEffect['type'] === 'collect' && !isset($entity['resource'])) throw new RuntimeException("Register pickup $name/{$entity['id']} in resource-nodes.json; append, never reorder IDs");
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
    // Content areas follow their physical focus, just like portals follow their doors.
    foreach ($world['contentRooms'] as &$room) {
        if (!isset($room['radius'])) continue;
        $focus = array_values(array_filter($world['scenes'][$room['scene']]['entities'],
            static fn($entity) => $entity['id'] === $room['focus']))[0] ?? null;
        if (!$focus) throw new RuntimeException('Missing content room focus');
        $room['circle'] = [$focus['x'], $focus['y'], $room['radius']];
        unset($room['radius']);
    }
    unset($room);
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
