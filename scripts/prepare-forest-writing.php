<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/adventure-cutout.php';
$root = dirname(__DIR__);
$dir = "$root/data/aventura/art/forest-writing";
$catalog = json_decode(file_get_contents("$dir/catalog.json"), true, 512, JSON_THROW_ON_ERROR);
foreach (['production.png' => 'sourceSha256', 'production.prompt.txt' => 'promptSha256'] as $file => $key)
    if (hash_file('sha256', "$dir/$file") !== $catalog[$key]) throw new RuntimeException('Writing art provenance mismatch');
$image = imagecreatefrompng("$dir/production.png");
$report = adventureKeyedCutout($image, 'forest-writing', false, 'red');
$frames = [];
foreach ($catalog['sprites'] as $index => $spec) {
    $rect = adventureSourceCell($image, ['grid' => [3, 1], 'cell' => [$index, 0]]);
    [$x, $y, $w, $h] = adventureVisibleBounds($image, $rect, $spec['id']);
    if ($x < $rect[0] + 2 || $y < 2 || $x + $w > $rect[0] + $rect[2] - 2 || $y + $h > $rect[3] - 2)
        throw new RuntimeException('Writing sprite touches cell edge: ' . $spec['id']);
    $frames[$spec['id']] = ['source' => 'data/aventura/art/forest-writing/cutout.png',
        'grid' => [3, 1], 'cell' => [$index, 0], 'size' => $spec['size'], 'anchor' => $spec['anchor'], 'fit' => true];
}
imagepng($image, "$dir/cutout.png", 9);
file_put_contents("$root/data/aventura/assets/forest-writing.json", json_encode(['frames' => $frames], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
echo count($frames) . ' writing sprites; alpha ' . $report['alpha'] . "; original retained.\n";
