<?php
declare(strict_types=1);
/** Studio-only mechanical sprite-sheet packaging; generated originals and alpha remain untouched. */
$destination = $argv[1] ?? throw new RuntimeException('Missing Studio output');
if (!is_dir($destination) && !mkdir($destination, 0755, true)) throw new RuntimeException('Cannot create art directory');
$sets = [
    'habitats' => ['boot-inn', 'stump-home', 'leaf-home', 'mushroom-home', 'log-workshop', 'pot-home'],
    'nature' => ['ancient-root', 'giant-fern', 'giant-clover', 'giant-bolete', 'root-arch', 'scarlet-mushrooms'],
];
$manifest = ['packs' => []];
foreach ($sets as $set => $names) {
    $source = imagecreatefrompng(__DIR__ . '/art/' . $set . '.png');
    $cw = intdiv(imagesx($source), 3);
    $ch = intdiv(imagesy($source), 2);
    $cell = $set === 'nature' ? 384 : 192;
    $atlas = imagecreatetruecolor($cell * 3, $cell * 2);
    imagealphablending($atlas, false);
    imagesavealpha($atlas, true);
    imagefill($atlas, 0, 0, imagecolorallocatealpha($atlas, 0, 0, 0, 127));
    $frames = [];
    foreach ($names as $index => $name) {
        $sx = ($index % 3) * $cw; $sy = intdiv($index, 3) * $ch;
        $dx = ($index % 3) * $cell; $dy = intdiv($index, 3) * $cell;
        imagecopyresampled($atlas, $source, $dx, $dy, $sx, $sy, $cell, $cell, $cw, $ch);
        // Historical experiment keeps its original raster/size; density is explicit.
        $frames[$name] = ['x'=>$dx, 'y'=>$dy, 'w'=>$cell, 'h'=>$cell, 'pixelRatio'=>1,
            'ink'=>[0,0,$cell,$cell], 'anchor'=>[$cell / 2, $cell * 180 / 192], 'designSize'=>192];
    }
    imagepng($atlas, $destination . '/' . $set . '.png', 9);
    file_put_contents($destination . '/' . $set . '.json', json_encode(['width'=>$cell*3,'height'=>$cell*2,'frames'=>$frames], JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR) . "\n");
    $manifest['packs'][$set] = ['image'=>$set.'.png','metadata'=>$set.'.json','sprites'=>$names];
    unset($atlas, $source);
}
file_put_contents($destination.'/manifest.json', json_encode($manifest, JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR)."\n");
echo "Experimental art: 12 sprites in 2 Studio-only packages.\n";
