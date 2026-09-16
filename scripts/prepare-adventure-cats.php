<?php
declare(strict_types=1);
/** Offline only. Preserve masters; native registered animation packs share the 2x baker. */
require_once __DIR__ . '/lib/adventure-cutout.php';
$root = dirname(__DIR__); $dir = "$root/data/aventura/art/cats";
if (!is_dir("$dir/cutouts")) mkdir("$dir/cutouts", 0755, true);
$directions = ['down', 'down-right', 'right', 'up-right', 'up', 'up-left', 'left', 'down-left'];
/** A single authorized alpha pipeline for every preserved master. */
function prepareCatSource(string $dir, string $id, array &$reports): GdImage
{
    $source = imagecreatefrompng("$dir/sources/$id.png");
    imagepalettetotruecolor($source); imagealphablending($source, false); imagesavealpha($source, true);
    $w = imagesx($source); $h = imagesy($source); $clear = imagecolorallocatealpha($source, 0, 0, 0, 127);
    if ((imagecolorat($source, 0, 0) >> 24 & 127) < 100) adventureNeutralCutout($source);
    // Some generated transparent masters have isolated RGB matte along their alpha edge.
    // Only boundary-connected saturated matte is removed, never interior fur or clothing.
    for ($pass = 0; $pass < 3; $pass++) {
        $erase = [];
        for ($y = 1; $y < $h - 1; $y++) for ($x = 1; $x < $w - 1; $x++) {
            $p = imagecolorat($source, $x, $y); if (($p >> 24 & 127) > 100) continue;
            $r = $p >> 16 & 255; $g = $p >> 8 & 255; $b = $p & 255;
            if (max($r, $g, $b) < 245 || min($r, $g, $b) > 20) continue;
            foreach ([[-1,0],[1,0],[0,-1],[0,1]] as [$dx,$dy])
                if ((imagecolorat($source, $x+$dx, $y+$dy) >> 24 & 127) > 100) { $erase[] = [$x,$y]; break; }
        }
        foreach ($erase as [$x,$y]) imagesetpixel($source,$x,$y,$clear);
    }
    $reports[$id] = adventureKeyedCutout($source, $id, false, 'red');
    imagepng($source, "$dir/cutouts/$id.png", 9);
    return $source;
}
$reports = [];
/** Register the torso, not the toes: a walking paw must move without bouncing
 * the entire cat. Ignore the tail/feet bands; keep one scale for the whole clip. */
function registerCatWalk(GdImage $image, array $grid, array $cells, float $scale, array $offset): array
{
    $centres = [];
    foreach ($cells as $cell) {
        [$sx,$sy,$sw,$sh] = adventureSourceCell($image, ['grid'=>$grid,'cell'=>$cell]);
        $mx=0; $my=0; $mass=0;
        for ($y=(int)($sh*.30); $y<(int)($sh*.72); $y++) for ($x=0; $x<$sw; $x++) {
            $alpha = imagecolorat($image,$sx+$x,$sy+$y) >> 24 & 127;
            if ($alpha > 32) continue;
            $mx += $x; $my += $y; $mass++;
        }
        if (!$mass) throw new RuntimeException('Empty cat torso');
        $centres[] = [$mx/$mass, $my/$mass];
    }
    $mean=[array_sum(array_column($centres,0))/count($centres),array_sum(array_column($centres,1))/count($centres)];
    return array_map(static fn($c)=>['scale'=>$scale,'offset'=>[
        $offset[0]+max(-2,min(2,($mean[0]-$c[0])*$scale)),
        $offset[1]+max(-3,min(3,($mean[1]-$c[1])*$scale))]],$centres);
}
foreach (['ginger', 'tuxedo', 'silver', 'calico', 'siamese', 'ascua-carried-hanging', 'old-oars', 'cat-bowl', 'twig-fence', 'garden-seeds'] as $id) {
    $source=prepareCatSource($dir, $id, $reports);
    $w=imagesx($source); $h=imagesy($source);
    $path = "data/aventura/art/cats/cutouts/$id.png"; $frames = [];
    if ($id === 'garden-seeds') {
        $pack = 'garden-seeds';
        $frames['garden-seed-sack']=['source'=>$path,'grid'=>[1,1],'cell'=>[0,0],'size'=>[40,32],'anchor'=>[20,28],'fit'=>true];
    } elseif ($id === 'cat-bowl') {
        $pack = 'cat-bowl';
        foreach (['cat-bowl','cat-bowl-pool'] as $col=>$name)
            $frames[$name]=['source'=>$path,'grid'=>[2,1],'cell'=>[$col,0],'size'=>[88,68],'anchor'=>[44,52],'fit'=>true];
    } elseif ($id === 'twig-fence') {
        $pack='twig-fence';
        for($row=0;$row<3;$row++)for($col=0;$col<2;$col++)
            $frames["twig-fence-$row-$col"]=['source'=>$path,'grid'=>[2,3],'cell'=>[$col,$row],'size'=>$col?[24,44]:[36,28],'anchor'=>$col?[12,33]:[18,24],'fit'=>true];
    } elseif ($id === 'old-oars') {
        $pack = 'woodland-tools';
        $frames['old-oars'] = ['source'=>$path,'grid'=>[1,1],'cell'=>[0,0],'size'=>[40,44],'anchor'=>[20,39],'fit'=>true];
    } elseif ($id === 'ascua-carried-hanging') {
        $pack = 'actor-0-carried';
        $first=adventureVisibleBounds($source,adventureSourceCell($source,['grid'=>[8,2],'cell'=>[0,0]]),$id);
        $ratio=30/$first[3];
        foreach ($directions as $col=>$direction) for ($row=0;$row<2;$row++) {
            [$sx,$sy,$sw,$sh]=adventureSourceCell($source,['grid'=>[8,2],'cell'=>[$col,$row]]);
            [$bx,$by,$bw,$bh]=adventureVisibleBounds($source,[$sx,$sy,$sw,$sh],$id);
            $frames["person-0-$direction-carried-$row"] = ['source'=>$path,'grid'=>[8,2],'cell'=>[$col,$row],'size'=>[44,40],'anchor'=>[22,4],
                'preserveCanvas'=>true,'registration'=>['scale'=>$ratio,'offset'=>[22-($bx-$sx+$bw/2)*$ratio,4-($by-$sy)*$ratio]]];
        }
    } else {
        $pack = "cat-$id";
        foreach ($directions as $col=>$direction) foreach ([0,4] as $row)
            $frames["cat-$id-$direction-$row"] = ['source'=>$path,'grid'=>[8,6],'cell'=>[$col,$row],'size'=>[64,64],'anchor'=>[32,58],
                'preserveCanvas'=>true,'registration'=>['scale'=>56/($h/6),'offset'=>[(64-($w/8)*56/($h/6))/2,2]]];
        // Four separately drawn walking phases; retain the original idle/pickup masters.
        $walk = prepareCatSource($dir, "$id-walk", $reports);
        $scale=56/(imagesy($walk)/4);
        foreach ($directions as $col=>$direction) {
          $registration=registerCatWalk($walk,[8,4],array_map(static fn($row)=>[$col,$row],range(0,3)),$scale,[(64-(imagesx($walk)/8)*$scale)/2,2]);
          for ($row=0;$row<4;$row++)
            $frames["cat-$id-$direction-walk-$row"] = ['source'=>"data/aventura/art/cats/cutouts/$id-walk.png",'grid'=>[8,4],'cell'=>[$col,$row],'size'=>[64,64],'anchor'=>[32,58],
                'preserveCanvas'=>true,'registration'=>$registration[$row]];
        }
        // Rear-only redraw makes the alternating hind paws explicit, not a mirrored coat.
        $rear=prepareCatSource($dir, "$id-rear", $reports);
        $bounds=adventureVisibleBounds($rear,[0,0,imagesx($rear),imagesy($rear)],"$id-rear");
        $ratio=54/$bounds[3];
        $registration=registerCatWalk($rear,[4,1],array_map(static fn($row)=>[$row,0],range(0,3)),$ratio,[(64-imagesx($rear)/4*$ratio)/2,56-($bounds[1]+$bounds[3])*$ratio]);
        for($row=0;$row<4;$row++)
            $frames["cat-$id-up-walk-$row"]=['source'=>"data/aventura/art/cats/cutouts/$id-rear.png",'grid'=>[4,1],'cell'=>[$row,0],'size'=>[64,64],'anchor'=>[32,58],
                'preserveCanvas'=>true,'registration'=>$registration[$row]];
        unset($walk,$rear);
    }
    file_put_contents("$root/data/aventura/assets/$pack.json", json_encode(['frames'=>$frames], JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES)."\n");
}
file_put_contents("$dir/cutouts/report.json", json_encode($reports,JSON_PRETTY_PRINT)."\n");
echo "Five registered cat packs, carried Ascua and reusable oars prepared.\n";
