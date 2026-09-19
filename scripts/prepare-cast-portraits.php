<?php
/** One lazy portrait atlas, not one walking sheet per choice. See docs/CHARACTER-PORTRAITS.md. */
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
    $record = $read("$root/$dir/review/portrait.json");
    foreach ([
        'identitySha256' => "data/aventura/art/residents/sources/{$profile['source']}.png",
        'backgroundSha256' => "$dir/sources/portrait-background.png",
        'promptSha256' => "$dir/prompts/portrait-background.txt",
        'portraitSha256' => "$dir/review/portrait.png",
    ] as $hash => $file) {
        if (hash_file('sha256', "$root/$file") !== $record[$hash])
            throw new RuntimeException("Portrait provenance changed: $id/$hash; rebuild its composition");
    }
    $frames["cast-$id"] = ['source' => "$dir/review/portrait.png", 'grid' => [1, 1],
        'cell' => [0, 0], 'size' => [120, 160], 'anchor' => [60, 160],
        'opaque' => true, 'preserveCanvas' => true, 'registration' => ['scale' => .5, 'offset' => [0, 0]]];
}
$file = $root . '/data/aventura/assets/cast-portraits.json';
$json = json_encode(['frames' => $frames], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
if (!is_file($file) || file_get_contents($file) !== $json) {
    file_put_contents($file, $json);
}
echo count($frames) . " cast portraits.\n";
