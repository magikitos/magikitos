<?php
declare(strict_types=1);
/** Offline matte extraction only. Original pose sheets and their hashes are retained. */
require_once __DIR__ . '/lib/adventure-cutout.php';
$dir = dirname(__DIR__) . '/data/aventura/art/picnic-polish';
$out = $dir . '/cutouts';
if (!is_dir($out)) mkdir($out, 0755, true);
foreach (['picnic-smoker-poses', 'picnic-friend-poses'] as $id) {
    $file = $dir . '/' . $id . '.png';
    $hash = hash_file('sha256', $file);
    $source = imagecreatefrompng($file);
    $prepared = adventureKeyedCutout($source, $id);
    $temporary = tempnam($out, '.cutout-');
    try {
        if (!imagepng($source, $temporary, 9) || !rename($temporary, $out . '/' . $id . '.png'))
            throw new RuntimeException('Could not write actor cutout');
    } finally { if (is_file($temporary)) unlink($temporary); }
    file_put_contents($out . '/' . $id . '.json', json_encode([
        'source'=>basename($file), 'sourceHash'=>$hash, 'bounds'=>$prepared['bounds'],
        'matte'=>'magenta-or-original-alpha', 'fringePixels'=>2
    ], JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES) . "\n");
    if (hash_file('sha256', $file) !== $hash) throw new RuntimeException('Master changed');
    echo $id, ': ', json_encode($prepared), "\n";
}
