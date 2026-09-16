<?php
declare(strict_types=1);
/** Reviewed masters → transparent cutouts and scene-lazy frame definitions. */
require_once __DIR__ . '/lib/adventure-cutout.php';
$root = dirname(__DIR__);
$relative = 'data/aventura/art/world-polish';
$dir = "$root/$relative";
$catalog = json_decode(file_get_contents("$dir/catalog.json"), true, flags: JSON_THROW_ON_ERROR);
$report = [];
foreach ($catalog['assets'] as $asset) {
    $id = $asset['id'];
    $image = imagecreatefrompng("$dir/sources/$id.png");
    $report[$id] = adventureKeyedCutout($image, $id);
    imagepng($image, "$dir/cutouts/$id.png", 9);
    $frames = [];
    foreach ($asset['frames'] as $i => $frame) {
        $frames[$frame] = ['source'=>"$relative/cutouts/$id.png", 'grid'=>$asset['grid'],
            'cell'=>[$i % $asset['grid'][0], intdiv($i, $asset['grid'][0])],
            'size'=>$asset['size'], 'anchor'=>$asset['anchor'], 'fit'=>true];
    }
    if ($frames) file_put_contents("$root/data/aventura/assets/$id.json", json_encode(['frames'=>$frames], JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES)."\n");
}
file_put_contents("$dir/cutouts/report.json", json_encode($report, JSON_PRETTY_PRINT)."\n");
echo "World polish: four preserved masters, transparent cutouts and three lazy packs.\n";
