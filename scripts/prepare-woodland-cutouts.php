<?php
declare(strict_types=1);
/**
 * Authorised local cutout preparation. Input masters are immutable.
 * Only the magenta matte is removed; authored colours and silhouette stay intact.
 * Usage: php scripts/prepare-woodland-cutouts.php <asset-id> [...]
 */
require_once __DIR__ . '/lib/adventure-cutout.php';
$dir = dirname(__DIR__) . '/data/aventura/art/woodland-kit';
$catalog = json_decode(file_get_contents($dir . '/prompts.json'), true, flags: JSON_THROW_ON_ERROR);
$known = array_column($catalog['assets'], null, 'id');
if (count($argv) < 2) throw new RuntimeException('Specify one or more asset ids; originals are never overwritten.');
$out = $dir . '/cutouts';
if (!is_dir($out)) mkdir($out, 0755, true);
foreach (array_slice($argv, 1) as $id) {
    if (!preg_match('/^[a-z0-9-]+$/', $id) || !isset($known[$id])) throw new RuntimeException('Unknown asset id');
    $file = $dir . '/' . $id . (is_file($dir . '/' . $id . '-keyed.png') ? '-keyed' : '') . '.png';
    if (!is_file($file)) throw new RuntimeException('Missing master: ' . $id);
    $before = hash_file('sha256', $file);
    $source = imagecreatefrompng($file);
    $matte = ((imagecolorat($source, 0, 0) >> 24) & 127) > 100 ? 'original-alpha' : 'magenta';
    $prepared = adventureKeyedCutout($source, $id, ($known[$id]['matte'] ?? '') === 'foliage');
    $bounds = $prepared['bounds'];
    $temporary = tempnam($out, '.cutout-');
    try {
        if (!imagepng($source, $temporary, 9) || !rename($temporary, $out . '/' . $id . '.png')) throw new RuntimeException('Could not write cutout');
    } finally { if (is_file($temporary)) unlink($temporary); }
    file_put_contents($out . '/' . $id . '.json', json_encode(['source'=>basename($file),'sourceHash'=>$before,'bounds'=>$bounds,'matte'=>$matte,'fringePixels'=>2], JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES) . "\n");
    if (hash_file('sha256', $file) !== $before) throw new RuntimeException('Master was changed');
    echo json_encode(['asset'=>$id,'sourceHash'=>$before,'bounds'=>$bounds,'alpha'=>$prepared['alpha']], JSON_UNESCAPED_SLASHES), "\n";
}
