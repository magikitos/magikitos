<?php
declare(strict_types=1);
/** Annotated source coordinates for measuring actual seated hands/pelvis, not gameplay art. */
require_once __DIR__.'/lib/adventure-cutout.php';
$root=dirname(__DIR__);$key=getopt('', ['character:'])['character']??'';
if(!preg_match('/^[a-z]+-[a-z]+$/D',$key))throw new RuntimeException('Use --character=profile-key');
$dir="$root/data/aventura/art/playable-cast/$key";
$cfg=json_decode(file_get_contents("$dir/authoring.json"),true,512,JSON_THROW_ON_ERROR);
$settings=$cfg['actions']['row'];$src=imagecreatefrompng("$dir/sources/{$settings['source']}.png");
adventureKeyedCutout($src,'row-landmarks',false,'red');
$out=adventureClearCanvas(imagesx($src),imagesy($src));imagealphablending($out,true);
imagefilledrectangle($out,0,0,imagesx($out)-1,imagesy($out)-1,imagecolorallocate($out,216,223,207));imagecopy($out,$src,0,0,0,0,imagesx($src),imagesy($src));
[$cols,$rows]=$settings['grid'];$w=imagesx($src)/$cols;$h=imagesy($src)/$rows;
for($i=0;$i<8;$i++){
 $ox=(int)round(($i%$cols)*$w);$oy=(int)round(intdiv($i,$cols)*$h);
 $ink=imagecolorallocatealpha($out,30,85,74,75);
 for($x=50;$x<$w;$x+=50){imageline($out,$ox+$x,$oy,$ox+$x,(int)($oy+$h-1),$ink);imagestring($out,2,$ox+$x+2,$oy+4,(string)$x,imagecolorallocate($out,10,50,35));}
 for($y=50;$y<$h;$y+=50){imageline($out,$ox,$oy+$y,(int)($ox+$w-1),$oy+$y,$ink);imagestring($out,2,$ox+2,$oy+$y+2,(string)$y,imagecolorallocate($out,10,50,35));}
 foreach(($cfg['row']['grips'][$i]??[])as[$x,$y]){imageellipse($out,(int)($ox+$x),(int)($oy+$y),16,16,imagecolorallocate($out,250,30,30));}
 if(isset($cfg['row']['seats'][$i])){[$x,$y]=$cfg['row']['seats'][$i];imageellipse($out,(int)($ox+$x),(int)($oy+$y),16,16,imagecolorallocate($out,35,50,250));}
}
imagepng($out,"$dir/review/row-landmarks.png",9);
echo "$dir/review/row-landmarks.png\n";
