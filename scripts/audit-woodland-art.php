<?php
declare(strict_types=1);
/** Native-scale QA contact sheets, not runtime assets. */
require __DIR__.'/lib/adventure-sprite-packer.php';
$root=dirname(__DIR__);$dir=$root.'/data/aventura/art/woodland-kit';
$kit=json_decode(file_get_contents($dir.'/prompts.json'),true,flags:JSON_THROW_ON_ERROR);
$assets=[];$missing=[];
foreach($kit['assets'] as $a) {
 $file=$dir.'/cutouts/'.$a['id'].'.png';
 if(!is_file($file)) {$missing[]=$a['id'];continue;}
 $assets[]=$a;
}
if($missing && !in_array('--available',$argv,true)) throw new RuntimeException('Missing cutouts: '.implode(', ',$missing));
$out=$dir.'/previews';if(!is_dir($out))mkdir($out,0755,true);
foreach(array_chunk($assets,12) as $page=>$items) {
 $sheet=imagecreatetruecolor(800,(int)ceil(count($items)/4)*236);
 $grass=imagecolorallocate($sheet,121,144,91);imagefill($sheet,0,0,$grass);
 $ink=imagecolorallocate($sheet,244,234,199);
 foreach($items as $i=>$a) {
   $src=imagecreatefrompng($dir.'/cutouts/'.$a['id'].'.png');
   $cell=adventureVisibleBounds($src,[0,0,imagesx($src),imagesy($src)],$a['id']);
   $native=adventureNativeSprite($src,['size'=>$a['size'],'fit'=>true],$cell,[]);
   $factor=min(3,176/imagesx($native),194/imagesy($native));
   $w=(int)round(imagesx($native)*$factor);$h=(int)round(imagesy($native)*$factor);
   $x=($i%4)*200+(int)((200-$w)/2);$y=intdiv($i,4)*236+10+(194-$h);
   imagecopyresized($sheet,$native,$x,$y,0,0,$w,$h,imagesx($native),imagesy($native));
   imagestring($sheet,2,($i%4)*200+8,intdiv($i,4)*236+210,$a['id'],$ink);
   imagestring($sheet,1,($i%4)*200+8,intdiv($i,4)*236+224,implode('x',$a['size']).' native px',$ink);
 }
 imagepng($sheet,$out.'/native-'.($page+1).'.png',6);
}
echo count($assets)," native sprites audited; missing ",count($missing),".\n";
