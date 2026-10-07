<?php
declare(strict_types=1);
/** Measure the delivered pixels. Equal canvases/anchors alone did not catch
 * Rizo/Chispa growing or Oria shrinking when their running pack loaded. */
$root = dirname(__DIR__);
$directory = "$root/public/assets/aventura";
$read = fn($path) => json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
$manifest = $read("$directory/manifest.json")['packs'];
$scales = $read("$root/data/aventura/art/gait/scale.json");
$directions = $scales['directions'];
$actors = $samples = $running = 0;
$worst = 0;
$negative = [];
function visibleHeight(GdImage $image, array $frame, string $name): float {
    if ([$frame['w'], $frame['h'], $frame['anchor']] !== [48, 48, [24, 46]])
        throw new RuntimeException("Actor canvas/anchor changed: $name");
    $density = $frame['pixelRatio']; $xs = $ys = [];
    for ($y=0; $y<48*$density; $y++) for ($x=0; $x<48*$density; $x++) {
        $color = imagecolorsforindex($image, imagecolorat($image, $frame['x']+$x, $frame['y']+$y));
        if ($color['alpha'] <= 37) { $xs[]=$x; $ys[]=$y; }
    }
    if (!$xs || min($xs)<=0 || min($ys)<=0 || max($xs)>=48*$density-1 || max($ys)>=48*$density-1)
        throw new RuntimeException("Empty or clipped actor: $name");
    if (abs((max($ys)+1)/$density-46)>1)
        throw new RuntimeException("Sole anchor drifted: $name");
    return (max($ys)-min($ys)+1)/$density;
}
foreach ($manifest as $key=>$pack) {
    if (!preg_match('/^actor-(\d+)$/D', $key, $match)) continue;
    $id = (int)$match[1]; $actors++; $heights = [];
    foreach (['walk', 'run'] as $pace) {
        $key = "actor-$id".($pace==='run'?'-run':'');
        if (!isset($manifest[$key])) continue;
        if ($pace==='run') $running++;
        $pack = $manifest[$key];
        $frames = $read("$directory/{$pack['metadata']}")['frames'];
        $image = imagecreatefromstring(file_get_contents("$directory/{$pack['image']}"));
        foreach ($directions as $direction) for ($pose=0; $pose<4; $pose++) {
            $name = "person-$id-$direction".($pace==='walk'&&!$pose?'':"-$pace-$pose");
            $heights[$pace][$direction][$pose] = visibleHeight($image, $frames[$name], $name);
            $samples++;
        }
        unset($image);
    }
    if (!isset($heights['run'])) continue;
    foreach ($directions as $direction) {
        $walk = $heights['walk'][$direction];
        $walk = ($walk[1]+2*$walk[2]+$walk[3])/4;
        $run = array_sum($heights['run'][$direction])/4;
        $drift = abs($run-$walk); $worst = max($worst,$drift);
        if ($drift>1.5) throw new RuntimeException("Pace size jump: $id/$direction ($drift px)");
        // Real regressions, not just malformed metadata: undoing the correction
        // must make these shipped pixel measurements fail the same threshold.
        if (in_array($id,[200,201,207],true) && $direction==='down') {
            $oldRun = $run/$scales['characters'][(string)$id]['run'][$direction];
            if (abs($oldRun-$walk)<=1.5) throw new RuntimeException("Missed original size regression: $id");
            $negative[]=$id;
        }
    }
}
if (count($negative)!==3) throw new RuntimeException('Missing size regression coverage');
echo "PASS gait size: $actors identities, $running running sheets, $samples baked poses / eight directions; sole anchors and margins; cycle size drift <= ".round($worst,3)."px; Rizo, Chispa and Oria regressions detected.\n";
