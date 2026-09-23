<?php
/** Build independent scene sprite packages. No network, runtime resizing or alpha scans. */
declare(strict_types=1);
require __DIR__ . '/lib/adventure-sprite-packer.php';
$root = dirname(__DIR__);
$studio = in_array('--studio', $argv, true);
$assetRoot = $root . ($studio ? '/.local/adventure-studio/art' : '/public/assets/aventura');
$destination = $assetRoot . '/packs';
if (!is_dir($destination)) {
    mkdir($destination, 0755, true);
}
$write = static function (string $path, string $contents): void {
    if (is_file($path) && file_get_contents($path) === $contents) {
        return;
    }
    $temporary = tempnam(dirname($path), '.sprite-build-');
    try {
        if (file_put_contents($temporary, $contents) !== strlen($contents) || !rename($temporary, $path)) {
            throw new RuntimeException('Could not publish sprite package: ' . $path);
        }
    } finally {
        if (is_file($temporary)) {
            unlink($temporary);
        }
    }
};
$manifest = ['packs'=>[]];
$owners = []; $bytes = 0;
foreach (glob($root . '/data/aventura/assets/*.json') as $file) {
    $id = basename($file, '.json');
    $definitions = adventureSpriteFrames(json_decode(file_get_contents($file), true, flags: JSON_THROW_ON_ERROR));
    if ($studio) {
        foreach ($definitions as &$definition) {
            unset($definition['crop']);
        }
        unset($definition);
    }
    foreach ($definitions as $name => $definition) {
        if (isset($owners[$name])) throw new RuntimeException("Duplicate sprite $name in $id and {$owners[$name]}");
        $owners[$name] = $id;
    }
    $result = bakeAdventureSprites($definitions, $root);
    $json = json_encode($result['metadata'], JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR) . "\n";
    $hash = substr(hash('sha256', $result['image'] . $json), 0, 12);
    $filename = "$id-$hash";
    $write("$destination/$filename.webp", $result['image']);
    $write("$destination/$filename.json", $json);
    $manifest['packs'][$id] = [
        'image'=>"packs/$filename.webp", 'metadata'=>"packs/$filename.json", 'sprites'=>array_keys($definitions),
        'width'=>$result['metadata']['width'], 'height'=>$result['metadata']['height'],
        'bytes'=>strlen($result['image']),
    ];
    $bytes += strlen($result['image']);
}
/**
 * ⛔ UN PAQUETE SE NOMBRA POR SU CONTENIDO, ASÍ QUE CADA CAMBIO DE ARTE DEJA EL ANTERIOR DETRÁS.
 * Nadie los borraba: 26 ficheros y 1,1 MB de dibujos que ningún manifiesto nombraba, vivos en un
 * repositorio público. No los publica nadie —el artefacto copia solo lo que el manifiesto dice—,
 * así que el síntoma es cero y la basura crece con cada retoque. Se poda aquí, que es donde se
 * sabe lo que sigue vivo, y no en un barrido aparte que alguien tenga que acordarse de correr.
 */
$vivos = [];
foreach ($manifest['packs'] as $pack) {
    $vivos[basename($pack['image'])] = true;
    $vivos[basename($pack['metadata'])] = true;
}
foreach (glob($destination . '/*') as $file) {
    if (!isset($vivos[basename($file)])) {
        unlink($file);
    }
}
$write($assetRoot . '/manifest.json', json_encode($manifest, JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR) . "\n");
echo count($owners) . ' sprites in ' . count($manifest['packs']) . " independent packages; $bytes WebP bytes.\n";
