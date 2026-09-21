<?php
declare(strict_types=1);
/** Native-texture filmstrips. Diagnostic only: writes to ignored .local, never source/runtime art. */
require __DIR__.'/lib/adventure-actor-registration.php';
$root=dirname(__DIR__);
$residents=json_decode(file_get_contents("$root/data/aventura/art/residents/catalog.json"),true,512,JSON_THROW_ON_ERROR);
$variants=json_decode(file_get_contents("$root/data/aventura/art/residents/actions/catalog.json"),true,512,JSON_THROW_ON_ERROR)['variants'];
$directions=isset($argv[1])?[$argv[1]]:$residents['directions'];
if(array_diff($directions,$residents['directions'])) throw new RuntimeException('Unknown direction');
$directory="$root/.local/gait-review/contacts";
if(!is_dir($directory))mkdir($directory,0775,true);
$cache=[];
foreach($directions as $direction) foreach(array_chunk($variants,6) as $page=>$ids) {
    $out=imagecreatetruecolor(1152,160*count($ids));
    imagefill($out,0,0,imagecolorallocate($out,105,128,83));
    foreach($ids as $row=>$id) foreach(['walk','run'] as $actionIndex=>$action) {
        $suffix=$action==='run'?'-run':'';
        $frames=json_decode(file_get_contents("$root/data/aventura/assets/actor-$id$suffix.json"),true,512,JSON_THROW_ON_ERROR)['frames'];
        foreach(($action==='walk'?[1,2,3,2]:[0,1,2,3]) as $phase=>$pose) {
            $frame=$frames["person-$id-$direction-$action-$pose"];
            $source=$cache[$frame['source']]??=imagecreatefrompng("$root/{$frame['source']}");
            $cell=adventurePreparedSpriteCell($source,adventureSourceCell($source,$frame),$frame);
            $native=adventureNativeSprite($cell,$frame,[0,0,imagesx($cell),imagesy($cell)],[],ADVENTURE_ART_PROFILE);
            $x=($actionIndex*4+$phase)*144;
            imagecopyresized($out,$native,$x,$row*160+16,0,0,144,144,imagesx($native),imagesy($native));
            imagestring($out,2,$x+2,$row*160+1,"$id $action $pose",0xffffff);
        }
    }
    imagepng($out,"$directory/$direction-$page.png");
}
echo "Native texture filmstrips: $directory\n";
