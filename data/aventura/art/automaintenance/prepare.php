<?php
declare(strict_types=1);

// Offline artwork preparation ONLY. Never writes to the active catalog or public/.
// Run from any cwd: php data/aventura/art/automaintenance/prepare.php
$root = dirname(__DIR__, 4);
require_once $root . '/scripts/lib/adventure-cutout.php';
$relative = 'data/aventura/art/automaintenance';
foreach (['cutouts', 'packs', 'sprites', 'review'] as $folder) {
    if (!is_dir(__DIR__ . '/' . $folder)) mkdir(__DIR__ . '/' . $folder, 0755, true);
}
$writeJson = static function (string $path, array $data): void {
    if (file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n") === false) {
        throw new RuntimeException('Cannot write ' . $path);
    }
};
$writePng = static function (GdImage $image, string $path): void {
    if (!imagepng($image, $path, 9)) throw new RuntimeException('Cannot write ' . $path);
};
$images = $reports = [];
foreach (['bomb', 'bomb-warning', 'bomb-warning-flame', 'defuser', 'path-overgrowth'] as $id) {
    $source = __DIR__ . '/sources/' . $id . '.png';
    $images[$id] = imagecreatefrompng($source);
    $reports[$id] = ['sha256' => hash_file('sha256', $source)] + adventureKeyedCutout($images[$id], $id);
}

// Import the generated red BODY, not an ember-tip effect. Original alpha locks the silhouette.
// Retain the original fuse and warm-coloured brass/ribbon pixels exactly.
$warning = adventureClearCanvas(imagesx($images['bomb']), imagesy($images['bomb']));
imagecopy($warning, $images['bomb'], 0, 0, 0, 0, imagesx($warning), imagesy($warning));
$bodyTop = 500;
if (imagesx($images['bomb-warning']) !== imagesx($warning) || imagesy($images['bomb-warning']) !== imagesy($warning)) {
    throw new RuntimeException('Warning master must use the original registration canvas');
}
for ($y = $bodyTop; $y < imagesy($warning); $y++) for ($x = 0; $x < imagesx($warning); $x++) {
    $base = imagecolorat($images['bomb'], $x, $y);
    $next = imagecolorat($images['bomb-warning'], $x, $y);
    $r = ($base >> 16) & 255; $g = ($base >> 8) & 255; $b = $base & 255;
    if ($r > $g * 1.18 && $g > $b * 1.15) continue;
    if ((($base >> 24) & 127) < 100 && (($next >> 24) & 127) < 100) {
        imagesetpixel($warning, $x, $y, ($base & 0x7f000000) | ($next & 0x00ffffff));
    }
}
$images['bomb-warning'] = $warning;
// Reuse the SAME generated flame on both world states. Only the body pulses red.
// The inventory master remains unlit. This is offline cropping/compositing, not runtime logic.
$flameCrop = [794, 192, 102, 168];
$flameDestination = [786, 285, 45, 74];
$flame = adventureClearCanvas($flameDestination[2], $flameDestination[3]);
imagecopyresampled($flame, $images['bomb-warning-flame'], 0, 0, ...$flameCropAsArgs = [
    $flameCrop[0], $flameCrop[1], $flameDestination[2], $flameDestination[3], $flameCrop[2], $flameCrop[3],
]);
$images['bomb-armed'] = adventureClearCanvas(imagesx($warning), imagesy($warning));
imagecopy($images['bomb-armed'], $images['bomb'], 0, 0, 0, 0, imagesx($warning), imagesy($warning));
foreach (['bomb-armed', 'bomb-warning'] as $id) {
    imagealphablending($images[$id], true);
    imagecopy($images[$id], $flame, $flameDestination[0], $flameDestination[1], 0, 0, imagesx($flame), imagesy($flame));
    imagealphablending($images[$id], false);
}
foreach ($images as $id => $image) $writePng($image, __DIR__ . '/cutouts/' . $id . '.png');
$reports['bomb-warning']['registeredBodyTop'] = $bodyTop;
$reports['bomb-warning']['silhouetteSource'] = 'sources/bomb.png';
$reports['bomb-warning']['colourSource'] = 'sources/bomb-warning.png';
$reports['bomb-warning-flame']['crop'] = $flameCrop;
$reports['bomb-warning-flame']['destination'] = $flameDestination;

$item = static fn(string $source, array $size, array $anchor): array => [
    'source' => $relative . '/cutouts/' . $source . '.png',
    'grid' => [1, 1], 'cell' => [0, 0], 'size' => $size, 'anchor' => $anchor, 'fit' => true,
];
$packages = ['items' => [
    'maintenance-bomb' => $item('bomb-armed', [14, 18], [7, 17]),
    'maintenance-bomb-warning' => $item('bomb-warning', [14, 18], [7, 17]),
    'maintenance-defuser' => $item('defuser', [22, 20], [11, 18]),
    'maintenance-bomb-icon' => $item('bomb', [48, 56], [24, 54]),
    'maintenance-defuser-icon' => $item('defuser', [56, 50], [28, 48]),
], 'overgrowth' => []];
foreach (['sparse', 'full'] as $row => $stage) for ($col = 0; $col < 4; $col++) {
    $packages['overgrowth']['overgrowth-' . $stage . '-' . ($col + 1)] = [
        'source' => $relative . '/cutouts/path-overgrowth.png',
        'grid' => [4, 2], 'cell' => [$col, $row], 'size' => [24, 12],
        'anchor' => [12, 11], 'fit' => true, 'scaleGroup' => 'path-grass',
    ];
}
$writeJson(__DIR__ . '/sprite-definitions.json', ['profile' => ADVENTURE_ART_PROFILE, 'packages' => $packages]);
$manifest = [
    'status' => 'art-only; not registered in the game',
    'profile' => ADVENTURE_ART_PROFILE,
    'inventory' => ['bomba' => 'maintenance-bomb-icon', 'desactivador' => 'maintenance-defuser-icon'],
    'warning' => ['base' => 'maintenance-bomb', 'highlight' => 'maintenance-bomb-warning', 'effect' => 'whole-body-red', 'flame' => 'identical in both world states; inventory unlit', 'suggestedPeriodMs' => 2200],
    'packages' => [],
];
$allFrames = [];
foreach ($packages as $id => $definitions) {
    $pack = bakeAdventureSprites($definitions, $root);
    $pngPath = __DIR__ . '/packs/' . $id . '.png';
    if (file_put_contents($pngPath, $pack['png']) === false) throw new RuntimeException('Cannot write atlas');
    $writeJson(__DIR__ . '/packs/' . $id . '.json', $pack['metadata']);
    $atlas = imagecreatefromstring($pack['png']);
    $manifest['packages'][$id] = [
        'image' => 'packs/' . $id . '.png', 'metadata' => 'packs/' . $id . '.json',
        'bytes' => strlen($pack['png']), 'sha256' => hash('sha256', $pack['png']),
        'texturePixels' => [$pack['metadata']['width'], $pack['metadata']['height']],
        'rgbaBytes' => $pack['metadata']['width'] * $pack['metadata']['height'] * 4,
    ];
    foreach ($pack['metadata']['frames'] as $name => $f) {
        $sprite = adventureClearCanvas($f['w'] * $f['pixelRatio'], $f['h'] * $f['pixelRatio']);
        imagecopy($sprite, $atlas, 0, 0, $f['x'], $f['y'], imagesx($sprite), imagesy($sprite));
        $writePng($sprite, __DIR__ . '/sprites/' . $name . '.png');
        $allFrames[$name] = $f + ['package' => $id];
    }
}

// Fail if blinking shifts the silhouette, changes the fuse, or fails to redden the body.
$baseFrame = $allFrames['maintenance-bomb'];
$warnFrame = $allFrames['maintenance-bomb-warning'];
foreach (['w', 'h', 'anchor', 'nativeSize', 'trim', 'bounds'] as $key) {
    if ($baseFrame[$key] !== $warnFrame[$key]) throw new RuntimeException('Warning registration drift: ' . $key);
}
$base = imagecreatefrompng(__DIR__ . '/sprites/maintenance-bomb.png');
$warn = imagecreatefrompng(__DIR__ . '/sprites/maintenance-bomb-warning.png');
imagepalettetotruecolor($base); imagepalettetotruecolor($warn);
$changed = $bodyPixels = $redBodyPixels = 0;
for ($y = 0; $y < imagesy($base); $y++) for ($x = 0; $x < imagesx($base); $x++) {
    $a = imagecolorat($base, $x, $y); $b = imagecolorat($warn, $x, $y);
    if (($a & 0x7f000000) !== ($b & 0x7f000000)) throw new RuntimeException('Warning alpha drift');
    if ($a !== $b) {
        $changed++;
        if ($y < imagesy($base) * .25) throw new RuntimeException('Warning changes the fuse');
    }
    if ($y >= imagesy($base) * .6 && (($a >> 24) & 127) < 37) {
        $bodyPixels++;
        if ((($b >> 16) & 255) > (($b >> 8) & 255) * 1.35) $redBodyPixels++;
    }
}
if ($changed < 1 || $bodyPixels === 0 || $redBodyPixels / $bodyPixels < .8) throw new RuntimeException('Red body warning disappeared during reduction');
$reports['validation'] = ['spriteCount' => count($allFrames), 'warningChangedTexturePixels' => $changed,
    'warningAlphaAndRegistrationStable' => true, 'warningFuseUnchanged' => true,
    'warningRedBodyCoverage' => round($redBodyPixels / $bodyPixels, 3)];
foreach ($allFrames as $name => $f) {
    $sprite = imagecreatefrompng(__DIR__ . '/sprites/' . $name . '.png');
    imagepalettetotruecolor($sprite);
    $transparent = 0;
    for ($y = 0; $y < imagesy($sprite); $y++) for ($x = 0; $x < imagesx($sprite); $x++) {
        if (((imagecolorat($sprite, $x, $y) >> 24) & 127) === 127) $transparent++;
    }
    if ($transparent === 0 || $transparent === imagesx($sprite) * imagesy($sprite)) throw new RuntimeException('Invalid alpha: ' . $name);
}
$writeJson(__DIR__ . '/manifest.json', $manifest);
$writeJson(__DIR__ . '/review/qa.json', $reports);
echo json_encode($reports['validation'], JSON_PRETTY_PRINT) . "\n";
echo 'Atlases: ' . array_sum(array_column($manifest['packages'], 'bytes')) . " bytes. No active game files modified.\n";
