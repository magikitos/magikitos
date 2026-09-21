<?php
/** Offline alpha/cell preparation only. Source drawings remain immutable. */
declare(strict_types=1);
require __DIR__ . '/lib/adventure-cutout.php';
$root = dirname(__DIR__);
$dir = $root . '/data/aventura/art/forest-market';
$spec = json_decode(file_get_contents($dir . '/sources.json'), true, flags: JSON_THROW_ON_ERROR);
if (!is_dir($dir . '/cutouts')) mkdir($dir . '/cutouts', 0755, true);
$packs = $report = [];
foreach ($spec as $sheet => $entry) {
    $file = "$dir/sources/$sheet.png";
    if (hash_file('sha256', $file) !== $entry['sha256']) throw new RuntimeException("Changed master: $sheet");
    $image = imagecreatefrompng($file);
    adventureKeyedCutout($image, $sheet, false, 'red');
    foreach ($entry['cells'] as $id => $cell) {
        [$x, $y, $w, $h] = $cell['rect'];
        $slice = adventureClearCanvas($w, $h);
        imagecopy($slice, $image, 0, 0, $x, $y, $w, $h);
        [$bx, $by, $bw, $bh] = adventureVisibleBounds($slice, [0,0,$w,$h], $id);
        if (min($bx, $by, $w-$bx-$bw, $h-$by-$bh) < 3) throw new RuntimeException("Clipped silhouette: $id");
        $cut = adventureClearCanvas($bw+8, $bh+8);
        imagecopy($cut, $slice, 4, 4, $bx, $by, $bw, $bh);
        imagepng($cut, "$dir/cutouts/$id.png", 9);
        $width = $cell['width'];
        $height = (int)round(($bh+8)/($bw+8)*$width);
        $anchor = [(int)floor($width/2), ($cell['center'] ?? false) ? (int)floor($height/2) : $height-3];
        $packs[$cell['pack']]['frames'][$id] = [
            'source'=>"data/aventura/art/forest-market/cutouts/$id.png",
            'grid'=>[1,1], 'cell'=>[0,0], 'size'=>[$width,$height],
            'preserveCanvas'=>true, 'anchor'=>$anchor,
        ];
        $report[$id] = ['visible'=>[$bx,$by,$bw,$bh], 'size'=>[$width,$height], 'anchor'=>$anchor];
        unset($slice, $cut);
    }
    unset($image);
}
$json = static fn($data) => json_encode($data, JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR)."\n";
foreach ($packs as $name => $pack) file_put_contents("$root/data/aventura/assets/$name.json", $json($pack));
file_put_contents("$dir/preparation.json", $json($report));
echo count($report)." reviewed silhouettes prepared; no runtime alpha scan.\n";
