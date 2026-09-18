<?php
declare(strict_types=1);
/** Offline alpha extraction and actor registration. Original masters are never overwritten. */
require_once __DIR__ . '/lib/adventure-actor-registration.php';
$root = dirname(__DIR__);
$dir = $root . '/data/aventura/art/cast';
$catalog = json_decode(file_get_contents($dir . '/catalog.json'), true, 512, JSON_THROW_ON_ERROR);
$residents = json_decode(file_get_contents($root . '/data/aventura/art/residents/catalog.json'), true, 512, JSON_THROW_ON_ERROR);
foreach ($residents['profiles'] as $profile) {
    $catalog['sheets'][] = [
        'id'=>$profile['source'], 'directory'=>'residents', 'edgeMatte'=>'red', 'cleanFragments'=>0.015,
        'grid'=>$residents['grid'], 'directions'=>$residents['directions'],
        'height'=>$residents['height'], 'variant'=>$profile['id'], 'action'=>'walk', 'pack'=>'actor-'.$profile['id'],
    ];
}
$actionsDir = $root . '/data/aventura/art/residents/actions';
$actions = json_decode(file_get_contents("$actionsDir/catalog.json"), true, 512, JSON_THROW_ON_ERROR);
$profiles = array_column($residents['profiles'], null, 'id');
foreach ($actions['sheets'] as $parent) {
  $parts = [$parent];
  $directions = [];
  foreach ($parent['overrides'] ?? [] as $patch) {
    if (isset($patch['variant']) || isset($patch['action']) || isset($patch['overrides'])
        || !isset($patch['grid'], $patch['directions']) || !is_array($patch['directions'])
        || count($patch['directions']) !== $patch['grid'][0]
        || count(array_unique($patch['directions'])) !== count($patch['directions'])
        || array_intersect($directions, $patch['directions'])
        || array_diff($patch['directions'], $residents['directions']))
        throw new RuntimeException('Invalid directional actor override');
    $directions = array_merge($directions, $patch['directions']);
    $parts[] = $patch + ['variant' => $parent['variant'], 'action' => $parent['action'], 'overrideOf' => $parent['id']];
  }
  foreach ($parts as $action) {
    $profile = $profiles[$action['variant']] ?? throw new RuntimeException('Unknown resident');
    $definition = $actions['actions'][$action['action']] ?? throw new RuntimeException('Unknown action');
    foreach ([
        'sourceSha256' => "$actionsDir/sources/{$action['id']}.png",
        'promptSha256' => "$actionsDir/{$action['id']}.prompt.txt",
        'referenceSha256' => $root . "/data/aventura/art/residents/sources/{$profile['source']}.png",
    ] as $field => $file) {
        if (!is_file($file) || hash_file('sha256', $file) !== $action[$field])
            throw new RuntimeException("Actor provenance mismatch: {$action['id']}/$field");
    }
    $sheet = $action + $definition + [
        'directory' => 'residents/actions', 'reference' => $profile['source'],
        'height' => $residents['height'], 'strictMargins' => true,
        'pack' => "actor-{$action['variant']}-{$action['action']}",
    ];
    if (($sheet['directions'] ?? null) === 'eight') $sheet['directions'] = $residents['directions'];
    if (isset($sheet['names']))
        $sheet['names'] = array_map(fn($name) => "person-{$action['variant']}-$name", $sheet['names']);
    $catalog['sheets'][] = $sheet;
  }
}
$only = getopt('', ['sheet:'])['sheet'] ?? null;
foreach ($catalog['sheets'] as $sheet) if ($sheet['id'] === $only && isset($sheet['overrideOf'])) $only = $sheet['overrideOf'];
if (!is_dir("$dir/cutouts")) mkdir("$dir/cutouts", 0775, true);
// Studio may read art while this offline task runs: never expose half-written PNGs.
$writePng = static function (GdImage $image, string $file): void {
    $temporary = tempnam(dirname($file), '.cast-');
    try {
        if (!imagepng($image, $temporary, 9) || !rename($temporary, $file))
            throw new RuntimeException("Could not write cutout: $file");
    } finally { if (is_file($temporary)) unlink($temporary); }
};
$definitions = $measurements = $reports = [];
foreach (adventureActorDependencies($catalog['sheets'], $only) as $sheet) {
    $id = $sheet['id'];
    $artDir = $root . '/data/aventura/art/' . ($sheet['directory'] ?? 'cast');
    if (!is_dir("$artDir/cutouts")) mkdir("$artDir/cutouts", 0775, true);
    $source = imagecreatefrompng("$artDir/sources/$id.png");
    $report = adventureKeyedCutout($source, $id, false, $sheet['edgeMatte'] ?? null);
    $writePng($source, "$artDir/cutouts/$id.png");
    [$cells, $bounds] = adventureActorCells($source, $sheet);
    $registered = adventureRegisterActor($sheet, $catalog, $cells, $bounds,
        isset($sheet['reference']) ? ($measurements[$sheet['reference']] ?? null) : null);
    $measurements[$id] = $registered['measurement'];
    // Dependency measurements are necessary, but --sheet does not rewrite other packages.
    if ($only && $id !== $only && ($sheet['overrideOf'] ?? null) !== $only) continue;
    $frames = $registered['frames'];
    $definitions[$sheet['pack']] = isset($sheet['overrideOf'])
        ? adventureActorOverride($definitions[$sheet['pack']] ?? [], $frames)
        : array_merge($definitions[$sheet['pack']] ?? [], $frames);
    echo "$id: ".count($frames)." registered poses; alpha ".$report['alpha']."\n";
    if (($sheet['directory'] ?? null) === 'residents/actions') {
        $qa = ['sheet' => $id, 'reference' => $sheet['reference'],
            'sourceSha256' => $sheet['sourceSha256'], 'referenceSha256' => $sheet['referenceSha256'],
            'measurement' => $registered['measurement'], 'poses' => $registered['poses']];
        $reports[$id] = $qa;
        if (isset($sheet['overrideOf'])) {
            $parent = &$reports[$sheet['overrideOf']];
            $parent['poses'] = adventureActorOverride($parent['poses'], $qa['poses']);
            $parent['overrides'][$id] = $sheet['sourceSha256'];
            unset($parent);
        }
    }
    unset($source);
}
foreach ($reports as $id => $qa)
    file_put_contents("$actionsDir/cutouts/$id.json", json_encode($qa, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
foreach ($definitions as $pack=>$frames) {
    $file=$root.'/data/aventura/assets/'.$pack.'.json';
    file_put_contents($file,json_encode(['frames'=>$frames],JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES)."\n");
}
if ($only) exit(0);
$coin=imagecreatefrompng("$dir/sources/setin.png");
adventureKeyedCutout($coin,'setin');
$writePng($coin,"$dir/cutouts/setin.png");
$frames=[];
foreach (['setin','setin-angle','setin-edge','setin-flat'] as $i=>$name) {
    $frames[$name]=['source'=>'data/aventura/art/cast/cutouts/setin.png','grid'=>[2,2],
        'cell'=>[$i%2,intdiv($i,2)],'size'=>[20,20],'fit'=>true,'anchor'=>[10,10]];
}
file_put_contents($root.'/data/aventura/assets/currency.json',json_encode(['frames'=>$frames],JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES)."\n");
file_put_contents("$dir/registration.json",json_encode($measurements,JSON_PRETTY_PRINT)."\n");
