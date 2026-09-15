<?php
declare(strict_types=1);
/** Review the actual shipped 2x textures, not attractive high-resolution masters. */
$root=dirname(__DIR__);$base=$root.'/public/assets/aventura/';
$manifest=json_decode(file_get_contents($base.'manifest.json'),true,512,JSON_THROW_ON_ERROR);
$profiles=json_decode(file_get_contents($root.'/data/aventura/residents.json'),true,512,JSON_THROW_ON_ERROR);
$sheet=imagecreatetruecolor(1440,1280);imagefill($sheet,0,0,imagecolorallocate($sheet,53,68,49));
$ink=imagecolorallocate($sheet,240,229,195);
foreach($profiles as $i=>$profile) {
    $pack=$manifest['packs']['actor-'.$profile['id']];
    $metadata=json_decode(file_get_contents($base.$pack['metadata']),true,512,JSON_THROW_ON_ERROR);
    $f=$metadata['frames']['person-'.$profile['id'].'-down'];$source=imagecreatefrompng($base.$pack['image']);
    $x=($i%10)*144;$y=intdiv($i,10)*128;$ratio=$f['pixelRatio']??1;
    imagecopy($sheet,$source,$x+24,$y+2,$f['x'],$f['y'],$f['w']*$ratio,$f['h']*$ratio);
    imagestring($sheet,2,$x+10,$y+106,$profile['id'].' '.iconv('UTF-8','ASCII//TRANSLIT',$profile['label']),$ink);
    unset($source);
}
$dir=$root.'/.local/residents-review';if(!is_dir($dir))mkdir($dir,0775,true);
imagepng($sheet,$dir.'/cast.png');echo "$dir/cast.png\n";
