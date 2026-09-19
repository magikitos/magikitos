<?php
declare(strict_types=1);
// Offline candidate presentation only. No registration, integration or game build.
require_once dirname(__DIR__, 6) . '/scripts/lib/adventure-cutout.php';
$selected = json_decode(file_get_contents(__DIR__ . '/selection.json'), true, 512, JSON_THROW_ON_ERROR);
$ids = isset($argv[1]) ? [(int)$argv[1]] : range(101, 110);
foreach (['sheets', 'review'] as $directory) if (!is_dir(__DIR__ . '/' . $directory)) mkdir(__DIR__ . '/' . $directory, 0775, true);
$records = [];
foreach ($ids as $id) {
    if (!isset($selected[$id])) throw new RuntimeException('Unknown candidate');
    $input = __DIR__ . '/sources/' . $selected[$id];
    $source = imagecreatefrompng($input);
    try { $qa = adventureKeyedCutout($source, 'candidate-' . $id, false, 'red'); }
    catch (RuntimeException $error) {
        if (!str_starts_with($error->getMessage(), 'Art touches source edge;')) throw $error;
        // Keep design candidates intact; do not claim runtime margin certification.
        // The cleaner has already removed the matte, without altering the drawing.
        $qa = ['runtimeMarginReviewRequired' => true, 'warning' => $error->getMessage()];
        echo "resident-$id: source-edge margin needs review BEFORE any runtime integration\n";
    }
    $output = __DIR__ . '/sheets/resident-' . $id . '.png';
    imagepng($source, $output, 9);
    $w = imagesx($source); $h = imagesy($source);
    $ears = imagecreatetruecolor(1440, 180);
    imagefill($ears, 0, 0, imagecolorallocate($ears, 237, 229, 208));
    for ($column = 0; $column < 8; $column++) {
        $sx = (int)round(($column + .12) * $w / 8);
        $sy = (int)round(.23 * $h / 4);
        $sw = (int)round(.76 * $w / 8); $sh = (int)round(.48 * $h / 4);
        $factor = min(176 / $sw, 172 / $sh);
        imagecopyresampled($ears, $source, $column * 180, 4, $sx, $sy, (int)round($sw * $factor), (int)round($sh * $factor), $sw, $sh);
    }
    imagepng($ears, __DIR__ . '/review/ears-' . $id . '.png', 9);
    $bounds = adventureVisibleBounds($source, [0, 0, (int)round($w / 8), (int)round($h / 4)], 'front-' . $id);
    [$x, $y, $iw, $ih] = $bounds;
    $preview = imagecreatetruecolor(250, 330);
    imagefill($preview, 0, 0, imagecolorallocate($preview, 237, 229, 208));
    $scale = min(210 / $iw, 272 / $ih, 1.35);
    $dw = (int)round($iw * $scale); $dh = (int)round($ih * $scale);
    imagecopyresampled($preview, $source, (int)((250 - $dw) / 2), 286 - $dh, $x, $y, $dw, $dh, $iw, $ih);
    imagestring($preview, 5, 110, 306, (string)$id, imagecolorallocate($preview, 43, 66, 48));
    imagepng($preview, __DIR__ . '/review/resident-' . $id . '.png', 9);
    $records[$id] = ['source' => $selected[$id], 'sourceSha256' => hash_file('sha256', $input), 'sheetSha256' => hash_file('sha256', $output), 'size' => [$w, $h], 'frontCrop' => $bounds, 'matte' => $qa];
    echo "resident-$id: reviewed-alpha sheet and front preview prepared\n";
}
if (count($ids) === 10) {
    $overview = imagecreatetruecolor(1250, 660);
    foreach ($ids as $index => $id) {
        $tile = imagecreatefrompng(__DIR__ . '/review/resident-' . $id . '.png');
        imagecopy($overview, $tile, ($index % 5) * 250, intdiv($index, 5) * 330, 0, 0, 250, 330);
    }
    imagepng($overview, __DIR__ . '/review/overview.png', 9);
    file_put_contents(__DIR__ . '/review/provenance.json', json_encode($records, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
}
