<?php
declare(strict_types=1);
require_once __DIR__ . '/adventure-cutout.php';

/** Measure every isolated cell identically for review and production registration. */
function adventureActorCells(GdImage $source, array $sheet): array
{
    [$columns, $rows] = $sheet['grid'];
    if (isset($sheet['sourceRects'])) {
        if (count($sheet['sourceRects']) !== $rows) throw new RuntimeException('Invalid actor rect rows');
        foreach ($sheet['sourceRects'] as $line) {
            if (!is_array($line) || count($line) !== $columns) throw new RuntimeException('Invalid actor rect columns');
            foreach ($line as $rect) {
                if (!is_array($rect) || count($rect) !== 4 || count(array_filter($rect, 'is_int')) !== 4
                    || $rect[0] < 0 || $rect[1] < 0 || $rect[2] < 1 || $rect[3] < 1
                    || $rect[0] + $rect[2] > imagesx($source) || $rect[1] + $rect[3] > imagesy($source))
                    throw new RuntimeException('Invalid actor source rect');
            }
        }
    }
    $cells = $bounds = [];
    for ($row = 0; $row < $rows; $row++) for ($col = 0; $col < $columns; $col++) {
        $region = isset($sheet['sourceRects'])
            ? ['rect' => $sheet['sourceRects'][$row][$col] ?? throw new RuntimeException('Missing actor source rect')]
            : (isset($sheet['sourceColumnBounds'], $sheet['sourceRowBounds'])
            ? ['rect' => [$sheet['sourceColumnBounds'][$col], $sheet['sourceRowBounds'][$row],
                $sheet['sourceColumnBounds'][$col + 1] - $sheet['sourceColumnBounds'][$col],
                $sheet['sourceRowBounds'][$row + 1] - $sheet['sourceRowBounds'][$row]]]
            : ['grid' => [$columns, $rows], 'cell' => [$col, $row]]);
        $rect = adventureSourceCell($source, $region);
        $cells[] = $rect;
        if (!empty($sheet['cleanFragments'])) {
            [$sx, $sy, $sw, $sh] = $rect;
            $cell = adventurePreparedSpriteCell($source, $rect, $sheet);
            [$x, $y, $w, $h] = adventureVisibleBounds($cell, [0, 0, $sw, $sh], "{$sheet['id']}/$col/$row");
            $bounds[] = [$sx + $x, $sy + $y, $w, $h];
        } else $bounds[] = adventureVisibleBounds($source, $rect, "{$sheet['id']}/$col/$row");
    }
    return [$cells, $bounds];
}

/** Pure registration over measured source pixels, shared by the baker and negative QA. */
function adventureRegisterActor(array $sheet, array $catalog, array $cells, array $bounds, ?array $reference): array
{
    $id = $sheet['id'];
    if (count($cells) !== count($bounds) || !$cells) throw new RuntimeException("Invalid cells: $id");
    if (isset($sheet['reference']) && !$reference) throw new RuntimeException("Missing standing reference: $id");
    $nominalCellWidth = $sheet['sourceCellWidth'] ?? $cells[0][2];
    $bodyHeight = $reference
        ? $reference['bodyHeight'] * ($nominalCellWidth / $reference['cellWidth'])
        : $bounds[0][3];
    $ratio = $sheet['height'] / $bodyHeight;
    [$cw, $ch] = $sheet['canvas'] ?? $catalog['canvas'];
    [$ax, $ay] = $sheet['anchor'] ?? $catalog['anchor'];
    $top = ($sheet['registrationPoint'] ?? 'bottom') === 'top';
    $seated = ($sheet['registrationPoint'] ?? '') === 'seat';
    if ($seated && count($sheet['sourceSeatAnchors'] ?? []) !== $sheet['grid'][1])
        throw new RuntimeException("Missing measured seat anchors: $id");
    $frames = $poses = [];
    [$columns] = $sheet['grid'];
    // Reviewed artwork alignment, baked once. Translate the whole directional
    // cycle, never centre individual frames by swinging hands/feet or hat tips.
    $horizontalOffsets = $sheet['horizontalOffsets'] ?? [];
    if (!is_array($horizontalOffsets)
        || array_diff(array_keys($horizontalOffsets), $sheet['directions'] ?? [])
        || array_filter($horizontalOffsets, fn($offset) =>
            !(is_int($offset) || is_float($offset)) || !is_finite((float)$offset)))
        throw new RuntimeException("Invalid horizontal alignment: $id");
    foreach ($cells as $index => $rect) {
        [$sx, $sy, $sw, $sh] = $rect;
        $row = intdiv($index, $columns); $col = $index % $columns;
        if (isset($sheet['exportRows']) && !in_array($row, $sheet['exportRows'], true)) continue;
        $name = $sheet['names'][$index] ?? (
            "person-{$sheet['variant']}-{$sheet['directions'][$col]}" .
            ($sheet['action'] === 'walk' ? ($row ? "-walk-$row" : '') : "-{$sheet['action']}-$row")
        );
        [$bx, $by, $bw, $bh] = $bounds[$index];
        // New action sheets must not borrow pixels from the next cell. Historical base masters
        // remain unchanged; their reviewed cutouts are already part of the game.
        if (!empty($sheet['strictMargins']) &&
            ($bx < $sx + 2 || $by < $sy + 2 || $bx + $bw > $sx + $sw - 2 || $by + $bh > $sy + $sh - 2))
            throw new RuntimeException("Art touches cell edge: $name");
        $dx = $ax - $sw * $ratio / 2;
        $dy = $ay - ($by - $sy + ($top ? 0 : $bh)) * $ratio;
        if ($seated) {
            $seat = $sheet['sourceSeatAnchors'][$row][$col] ?? null;
            if (!is_array($seat) || count($seat) !== 2 || !is_numeric($seat[0]) || !is_numeric($seat[1]) ||
                $seat[0] <= 0 || $seat[0] >= $sw || $seat[1] <= 0 || $seat[1] >= $sh)
                throw new RuntimeException("Invalid measured seat anchor: $name");
            // The pelvis stays attached while boots and hands move. No boat-specific actor offsets.
            $dx = $ax - $seat[0] * $ratio;
            $dy = $ay - $seat[1] * $ratio;
        }
        $dx += $horizontalOffsets[$sheet['directions'][$col] ?? ''] ?? 0;
        $ink = [$dx + ($bx - $sx) * $ratio, $dy + ($by - $sy) * $ratio, $bw * $ratio, $bh * $ratio];
        $epsilon = 0.000001;
        if ($ink[0] < -$epsilon || $ink[1] < -$epsilon || $ink[0] + $ink[2] > $cw + $epsilon || $ink[1] + $ink[3] > $ch + $epsilon)
            throw new RuntimeException("Registered pose clipped: $name");
        $frames[$name] = [
            'source' => 'data/aventura/art/' . ($sheet['directory'] ?? 'cast') . "/cutouts/$id.png",
            'grid' => $sheet['grid'], 'cell' => [$col, $row], 'size' => [$cw, $ch],
            'anchor' => [$ax, $ay], 'preserveCanvas' => true,
            'registration' => ['scale' => $ratio, 'offset' => [$dx, $dy]],
        ];
        if (isset($sheet['sourceColumnBounds']) || isset($sheet['sourceRects'])) {
            unset($frames[$name]['grid'], $frames[$name]['cell']);
            $frames[$name]['rect'] = $rect;
        }
        if (!empty($sheet['cleanFragments'])) $frames[$name]['cleanFragments'] = $sheet['cleanFragments'];
        $poses[$name] = ['ink' => $ink, 'support' => $seated ? $ay : ($top ? $ink[1] : $ink[1] + $ink[3])];
        if ($seated) $poses[$name]['seat'] = [$dx + $seat[0] * $ratio, $dy + $seat[1] * $ratio];
    }
    return [
        'frames' => $frames,
        'measurement' => ['bodyHeight' => $bodyHeight, 'cellWidth' => $nominalCellWidth, 'ratio' => $ratio],
        'poses' => $poses,
    ];
}

/** A --sheet build still measures its standing reference first; it never uses stale reports. */
function adventureActorDependencies(array $sheets, ?string $only): array
{
    $byId = [];
    foreach ($sheets as $sheet) {
        if (isset($byId[$sheet['id']])) throw new RuntimeException('Duplicate actor sheet: ' . $sheet['id']);
        $byId[$sheet['id']] = $sheet;
    }
    $ordered = $seen = $visiting = [];
    $visit = function (string $id) use (&$visit, &$ordered, &$seen, &$visiting, $byId): void {
        if (isset($visiting[$id])) throw new RuntimeException("Cyclic actor reference: $id");
        if (isset($seen[$id])) return;
        if (!isset($byId[$id])) throw new RuntimeException("Unknown actor sheet: $id");
        $visiting[$id] = true;
        $sheet = $byId[$id];
        if (isset($sheet['reference'])) $visit($sheet['reference']);
        if (isset($sheet['overrideOf'])) $visit($sheet['overrideOf']);
        unset($visiting[$id]);
        $seen[$id] = true;
        $ordered[] = $sheet;
    };
    foreach ($only ? [$only] : array_keys($byId) as $id) $visit($id);
    // A selected action is still a complete package, including reviewed directional patches.
    if ($only) foreach ($sheets as $sheet) if (($sheet['overrideOf'] ?? null) === $only) $visit($sheet['id']);
    return $ordered;
}

/** A directional art correction replaces only existing poses, never approved neighbours.
 * Composition happens offline into the same atlas; the runtime has no patch/extra-load logic. */
function adventureActorOverride(array $base, array $patch): array
{
    if (!$patch || array_diff_key($patch, $base)) throw new RuntimeException('Unknown actor override poses');
    return array_replace($base, $patch);
}
