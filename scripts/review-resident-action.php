<?php
declare(strict_types=1);
/** Review a candidate at the EXACT production scale without declaring it in the runtime atlas.
 * Alpha/crops only. Original pixels and accepted source catalogs remain untouched. */
require_once __DIR__ . '/lib/adventure-actor-registration.php';
$root = dirname(__DIR__);
$options = getopt('', ['variant:', 'action:', 'source:', 'registration:', 'measure']);
$residents = json_decode(file_get_contents("$root/data/aventura/art/residents/catalog.json"), true, 512, JSON_THROW_ON_ERROR);
$actions = json_decode(file_get_contents("$root/data/aventura/art/residents/actions/catalog.json"), true, 512, JSON_THROW_ON_ERROR);
$profiles = array_column($residents['profiles'], null, 'id');
$variant = filter_var($options['variant'] ?? null, FILTER_VALIDATE_INT);
$action = $options['action'] ?? '';
if (!in_array($variant, $actions['variants'], true) || !isset($actions['actions'][$action])) throw new RuntimeException('Unknown candidate');
$profile = $profiles[$variant];
$file = realpath($options['source'] ?? '');
if (!$file || !str_starts_with($file, $root . '/data/aventura/art/residents/actions/sources/') || pathinfo($file, PATHINFO_EXTENSION) !== 'png')
    throw new RuntimeException('Use an immutable candidate in actions/sources');
$base = ['id' => $profile['source'], 'grid' => $residents['grid'], 'directions' => $residents['directions'],
    'variant' => $variant, 'height' => $residents['height'], 'action' => 'walk', 'cleanFragments' => 0.015];
$sources = $actions['sheets'];
foreach ($actions['sheets'] as $sheet) array_push($sources, ...($sheet['overrides'] ?? []));
$metadata = array_values(array_filter($sources, fn($s) => $s['id'] === pathinfo($file, PATHINFO_FILENAME)))[0] ?? [];
// Measured candidate anchors can be reviewed before the source is accepted into the atlas.
if (isset($options['registration'])) {
    $registration = json_decode(file_get_contents($options['registration']), true, 512, JSON_THROW_ON_ERROR);
    $allowed = ['grid', 'directions', 'sourceSeatAnchors', 'sourceCellWidth', 'sourceColumnBounds', 'sourceRowBounds', 'sourceRects'];
    if (array_diff(array_keys($registration), $allowed)) throw new RuntimeException('Unknown registration field');
    $metadata = $registration + $metadata;
}
$candidate = $metadata + $actions['actions'][$action] + ['id' => pathinfo($file, PATHINFO_FILENAME), 'variant' => $variant,
    'action' => $action, 'height' => $residents['height'], 'reference' => $profile['source'], 'strictMargins' => true, 'cleanFragments' => 0.015];
if (($candidate['directions'] ?? null) === 'eight') $candidate['directions'] = $residents['directions'];
if (isset($candidate['names'])) $candidate['names'] = array_map(fn($n) => "person-$variant-$n", $candidate['names']);
$images = [$profile['source'] => imagecreatefrompng("$root/data/aventura/art/residents/sources/{$profile['source']}.png"),
    $candidate['id'] => imagecreatefrompng($file)];
$reference = null; $registered = [];
foreach ([$base, $candidate] as $sheet) {
    $source = $images[$sheet['id']];
    adventureKeyedCutout($source, $sheet['id'], false, 'red');
    [$cells, $bounds] = adventureActorCells($source, $sheet);
    if ($sheet['id'] === $candidate['id'] && isset($options['measure'])) {
        echo json_encode(['size' => [imagesx($source), imagesy($source)], 'cells' => $cells,
            'bounds' => $bounds, 'reference' => $reference], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . "\n";
        exit;
    }
    $registered[$sheet['id']] = adventureRegisterActor($sheet, $residents, $cells, $bounds, $reference);
    $reference = $registered[$sheet['id']]['measurement'];
}
[$columns, $rows] = $candidate['grid'];
$canvas = $candidate['canvas'] ?? $residents['canvas'];
$cellWidth = max(176, $canvas[0] * 3 + 16);
$cellHeight = max(164, $canvas[1] * 3 + 26);
$out = imagecreatetruecolor($columns * $cellWidth, ($rows + 1) * $cellHeight);
imagefill($out, 0, 0, imagecolorallocate($out, 112, 140, 83));
$ink = imagecolorallocate($out, 249, 237, 201);
for ($row = 0; $row <= $rows; $row++) for ($col = 0; $col < $columns; $col++) {
    $direction = $candidate['directions'][$col] ?? 'down';
    $name = $row === 0 ? "person-$variant-$direction" : array_keys($registered[$candidate['id']]['frames'])[($row - 1) * $columns + $col];
    $sheet = $row === 0 ? $base : $candidate;
    $frame = $registered[$sheet['id']]['frames'][$name];
    $source = $images[$sheet['id']];
    $cell = adventurePreparedSpriteCell($source, adventureSourceCell($source, $frame), $frame);
    $image = adventureNativeSprite($cell, $frame, [0, 0, imagesx($cell), imagesy($cell)], []);
    // Same 3x viewing magnification and baseline, including the sheet-specific attachment.
    $candidateAnchor = $candidate['anchor'] ?? $residents['anchor'];
    $support = $row > 0 && ($candidate['registrationPoint'] ?? '') === 'top'
        ? 14 : $cellHeight - 22 - max(0, $canvas[1] - $candidateAnchor[1]) * 3;
    $x = $col * $cellWidth + $cellWidth / 2 - $frame['anchor'][0] * 3;
    $y = $row * $cellHeight + $support - $frame['anchor'][1] * 3;
    imagecopyresized($out, $image, (int) $x, (int) $y, 0, 0, $frame['size'][0] * 3, $frame['size'][1] * 3, imagesx($image), imagesy($image));
    imagestring($out, 2, $col * $cellWidth + 4, ($row + 1) * $cellHeight - 16, $row ? "$action " . ($row - 1) : "$direction idle", $ink);
}
$directory = "$root/.local/actor-action-reviews";
if (!is_dir($directory)) mkdir($directory, 0775, true);
$output = "$directory/{$candidate['id']}.png";
imagepng($out, $output, 9);
echo "$output\n";
foreach ($registered[$candidate['id']]['poses'] as $name => $pose)
    echo "$name: ink height " . round($pose['ink'][3], 2) . "; support {$pose['support']}\n";
