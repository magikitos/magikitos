<?php
declare(strict_types=1);
/** Offline empty hulls: immutable sources, invisible pelvis attachment, native 2x.
 * This does not select a player, change gameplay or paint/reconstruct any object pixels. */
require_once __DIR__ . '/lib/adventure-cutout.php';
$root = dirname(__DIR__); $directory = "$root/data/aventura/art/river";
$catalog = json_decode(file_get_contents("$directory/vessels.json"), true, 512, JSON_THROW_ON_ERROR);
$reviewDirectory = "$root/.local/vessel-art-reviews";
if (!is_dir($reviewDirectory)) mkdir($reviewDirectory, 0775, true);
foreach ($catalog['sheets'] as $sheet) {
    $id = $sheet['source']; $path = "$directory/sources/$id.png";
    foreach ([[$path, $sheet['sourceSha256']], ["$directory/$id.prompt.txt", $sheet['promptSha256']],
        ["$directory/sources/{$sheet['editSource']}.png", $sheet['editSourceSha256']]] as [$file, $digest])
        if (hash_file('sha256', $file) !== $digest) throw new RuntimeException("Vessel provenance mismatch: $file");
    $source = imagecreatefrompng($path);
    $alpha = adventureKeyedCutout($source, $id);
    [$columns, $rows] = $sheet['grid'];
    $scale = $sheet['logicalCellWidth'] / (imagesx($source) / $columns);
    [$ax, $ay] = $sheet['anchor']; [$cw, $ch] = $sheet['canvas'];
    $frames = $poses = [];
    $review = imagecreatetruecolor($columns * $cw * 3, $rows * ($ch * 3 + 20));
    imagefill($review, 0, 0, imagecolorallocate($review, 91, 138, 143));
    $label = imagecolorallocate($review, 250, 237, 200);
    for ($row = 0; $row < $rows; $row++) for ($col = 0; $col < $columns; $col++) {
        $index = $row * $columns + $col;
        $direction = $catalog['directions'][$index % count($catalog['directions'])];
        $phase = intdiv($index, count($catalog['directions']));
        $name = "{$sheet['spritePrefix']}-$direction-$phase";
        $sx = $sheet['sourceColumnBounds'][$col];
        $sw = $sheet['sourceColumnBounds'][$col + 1] - $sx;
        $sy = $sheet['sourceRowBounds'][$row]; $sh = $sheet['sourceRowBounds'][$row + 1] - $sy;
        $cell = adventureSourceCell($source, ['rect' => [$sx, $sy, $sw, $sh]]);
        [$sx, $sy, $sw, $sh] = $cell;
        $isolated = adventureClearCanvas($sw, $sh);
        imagecopy($isolated, $source, 0, 0, $sx, $sy, $sw, $sh);
        adventureCleanFragments($isolated, 0.005);
        [$bx, $by, $bw, $bh] = adventureVisibleBounds($isolated, [0, 0, $sw, $sh], $name);
        if ($bx < 2 || $by < 2 || $bx + $bw > $sw - 2 || $by + $bh > $sh - 2)
            throw new RuntimeException("Vessel crosses cell boundary: $name");
        [$seatX, $seatY] = $sheet['sourceSeatAnchors'][$row][$col];
        if ($seatX <= 0 || $seatX >= $sw || $seatY <= 0 || $seatY >= $sh)
            throw new RuntimeException("Invalid vessel attachment: $name");
        $offset = [$ax - $seatX * $scale, $ay - $seatY * $scale];
        $ink = [$offset[0] + $bx * $scale, $offset[1] + $by * $scale, $bw * $scale, $bh * $scale];
        if ($ink[0] < 0 || $ink[1] < 0 || $ink[0] + $ink[2] > $cw || $ink[1] + $ink[3] > $ch)
            throw new RuntimeException("Vessel clipped at native size: $name");
        $frame = ['source' => "data/aventura/art/river/cutouts/$id.png", 'rect' => $cell,
            'size' => $sheet['canvas'], 'anchor' => $sheet['anchor'],
            'preserveCanvas' => true, 'cleanFragments' => 0.005,
            'registration' => ['scale' => $scale, 'offset' => $offset]];
        $frames[$name] = $frame;
        $poses[$name] = ['ink' => $ink, 'seat' => [$offset[0] + $seatX * $scale, $offset[1] + $seatY * $scale]];
        $native = adventureNativeSprite($isolated, $frame, [0, 0, $sw, $sh], []);
        $floorAlpha = [];
        foreach ($sheet['floorProbes'] ?? [] as [$px, $py]) {
            $nx = (int) round(($ax + $px) * imagesx($native) / $cw);
            $ny = (int) round(($ay + $py) * imagesy($native) / $ch);
            $opacity = 1 - ((imagecolorat($native, $nx, $ny) >> 24) & 127) / 127;
            if ($opacity < 0.95) throw new RuntimeException("Open hole in vessel floor: $name/$px,$py");
            $floorAlpha[] = $opacity;
        }
        $poses[$name]['floorAlpha'] = $floorAlpha;
        $x = $col * $cw * 3; $y = $row * ($ch * 3 + 20);
        imagecopyresized($review, $native, $x, $y, 0, 0, $cw * 3, $ch * 3, imagesx($native), imagesy($native));
        imagestring($review, 2, $x + 5, $y + $ch * 3, "$direction / $phase", $label);
        // Attachment overlay is diagnostic only, not baked into any sprite.
        imageline($review, $x + $ax * 3 - 3, $y + $ay * 3, $x + $ax * 3 + 3, $y + $ay * 3, $label);
        imageline($review, $x + $ax * 3, $y + $ay * 3 - 3, $x + $ax * 3, $y + $ay * 3 + 3, $label);
    }
    $temporary = tempnam("$directory/cutouts", '.vessel-');
    try {
        if (!imagepng($source, $temporary, 9) || !rename($temporary, "$directory/cutouts/$id.png"))
            throw new RuntimeException('Cannot publish vessel cutout');
    } finally { if (is_file($temporary)) unlink($temporary); }
    file_put_contents("$root/data/aventura/assets/{$sheet['pack']}.json",
        json_encode(['frames' => $frames], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
    file_put_contents("$directory/cutouts/$id.json", json_encode(['sourceSha256' => $sheet['sourceSha256'],
        'alpha' => $alpha, 'poses' => $poses], JSON_PRETTY_PRINT) . "\n");
    imagepng($review, "$reviewDirectory/{$sheet['id']}.png", 9);
    if (hash_file('sha256', $path) !== $sheet['sourceSha256']) throw new RuntimeException('Source changed');
    echo "{$sheet['id']}: " . count($frames) . " boat-only poses; shared seat $ax,$ay.\n";
    echo "$reviewDirectory/{$sheet['id']}.png\n";
}
