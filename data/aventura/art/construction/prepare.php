<?php
declare(strict_types=1);

// Authoring-only preparation. No game catalog, scene, API, build or deployment writes.
$root = dirname(__DIR__, 4);
require_once $root . '/scripts/lib/adventure-actor-registration.php';
$config = json_decode(file_get_contents(__DIR__ . '/authoring.json'), true, 512, JSON_THROW_ON_ERROR);
$relative = 'data/aventura/art/construction';
foreach (['cutouts', 'packs', 'sprites', 'review'] as $folder) {
    if (!is_dir(__DIR__ . '/' . $folder)) mkdir(__DIR__ . '/' . $folder, 0755, true);
}
function constructionJson(string $file, array $value): void {
    if (file_put_contents(__DIR__ . '/' . $file, json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n") === false) {
        throw new RuntimeException('Cannot save ' . $file);
    }
}
function constructionPng(string $file, GdImage $image): void {
    if (!imagepng($image, __DIR__ . '/' . $file, 9)) throw new RuntimeException('Cannot save ' . $file);
}
$sources = $qa = $packages = [];
foreach ($config['sources'] as $id => $path) {
    $source = imagecreatefrompng($root . '/' . $path);
    $qa['sources'][$id] = ['path' => $path, 'sha256' => hash_file('sha256', $root . '/' . $path)]
        + adventureKeyedCutout($source, $id, false, 'red');
    constructionPng('cutouts/' . $id . '.png', $source);
    $sources[$id] = $source;
}
foreach ($config['packages'] as $pack => $definitions) foreach ($definitions as $id => $definition) {
    $art = $definition['art']; unset($definition['art']);
    $packages[$pack][$id] = $definition + [
        'source' => $relative . '/cutouts/' . $art . '.png',
        'grid' => [1, 1], 'cell' => [0, 0], 'fit' => true,
    ];
}
$npc = $config['npc'];
[$cells, $bounds] = adventureActorCells($sources[$npc['id']], $npc);
$registered = adventureRegisterActor($npc, $npc, $cells, $bounds, null);
$packages['resident-111'] = $registered['frames'];
$qa['npc'] = ['sourceNumber' => 111, 'runtimeVariant' => null, 'frames' => count($registered['frames']),
    'grid' => $npc['grid'], 'directions' => $npc['directions'], 'measurement' => $registered['measurement'],
    'strictCellMargins' => true, 'poses' => $registered['poses']];
constructionJson('sprite-definitions.json', ['profile' => $config['profile'], 'packages' => $packages]);
$manifest = ['status' => $config['status'], 'profile' => $config['profile'], 'npcSourceNumber' => 111,
    'runtimeVariant' => null, 'packages' => []];
$frames = $sprites = [];
foreach ($packages as $packId => $definitions) {
    $pack = bakeAdventureSprites($definitions, $root, $config['profile']);
    if (file_put_contents(__DIR__ . '/packs/' . $packId . '.png', $pack['png']) === false) throw new RuntimeException('Cannot save pack');
    constructionJson('packs/' . $packId . '.json', $pack['metadata']);
    $atlas = imagecreatefromstring($pack['png']);
    $manifest['packages'][$packId] = ['image' => 'packs/' . $packId . '.png', 'metadata' => 'packs/' . $packId . '.json',
        'bytes' => strlen($pack['png']), 'sha256' => hash('sha256', $pack['png']),
        'texturePixels' => [$pack['metadata']['width'], $pack['metadata']['height']],
        'rgbaBytes' => $pack['metadata']['width'] * $pack['metadata']['height'] * 4];
    foreach ($pack['metadata']['frames'] as $name => $f) {
        $sprite = adventureClearCanvas($f['w'] * $f['pixelRatio'], $f['h'] * $f['pixelRatio']);
        imagecopy($sprite, $atlas, 0, 0, $f['x'], $f['y'], imagesx($sprite), imagesy($sprite));
        adventureVisibleBounds($sprite, [0, 0, imagesx($sprite), imagesy($sprite)], $name);
        constructionPng('sprites/' . $name . '.png', $sprite);
        $frames[$name] = $f;
        $sprites[$name] = $sprite;
    }
}
if (count($packages['resident-111']) !== 32) throw new RuntimeException('NPC must have 32 frames');

// Regular registered grid for visual review / sprite-sheet consumers. Same atlas pixels.
$grid = adventureClearCanvas(8 * 96, 4 * 96);
foreach ($config['npc']['directions'] as $col => $direction) for ($row = 0; $row < 4; $row++) {
    $name = 'person-resident-111-' . $direction . ($row ? '-walk-' . $row : '');
    $f = $frames[$name];
    if ($f['w'] !== 48 || $f['h'] !== 48 || $f['anchor'] !== [24, 46]) throw new RuntimeException('NPC registration mismatch');
    imagecopy($grid, $sprites[$name], $col * 96, $row * 96, 0, 0, 96, 96);
}
constructionPng('review/resident-111-grid.png', $grid);

// Art-layout proof, not a game scene. Reuses independently supplied props at their native scale.
$layout = $config['reviewLayout'];
$room = adventureClearCanvas(480 * 2, 469 * 2);
imagealphablending($room, true);
$draw = static function (GdImage $target, string $name, float $x, float $y) use ($sprites, $frames): void {
    $f = $frames[$name];
    imagecopy($target, $sprites[$name], (int)round(($x - $f['anchor'][0]) * 2), (int)round(($y - $f['anchor'][1]) * 2),
        0, 0, imagesx($sprites[$name]), imagesy($sprites[$name]));
};
$draw($room, $layout['background'], 0, 0);
foreach ($layout['instances'] as $instance) $draw($room, $instance['sprite'], ...$instance['at']);
constructionPng('review/warehouse-furnished.png', $room);

$overview = imagecreatetruecolor(1160, 1060);
imagefill($overview, 0, 0, imagecolorallocate($overview, 41, 61, 44));
imagealphablending($overview, true);
$label = imagecolorallocate($overview, 237, 226, 198);
imagestring($overview, 5, 24, 18, 'MAGIKITOS - CONSTRUCTION ART / NOT INSTALLED', $label);
$draw($overview, 'warehouse-watering-can', 164, 256);
imagecopy($overview, $sprites['person-resident-111-down'], 430, 443, 0, 0, 96, 96);
imagecopyresampled($overview, $room, 600, 70, 0, 0, 540, 528, imagesx($room), imagesy($room));
imagestring($overview, 4, 26, 555, 'Exterior + resident-111 at the same world scale (2x)', $label);
imagestring($overview, 4, 610, 612, 'Interior: separate room, props, sacks and NPC', $label);
imagecopy($overview, $grid, 196, 648, 0, 0, 768, 384);
constructionPng('review/overview.png', $overview);

$qa['validation'] = ['sprites' => count($frames), 'npcFrames' => 32, 'npcGrid' => [8, 4],
    'npcCanvas' => [48, 48], 'npcAnchor' => [24, 46], 'strictCellMargins' => true,
    'bakedPixelRatio' => 2, 'runtimeRegistered' => false];
constructionJson('review/qa.json', $qa);
constructionJson('manifest.json', $manifest);
echo json_encode($qa['validation'], JSON_PRETTY_PRINT) . "\n";
echo 'PNG atlas total: ' . array_sum(array_column($manifest['packages'], 'bytes')) . " bytes. Art only.\n";
