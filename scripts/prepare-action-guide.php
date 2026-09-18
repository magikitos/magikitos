<?php
declare(strict_types=1);
/** Offline reference layout only: copy approved standing pixels; never generate or repaint art. */
require_once __DIR__ . '/lib/adventure-cutout.php';
$root = dirname(__DIR__);
$options = getopt('', ['variant:', 'action:']);
$variant = filter_var($options['variant'] ?? null, FILTER_VALIDATE_INT);
$action = $options['action'] ?? '';
$residents = json_decode(file_get_contents("$root/data/aventura/art/residents/catalog.json"), true, 512, JSON_THROW_ON_ERROR);
$catalog = json_decode(file_get_contents("$root/data/aventura/art/residents/actions/catalog.json"), true, 512, JSON_THROW_ON_ERROR);
$profiles = array_column($residents['profiles'], null, 'id');
if (!in_array($variant, $catalog['variants'], true) || !isset($catalog['actions'][$action]))
    throw new RuntimeException('Choose a target variant and one of its seven actions');
$profile = $profiles[$variant];
$sourcePath = "$root/data/aventura/art/residents/sources/{$profile['source']}.png";
$sourceHash = hash_file('sha256', $sourcePath);
$source = imagecreatefrompng($sourcePath);
adventureKeyedCutout($source, $profile['source'], false, 'red');
$spec = $catalog['actions'][$action];
[$columns, $rows] = $spec['grid'];
$cw = (int) ceil(imagesx($source) / $residents['grid'][0]);
$ch = (int) ceil($cw * 1.45);
$out = adventureClearCanvas($cw * $columns, $ch * $rows);
for ($row = 0; $row < $rows; $row++) for ($col = 0; $col < $columns; $col++) {
    $direction = ($spec['directions'] ?? null) === 'eight'
        ? $residents['directions'][$col]
        : ($spec['directions'][$col] ?? ($action === 'needs' ? 'down-right' : 'down'));
    $index = array_search($direction, $residents['directions'], true);
    [$sx, $sy, $sw, $sh] = adventureSourceCell($source, ['grid' => $residents['grid'], 'cell' => [$index, 0]]);
    $cell = adventureClearCanvas($sw, $sh);
    imagecopy($cell, $source, 0, 0, $sx, $sy, $sw, $sh);
    adventureCleanFragments($cell, 0.015);
    [$bx, $by, $bw, $bh] = adventureVisibleBounds($cell, [0, 0, $sw, $sh], $direction);
    $x = $col * $cw + intdiv($cw - $sw, 2);
    $y = $row * $ch + (int) round($ch * 0.86) - ($by + $bh);
    imagecopy($out, $cell, $x, $y, 0, 0, $sw, $sh);
}
$directory = "$root/.local/actor-action-guides";
if (!is_dir($directory)) mkdir($directory, 0775, true);
$file = "$directory/{$profile['key']}-$action.png";
imagepng($out, $file, 9);
if (hash_file('sha256', $sourcePath) !== $sourceHash) throw new RuntimeException('Source changed');
echo "$file\n";
