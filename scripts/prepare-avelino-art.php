<?php
declare(strict_types=1);
/** Offline registration: complete walking poses, one fixed on-screen height, no runtime deformation. */
require_once __DIR__ . '/lib/adventure-cutout.php';
$root = dirname(__DIR__);
$dir = "$root/data/aventura/art/avelino";
if (!is_dir("$dir/cutouts")) mkdir("$dir/cutouts", 0755, true);
foreach (['avelino-walk', 'mill-trestle'] as $id) {
    $image = imagecreatefrompng("$dir/$id.png");
    adventureKeyedCutout($image, $id, false, 'red');
    imagepng($image, "$dir/cutouts/$id.png", 9);
}
$image = imagecreatefrompng("$dir/cutouts/avelino-walk.png");
$file = "$root/data/aventura/assets/avelino.json";
$old = json_decode(file_get_contents($file), true, flags: JSON_THROW_ON_ERROR);
$frames = ['avelino-portrait' => $old['frames']['avelino-portrait']];
$directions = ['down', 'down-right', 'right', 'up-right', 'up', 'up-left', 'left', 'down-left'];
$report = [];
foreach ($directions as $column => $direction) {
    $cells = $bounds = $centres = [];
    for ($row = 0; $row < 4; $row++) {
        $cell = adventureSourceCell($image, ['grid' => [8, 4], 'cell' => [$column, $row]]);
        $cells[] = $cell;
        $bounds[] = [$bx, $by, $bw, $bh] = adventureVisibleBounds($image, $cell, "$direction/$row");
        [$sx, $sy, $sw, $sh] = $cell;
        if ($bx <= $sx + 2 || $by <= $sy + 2 || $bx + $bw >= $sx + $sw - 2 || $by + $bh >= $sy + $sh - 2)
            throw new RuntimeException("Walking pose touches another cell: $direction/$row");
        // Optical boot centre measured across the whole cycle, so moving the staff cannot recenter a pose.
        $sum = $count = 0;
        for ($y = $by + (int)($bh * .82); $y < $by + $bh; $y++) for ($x = $bx; $x < $bx + $bw; $x++) {
            if (((imagecolorat($image, $x, $y) >> 24) & 127) > 37) continue;
            $sum += $x - $sx; $count++;
        }
        $centres[] = $sum / $count;
    }
    $centre = array_sum($centres) / 4;
    foreach ($cells as $row => [$sx, $sy, $sw, $sh]) {
        [$bx, $by, $bw, $bh] = $bounds[$row];
        $scale = 48 / $bh;
        $name = "avelino-$direction" . ($row ? "-walk-$row" : '');
        $frames[$name] = [
            'source' => 'data/aventura/art/avelino/cutouts/avelino-walk.png',
            'grid' => [8, 4], 'cell' => [$column, $row],
            'size' => [52, 56], 'anchor' => [26, 54], 'preserveCanvas' => true,
            'registration' => ['scale' => $scale, 'offset' => [26 - $centre * $scale, 54 - ($by - $sy + $bh) * $scale]],
            'cleanFragments' => .015,
        ];
        $report[$name] = ['sourceBounds' => $bounds[$row], 'height' => $bh * $scale, 'baseline' => 54];
    }
}
$frames = ['avelino' => $frames['avelino-down']] + $frames;
file_put_contents($file, json_encode(['frames' => $frames], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
file_put_contents("$dir/cutouts/registration.json", json_encode([
    'sourceSha256' => hash_file('sha256', "$dir/avelino-walk.png"), 'poses' => $report,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
echo "Avelino: 32 full walking poses, 48px silhouettes, shared 54px sole baseline.\n";
