<?php
declare(strict_types=1);
/** Authorized local alpha preparation. Immutable masters, one shared scale, 2x offline bake. */
require_once __DIR__ . '/lib/adventure-cutout.php';
$root = dirname(__DIR__); $dir = $root . '/data/aventura/art/river';
$catalog = json_decode(file_get_contents($dir . '/catalog.json'), true, 64, JSON_THROW_ON_ERROR);
$packs = []; $reports = [];
foreach ($catalog['sheets'] as $sheet) {
    $id = $sheet['source']; $source = imagecreatefrompng("$dir/sources/$id.png");
    imagepalettetotruecolor($source); imagealphablending($source, false); imagesavealpha($source, true);
    if (isset($sheet['neutralMatteMinimum'])) adventureNeutralCutout($source, $sheet['neutralMatteMinimum']);
    $w = imagesx($source); $h = imagesy($source); $clear = imagecolorallocatealpha($source, 0, 0, 0, 127);
    // Reviewed masters have pure RGB matte flecks beside existing alpha. Never key interior colours.
    for ($pass = 0; $pass < 3; $pass++) {
        $erase = [];
        for ($y = 1; $y < $h - 1; $y++) for ($x = 1; $x < $w - 1; $x++) {
            $p = imagecolorat($source, $x, $y); if (($p >> 24 & 127) > 100) continue;
            $r = $p >> 16 & 255; $g = $p >> 8 & 255; $b = $p & 255;
            if (max($r, $g, $b) < 245 || min($r, $g, $b) > 20) continue;
            foreach ([[-1, 0], [1, 0], [0, -1], [0, 1]] as [$dx, $dy])
                if ((imagecolorat($source, $x + $dx, $y + $dy) >> 24 & 127) > 100) { $erase[] = [$x, $y]; break; }
        }
        foreach ($erase as [$x, $y]) imagesetpixel($source, $x, $y, $clear);
    }
    $reports[$id] = adventureKeyedCutout($source, $id, false, 'red');
    $temporary = tempnam("$dir/cutouts", '.river-');
    try { if (!imagepng($source, $temporary, 9) || !rename($temporary, "$dir/cutouts/$id.png")) throw new RuntimeException('Cannot save river cutout'); }
    finally { if (is_file($temporary)) unlink($temporary); }
    foreach ($sheet['frames'] as $name => $frame) {
        $packs[$sheet['pack']][$name] = $frame + ['source' => "data/aventura/art/river/cutouts/$id.png", 'fit' => true, 'grid' => [1, 1], 'cell' => [0, 0]];
    }
}
foreach ($packs as $pack => $frames) file_put_contents("$root/data/aventura/assets/$pack.json", json_encode(['frames' => $frames], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
file_put_contents("$dir/cutouts/report.json", json_encode($reports, JSON_PRETTY_PRINT) . "\n");
echo "River alpha prepared; " . count($packs) . " independent packs.\n";
