<?php
declare(strict_types=1);
require __DIR__.'/lib/adventure-actor-registration.php';
$root=dirname(__DIR__);
$directory="$root/data/aventura/art/gait";
$catalog=json_decode(file_get_contents("$directory/catalog.json"),true,512,JSON_THROW_ON_ERROR);
$cache=[];$checked=0;
foreach ($catalog['characters'] as $id=>$spec) foreach (['walk','run'] as $action) {
    $qa=json_decode(file_get_contents("$directory/cutouts/$id-$action.json"),true,512,JSON_THROW_ON_ERROR);
    if ($qa['recipeSha256']!==hash('sha256',json_encode($spec))) throw new RuntimeException("Stale gait recipe: $id/$action");
    $image=imagecreatefrompng("$directory/cutouts/$id-$action.png");
    if (imagesx($image)!==2304 || imagesy($image)!==384) throw new RuntimeException('Unexpected gait canvas');
    foreach (array_values($qa['poses']) as $column=>$pose) {
        $frame=$pose['baseFrame'];
        $original=$cache[$frame['source']]??=imagecreatefrompng("$root/{$frame['source']}");
        $cell=adventurePreparedSpriteCell($original,adventureSourceCell($original,$frame),$frame);
        $native=adventureNativeSprite($cell,$frame,[0,0,imagesx($cell),imagesy($cell)],[],['pixelRatio'=>8,'sampling'=>'area']);
        // No generated face, hat or torso can replace the approved character.
        // Exact opaque pixels above the authored lower-body overlap must survive.
        $limit=(int)floor(($spec[$action]['cut']-3)*8);
        for($y=0;$y<$limit;$y++) for($x=0;$x<384;$x++) {
            $before=imagecolorat($native,$x,$y);
            if((($before>>24)&127)!==0) continue;
            if($before!==imagecolorat($image,$column*384+$x,$y)) {
                throw new RuntimeException("Upper-body identity changed: $id/$action/$column/$x/$y");
            }
        }
        $checked++;
    }
}
echo "PASS $checked contact images: original opaque head/hat/torso pixels preserved, current recipes and fixed canvases.\n";
