<?php
declare(strict_types=1);
/** Check the shipped pixels, not just equal atlas anchors. A hat tip or a raised
 * foot is not a body axis; average face/chest bands over a complete gait cycle. */
$root=dirname(__DIR__);
$directory="$root/public/assets/aventura";
$manifest=json_decode(file_get_contents("$directory/manifest.json"),true,512,JSON_THROW_ON_ERROR)['packs'];
$variants=json_decode(file_get_contents("$root/data/aventura/art/residents/actions/catalog.json"),true,512,JSON_THROW_ON_ERROR)['variants'];
$directions=['down','down-right','right','up-right','up','up-left','left','down-left'];
$checked=0; $worst=0.0;

function gaitBodyAxis(GdImage $atlas, array $frame): float
{
    $density=$frame['pixelRatio']; $bands=[];
    foreach ([[20,27],[28,32]] as [$top,$bottom]) {
        $rows=[];
        for ($y=$top*$density;$y<$bottom*$density;$y++) {
            $xs=[];
            for ($x=0;$x<$frame['w']*$density;$x++) {
                $pixel=imagecolorsforindex($atlas,imagecolorat($atlas,$frame['x']+$x,$frame['y']+$y));
                if ($pixel['alpha']<32) $xs[]=$x;
            }
            if (count($xs)>3) $rows[]=(min($xs)+max($xs)+1)/(2*$density);
        }
        if (!$rows) throw new RuntimeException('Missing torso band');
        sort($rows); $bands[]=$rows[intdiv(count($rows),2)];
    }
    return array_sum($bands)/count($bands);
}

foreach ($variants as $id) {
    $packs=[];
    foreach (['walk','run'] as $pace) {
        $pack=$manifest["actor-$id".($pace==='run'?'-run':'')];
        $packs[$pace]=[
            imagecreatefromstring(file_get_contents("$directory/{$pack['image']}")),
            json_decode(file_get_contents("$directory/{$pack['metadata']}"),true,512,JSON_THROW_ON_ERROR)['frames'],
        ];
    }
    foreach ($directions as $direction) {
        $axes=[];
        foreach (['walk','run'] as $pace) foreach (($pace==='walk'?[1,2,3,2]:[0,1,2,3]) as $pose) {
            [$image,$frames]=$packs[$pace]; $name="person-$id-$direction-$pace-$pose";
            $frame=$frames[$name];
            if ($frame['anchor']!==[24,46] || [$frame['w'],$frame['h']]!==[48,48])
                throw new RuntimeException("Gait world anchor changed: $name");
            // Sideways/diagonal running deliberately leans into its heading.
            // Only axial headings must keep the body on the same screen column.
            if (in_array($direction,['down','up'],true)) $axes[$pace][]=gaitBodyAxis($image,$frame);
            $checked++;
        }
        if (!$axes) continue;
        $walk=array_sum($axes['walk'])/4; $run=array_sum($axes['run'])/4;
        $drift=abs($run-$walk); $worst=max($worst,$drift);
        if ($drift>0.95) throw new RuntimeException("Lateral pace-switch jump: $id/$direction ($drift logical px)");
        foreach ($axes['run'] as $pose=>$axis) if (abs($axis-$walk)>1.5)
            throw new RuntimeException("Off-centre running pose: $id/$direction/$pose (".($axis-$walk)." logical px)");
        if ($id===100 && $direction==='down' && abs(($run-2.5)-$walk)<=0.95)
            throw new RuntimeException('Regression guard would miss the original Brezo jump');
    }
}
echo "PASS gait alignment: $checked baked gait samples across ".count($variants)." protagonists / eight directions; frontal and rear body drift <= ".round($worst,3)." logical px, stable world anchors; original Brezo regression detected.\n";
