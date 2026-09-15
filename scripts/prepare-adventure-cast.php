<?php
declare(strict_types=1);
/** Offline alpha extraction and actor registration. Original masters are never overwritten. */
require_once __DIR__ . '/lib/adventure-cutout.php';
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
$only = getopt('', ['sheet:'])['sheet'] ?? null;
if (!is_dir("$dir/cutouts")) mkdir("$dir/cutouts", 0775, true);
// Studio may read art while this offline task runs: never expose half-written PNGs.
$writePng = static function (GdImage $image, string $file): void {
    $temporary = tempnam(dirname($file), '.cast-');
    try {
        if (!imagepng($image, $temporary, 9) || !rename($temporary, $file))
            throw new RuntimeException("Could not write cutout: $file");
    } finally { if (is_file($temporary)) unlink($temporary); }
};
$definitions = $measurements = [];
foreach ($catalog['sheets'] as $sheet) {
    $id = $sheet['id'];
    if ($only && $id !== $only) continue;
    $artDir = $root . '/data/aventura/art/' . ($sheet['directory'] ?? 'cast');
    if (!is_dir("$artDir/cutouts")) mkdir("$artDir/cutouts", 0775, true);
    $source = imagecreatefrompng("$artDir/sources/$id.png");
    $report = adventureKeyedCutout($source, $id, false, $sheet['edgeMatte'] ?? null);
    $writePng($source, "$artDir/cutouts/$id.png");
    [$columns,$rows] = $sheet['grid'];
    $cells = $bounds = [];
    for ($row=0; $row<$rows; $row++) for ($col=0; $col<$columns; $col++) {
        $rect = adventureSourceCell($source, ['grid'=>[$columns,$rows],'cell'=>[$col,$row]]);
        $cells[] = $rect;
        if (!empty($sheet['cleanFragments'])) {
            [$sx,$sy,$sw,$sh]=$rect;
            $cell=adventureClearCanvas($sw,$sh);
            imagecopy($cell,$source,0,0,$sx,$sy,$sw,$sh);
            adventureCleanFragments($cell,$sheet['cleanFragments']);
            [$x,$y,$w,$h]=adventureVisibleBounds($cell,[0,0,$sw,$sh],"$id/$col/$row");
            $bounds[]=[$sx+$x,$sy+$y,$w,$h];
        } else $bounds[] = adventureVisibleBounds($source, $rect, "$id/$col/$row");
    }
    // One scale for the entire sheet. Never fit each arm/leg pose independently.
    // Rolling borrows the standing body's scale rather than inflating a curled body.
    $bodyHeight = $bounds[0][3];
    if (isset($sheet['reference'])) {
        $ref = $measurements[$sheet['reference']];
        $bodyHeight = $ref['bodyHeight'] * ($cells[0][2] / $ref['cellWidth']);
    }
    $ratio = $sheet['height'] / $bodyHeight;
    $measurements[$id] = ['bodyHeight'=>$bodyHeight,'cellWidth'=>$cells[0][2],'ratio'=>$ratio];
    $frames = [];
    foreach ($cells as $index=>$rect) {
        [$sx,$sy,$sw,$sh] = $rect;
        $row = intdiv($index,$columns); $col = $index%$columns;
        if (isset($sheet['exportRows']) && !in_array($row, $sheet['exportRows'], true)) continue;
        $name = $sheet['names'][$index] ?? (
            "person-{$sheet['variant']}-{$sheet['directions'][$col]}" .
            ($sheet['action']==='walk' ? ($row ? "-walk-$row" : '') : "-{$sheet['action']}-$row")
        );
        // Registration is metadata: the original pixels are reduced exactly once by the baker.
        [$cw,$ch] = $catalog['canvas']; [$ax,$ay] = $catalog['anchor'];
        [$bx,$by,$bw,$bh]=$bounds[$index];
        $dx=$ax-$sw*$ratio/2; $dy=$ay-($by-$sy+$bh)*$ratio;
        if ($dx+($bx-$sx)*$ratio<0 || $dx+($bx-$sx+$bw)*$ratio>$cw
            || $dy+($by-$sy)*$ratio<0) throw new RuntimeException("Registered pose clipped: $name");
        $frames[$name]=[
            'source'=>'data/aventura/art/'.($sheet['directory'] ?? 'cast')."/cutouts/$id.png",
            'grid'=>[$columns,$rows],'cell'=>[$col,$row],'size'=>$catalog['canvas'],
            'anchor'=>$catalog['anchor'],'preserveCanvas'=>true,
            'registration'=>['scale'=>$ratio,'offset'=>[$dx,$dy]]
        ];
        if (!empty($sheet['cleanFragments'])) $frames[$name]['cleanFragments']=$sheet['cleanFragments'];
    }
    $definitions[$sheet['pack']] = array_merge($definitions[$sheet['pack']] ?? [], $frames);
    echo "$id: ".count($frames)." registered poses; alpha ".$report['alpha']."\n";
    unset($source);
}
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
