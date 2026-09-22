<?php
/** Deterministic authoring preparation, never browser-side resizing/keying. */
declare(strict_types=1);
require __DIR__.'/lib/adventure-cutout.php';
$root = dirname(__DIR__);
$dir = $root.'/data/aventura/art/restaurant';
$image = imagecreatefrompng($dir.'/sources/tile-kitchen.png');
adventureKeyedCutout($image, 'tile-kitchen', false, 'red');
[$x,$y,$w,$h] = adventureVisibleBounds($image,[0,0,imagesx($image),imagesy($image)],'tile-kitchen');
$cut = adventureClearCanvas($w+8,$h+8);
imagecopy($cut,$image,4,4,$x,$y,$w,$h);
if (!is_dir($dir.'/cutouts')) mkdir($dir.'/cutouts',0755,true);
imagepng($cut,$dir.'/cutouts/tile-kitchen.png',9);
$width=224; $height=(int)round(($h+8)/($w+8)*$width);
$pack=['frames'=>['restaurant-tile-kitchen'=>[
    'source'=>'data/aventura/art/restaurant/cutouts/tile-kitchen.png','grid'=>[1,1],'cell'=>[0,0],
    'size'=>[$width,$height],'preserveCanvas'=>true,'anchor'=>[112,$height-4],
]]];
file_put_contents($root.'/data/aventura/assets/restaurant.json',json_encode($pack,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR)."\n");
echo json_encode(['size'=>[$width,$height],'alphaBounds'=>[$x,$y,$w,$h]])."\n";
