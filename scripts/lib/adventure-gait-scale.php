<?php
declare(strict_types=1);

/** Authored pace registration, applied once offline after opposite-foot composition.
 * A complete directional cycle shares ONE uniform scale. Never resize a frame
 * to its moving silhouette: that makes heads pulse at each footfall.
 * The world canvas, sole anchor, source art and animation timing stay unchanged. */
function adventureGaitScale(array $frames, int $variant, string $action, string $root): array
{
    $catalog = json_decode(file_get_contents("$root/data/aventura/art/gait/scale.json"), true, 512, JSON_THROW_ON_ERROR);
    $scales = $catalog['characters'][(string)$variant][$action] ?? [];
    foreach ($scales as $direction => $scale) {
        if (!in_array($direction, $catalog['directions'], true) || !is_numeric($scale)
            || !is_finite((float)$scale) || $scale < .8 || $scale > 1.25)
            throw new RuntimeException("Invalid gait scale: $variant/$action/$direction");
        for ($pose = 0; $pose < 4; $pose++) {
            $name = "person-$variant-$direction" . ($action === 'walk' && !$pose ? '' : "-$action-$pose");
            if (!isset($frames[$name]['registration'])) throw new RuntimeException("Missing gait registration: $name");
            $frame = &$frames[$name];
            [$ax, $ay] = $frame['anchor'];
            [$dx, $dy] = $frame['registration']['offset'];
            $frame['registration']['scale'] *= $scale;
            $frame['registration']['offset'] = [$ax + ($dx - $ax) * $scale, $ay + ($dy - $ay) * $scale];
            unset($frame);
        }
    }
    return $frames;
}
