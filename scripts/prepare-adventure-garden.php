<?php
declare(strict_types=1);
/** Offline garden cutouts. One reusable pack; immutable source sheet, no runtime image processing. */
require_once __DIR__.'/lib/adventure-cutout.php';
$root=dirname(__DIR__); $dir=$root.'/data/aventura/art/garden';
$catalog=json_decode(file_get_contents($dir.'/catalog.json'),true,512,JSON_THROW_ON_ERROR);
$id=$catalog['source']; $source=imagecreatefrompng("$dir/sources/$id.png");
$report=adventureKeyedCutout($source,$id,false,'red');
$temporary=tempnam("$dir/cutouts",'.garden-');
try {
    if (!imagepng($source,$temporary,9) || !rename($temporary,"$dir/cutouts/$id.png")) throw new RuntimeException('Could not save garden cutout');
} finally { if(is_file($temporary)) unlink($temporary); }
$frames=[];
foreach($catalog['frames'] as $frame) {
    $sprite=$frame['sprite']; unset($frame['sprite']);
    $frames[$sprite]=array_merge($frame,['source'=>"data/aventura/art/garden/cutouts/$id.png",'fit'=>true]);
}
file_put_contents($root.'/data/aventura/assets/garden.json',json_encode(['frames'=>$frames],JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES)."\n");
file_put_contents("$dir/cutouts/garden.json",json_encode(['sourceHash'=>hash_file('sha256',"$dir/sources/$id.png"),'report'=>$report],JSON_PRETTY_PRINT)."\n");
echo count($frames)." garden sprites prepared.\n";
