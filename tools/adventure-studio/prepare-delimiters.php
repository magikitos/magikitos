<?php
/** Technical alpha cleanup/cell extraction only; originals and painted silhouettes stay intact. */
declare(strict_types=1);
require __DIR__ . '/../../scripts/lib/adventure-cutout.php';
$root = dirname(__DIR__, 2);
$dir = $root . '/data/aventura/art/delimiters';
$spec = json_decode(file_get_contents($dir . '/sources.json'), true, flags: JSON_THROW_ON_ERROR);
$out = $dir . '/cutouts';
if (!is_dir($out)) mkdir($out, 0755, true);
$definitions = $report = [];
foreach ($spec['sheets'] as $sheet => $entry) {
    $file = "$dir/sources/$sheet.png";
    if (hash_file('sha256', $file) !== $entry['sha256'])
        throw new RuntimeException("Unreviewed source changed: $sheet");
    $image = imagecreatefrompng($file);
    $report[$sheet] = ['sha256' => $entry['sha256'], 'size' => [imagesx($image), imagesy($image)], 'cells' => []];
    adventureKeyedCutout($image, $sheet, false, 'red');
    foreach ($entry['cells'] as $id => $rect) {
        [$x, $y, $w, $h] = $rect;
        $cell = adventureClearCanvas($w, $h);
        imagecopy($cell, $image, 0, 0, $x, $y, $w, $h);
        [$bx, $by, $bw, $bh] = adventureVisibleBounds($cell, [0, 0, $w, $h], $id);
        // All tips must be drawn, with air around them: a chopped tile is a failed source.
        if (min($bx, $by, $w - $bx - $bw, $h - $by - $bh) < 4)
            throw new RuntimeException("Clipped piece: $id");
        $cutout = adventureClearCanvas($bw + 8, $bh + 8);
        imagecopy($cutout, $cell, 4, 4, $bx, $by, $bw, $bh);
        imagepng($cutout, "$out/$id.png", 9);
        // 2x texture / integrated reduction; preserve aspect and pixel density between pieces.
        $size = [(int)ceil(($bw + 8) / 2), (int)ceil(($bh + 8) / 2)];
        $material = explode('-', $id)[0];
        $definitions[$material]['frames']['delimiter-' . $id] = [
            'source' => "data/aventura/art/delimiters/cutouts/$id.png",
            'grid' => [1, 1], 'cell' => [0, 0],
            'size' => $size, 'preserveCanvas' => true,
            'anchor' => [intdiv($size[0], 2), intdiv($size[1], 2)],
        ];
        $report[$sheet]['cells'][$id] = ['rect' => $rect, 'visible' => [$bx, $by, $bw, $bh], 'native' => $size];
        unset($cell, $cutout);
    }
    unset($image);
}
$json = static fn($value) => json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n";
$assets = $root . '/data/aventura/assets';
if (!is_dir($assets)) mkdir($assets, 0755, true);
// The original canopy drawings are kept as authoring references, not shipped.
// Upright 2.5D groves are prepared by scripts/prepare-forest-market.php.
foreach ($definitions as $material => $pack)
    if ($material === 'rock') file_put_contents("$assets/delimiter-$material.json", $json($pack));
file_put_contents("$dir/preparation.json", $json($report));
echo "Prepared 8 rock delimiters; original canopy references retained offline.\n";
