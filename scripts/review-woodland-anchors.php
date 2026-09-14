<?php
declare(strict_types=1);
require __DIR__.'/lib/adventure-sprite-packer.php';
$dir=dirname(__DIR__).'/data/aventura/art/woodland-kit';
$kit=json_decode(file_get_contents($dir.'/prompts.json'),true);
$assets=array_values(array_filter($kit['assets'],fn($a)=>in_array($a['family'],['log-home','boot-home','leaf-home'])));
foreach($assets as $a) {
 $src=imagecreatefrompng($dir.'/cutouts/'.$a['id'].'.png');
 $bounds=adventureVisibleBounds($src,[0,0,imagesx($src),imagesy($src)],$a['id']);
 $native=adventureNativeSprite($src,['size'=>$a['size'],'fit'=>true],$bounds,[]);
 $canvas=imagecreatetruecolor($a['size'][0]*3,$a['size'][1]*3);
 imagefill($canvas,0,0,imagecolorallocate($canvas,121,144,91));
 imagecopyresized($canvas,$native,0,0,0,0,imagesx($canvas),imagesy($canvas),imagesx($native),imagesy($native));
 $ink=imagecolorallocate($canvas,255,255,255);
 for($x=0;$x<$a['size'][0];$x+=10) {
 imageline($canvas,$x*3,imagesy($canvas)-20,$x*3,imagesy($canvas),$ink);
 imagestring($canvas,2,$x*3,imagesy($canvas)-18,(string)$x,$ink);
 }
 $red=imagecolorallocate($canvas,255,0,70);
 [$x,$y]=$a['anchor'];imageline($canvas,$x*3-10,$y*3,$x*3+10,$y*3,$red);imageline($canvas,$x*3,$y*3-10,$x*3,$y*3+10,$red);
 imagepng($canvas,$dir.'/previews/anchor-'.$a['id'].'.png');
}
echo "Seven house anchors annotated for offline review.\n";
