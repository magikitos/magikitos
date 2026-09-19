<?php
/** Small lazy portrait pages, never one walking sheet per choice. */
declare(strict_types=1);
$root = dirname(__DIR__);
$read = static fn(string $file): array => json_decode(
    file_get_contents($file), true, 512, JSON_THROW_ON_ERROR
);
$frames = [];
$profiles = array_column($read($root . '/data/aventura/art/residents/catalog.json')['profiles'], null, 'id');
$cast = array_map('intval', array_keys($read($root . '/data/aventura/player-art.json')['rowingRigs']));
sort($cast);
foreach ($cast as $id) {
    $sheet = $root . "/data/aventura/assets/actor-$id.json";
    if (!is_file($sheet)) {
        throw new RuntimeException("Playable duende without a registered walk sheet: $id");
    }
    $profile = $profiles[$id] ?? throw new RuntimeException("Unknown portrait identity: $id");
    $dir = 'data/aventura/art/playable-cast/' . $profile['key'];
    passthru(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . '/prepare-playable-card.php') .
        ' ' . escapeshellarg('--character=' . $profile['key']), $status);
    if ($status !== 0) throw new RuntimeException("Portrait composition failed: $id");
    $record = $read("$root/$dir/review/portrait.json");
    foreach ([
        'identitySha256' => $record['identityPath'],
        'backgroundSha256' => "$dir/sources/portrait-background.png",
        'promptSha256' => "$dir/prompts/portrait-background.txt",
        'portraitSha256' => "$dir/review/portrait.png",
    ] as $hash => $file) {
        if (hash_file('sha256', "$root/$file") !== $record[$hash])
            throw new RuntimeException("Portrait provenance changed: $id/$hash; rebuild its composition");
    }
    $frames["cast-$id"] = ['source' => "$dir/review/portrait.png", 'grid' => [1, 1],
        'cell' => [0, 0], 'size' => [120, 160], 'anchor' => [60, 160],
        'preserveCanvas' => true, 'continuousAlpha' => true, 'registration' => ['scale' => .5, 'offset' => [0, 0]]];
}
$files = [];
foreach (array_chunk($frames, 8, true) as $page => $pageFrames) {
    $file = $root . "/data/aventura/assets/cast-portraits-$page.json";
    $json = json_encode(['frames' => $pageFrames], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
    if (!is_file($file) || file_get_contents($file) !== $json) file_put_contents($file, $json);
    $files[] = $file;
}
// Only obsolete generated portrait registrations, never source art or another pack.
foreach (glob($root . '/data/aventura/assets/cast-portraits*.json') as $file)
    if (preg_match('/^cast-portraits(?:-\d+)?\.json$/D', basename($file)) && !in_array($file, $files, true)) unlink($file);
echo count($frames) . " cast portraits.\n";
