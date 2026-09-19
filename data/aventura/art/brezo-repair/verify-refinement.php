<?php
declare(strict_types=1);
// Offline regression for the selected master, not a claim about unintegrated art.
$root=dirname(__DIR__,4);
$master=imagecreatefrompng($root.'/data/aventura/art/residents/actions/sources/brezo-alba-row-matte.png');
$bodies=imagecreatefrompng(__DIR__.'/review/row-fixed-bodies.png');
$coverage=imagecreatefrompng(__DIR__.'/review/row-oar-coverage.png');
$directions=['down','down-right','right','up-right','up','up-left','left','down-left'];
if(imagesx($master)!==3072||imagesy($master)!==1536||imagesx($bodies)!==3072||imagesy($bodies)!==384)
    throw new RuntimeException('Sheet geometry changed');

function verifyFixedBodies(GdImage $master,GdImage $bodies,GdImage $coverage):int {
    $checked=0;
    for($row=0;$row<4;$row++)for($col=0;$col<8;$col++) {
        for($y=0;$y<384;$y++)for($x=0;$x<384;$x++) {
            $bx=$col*384+$x;$my=$row*384+$y;
            $body=imagecolorat($bodies,$bx,$y);$actual=imagecolorat($master,$bx,$my);
            // Actual paddle pixels alone may change. No silhouette, head, garment,
            // hands or seat normalization can move elsewhere between phases.
            if((imagecolorat($coverage,$bx,$my)>>24&127)!==127)continue;
            if(($body>>24&127)===127&&($actual>>24&127)===127)continue;
            if($actual!==$body)throw new RuntimeException("Body pixel changed outside oars: $col/$row at $x,$y");
            $checked++;
        }
    }
    return $checked;
}
$checked=verifyFixedBodies($master,$bodies,$coverage);
echo "PASS: $checked immutable body pixels across 8 headings × 4 phases; only oar coverage can change.\n";

// Negative control: the test must catch a changed face, not merely validate files.
$x=190;$y=180+384;$old=imagecolorat($master,$x,$y);
imagesetpixel($master,$x,$y,imagecolorallocate($master,255,0,255));
$caught=false;
try {verifyFixedBodies($master,$bodies,$coverage);}catch(RuntimeException $e){$caught=true;}
imagesetpixel($master,$x,$y,$old);
if(!$caught)throw new RuntimeException('Body stability test did not catch altered face');

$rowing=json_decode(file_get_contents($root.'/data/aventura/rowing.json'),true,512,JSON_THROW_ON_ERROR);
$raw=json_decode(file_get_contents(__DIR__.'/review/row-rig-source.json'),true,512,JSON_THROW_ON_ERROR);
$qa=json_decode(file_get_contents($root.'/data/aventura/art/residents/actions/cutouts/brezo-alba-row-matte.json'),true,512,JSON_THROW_ON_ERROR);
foreach($directions as $direction)foreach($rowing['rigs']['brezo'][$direction] as $phase=>$pair) {
    foreach($pair as $i=>$oar) {
        if(array_slice($oar,0,2)!==array_slice($rowing['rigs']['brezo'][$direction][0][$i],0,2))
            throw new RuntimeException("Hand pivot moves: $direction/$phase/$i");
        foreach($oar as $axis=>$value)
            if(abs($value-round($raw[$direction][$phase][$i][$axis]*$qa['measurement']['ratio'],2))>.001)
                throw new RuntimeException("Runtime clipping rig does not match drawn oar: $direction/$phase/$i");
    }
}
foreach(['right'=>[-4,2],'left'=>[4,2],'down-right'=>[-3,-1],'down-left'=>[3,-1]] as $direction=>$offset)
    if($rowing['vessels']['bottle']['views'][$direction]['rowerOffset']!==$offset)
        throw new RuntimeException('Approved bottle seat registration changed');
echo "PASS: fixed hand pivots, measured runtime clipping landmarks, approved stern offsets, negative control.\n";
