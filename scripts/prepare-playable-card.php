<?php
declare(strict_types=1);
/** Offline alpha card: approved identity pixels, faint generated scenery, restrained halo. */
require_once __DIR__.'/lib/adventure-actor-registration.php';
$root=dirname(__DIR__);$key=getopt('', ['character:'])['character']??'';
if(!preg_match('/^[a-z]+-[a-z]+$/D',$key))throw new RuntimeException('Use --character=profile-key');
$dir="$root/data/aventura/art/playable-cast/$key";
$cfg=is_file("$dir/authoring.json") ? json_decode(file_get_contents("$dir/authoring.json"),true,512,JSON_THROW_ON_ERROR) : [];
$profiles=json_decode(file_get_contents("$root/data/aventura/art/residents/catalog.json"),true,512,JSON_THROW_ON_ERROR)['profiles'];
$profile=null;foreach($profiles as $p)if($p['key']===$key)$profile=$p;
$cfg['variant']??=$profile['id']??throw new RuntimeException('Unknown portrait identity');
$cfg['reference']??=$profile['source']??throw new RuntimeException('Missing portrait reference');
$cfg['referencePath']??="data/aventura/art/residents/sources/{$cfg['reference']}.png";
if(!is_dir("$dir/review"))mkdir("$dir/review",0775,true);
$path=realpath($root.'/'.$cfg['referencePath']);
if(!$path||!str_starts_with($path,$root.'/data/aventura/art/'))throw new RuntimeException('Art identity path required');
$source=imagecreatefrompng($path);
// Only the front/idle cell is used. Other rows with pending edge corrections are
// not a reason to regenerate or replace the approved portrait face.
try{adventureKeyedCutout($source,'portrait-identity',false,'red');}
catch(RuntimeException $e){if(!str_starts_with($e->getMessage(),'Art touches source edge;'))throw $e;}
$sw=(int)round(imagesx($source)/8);$nominal=imagesy($source)/4;$best=INF;$separator=0;
for($y=(int)($nominal*.70);$y<(int)($nominal*1.35);$y++){
 $ink=0;for($x=0;$x<$sw;$x++)if((imagecolorat($source,$x,$y)>>24&127)<127)$ink++;
 $score=$ink*1000+abs($y-$nominal);if($score<$best){$best=$score;$separator=$y;}
}
if($best>=1000)throw new RuntimeException('Portrait idle needs a reviewed separating row');
// Include the verified transparent separator itself; otherwise the last full
// antialiased boot pixel can sit on the crop edge despite not being clipped.
$separator++;
$rect=[0,0,$sw,$separator];$cell=adventurePreparedSpriteCell($source,$rect,['cleanFragments'=>.015]);
[$x,$y,$w,$h]=adventureVisibleBounds($cell,[0,0,$sw,$separator],'portrait');
if($x<1||$y<1||$x+$w>=$sw||$y+$h>=$separator)throw new RuntimeException('Portrait silhouette is clipped');
$bgPath="$dir/sources/portrait-background.png";$bg=imagecreatefrompng($bgPath);
$small=adventureClearCanvas(240,320);imagecopyresampled($small,$bg,0,0,0,0,240,320,imagesx($bg),imagesy($bg));
$out=adventureClearCanvas(240,320);$settings=$cfg['portrait']??[];
$opacity=$settings['backgroundOpacity']??.16;$halo=$settings['haloOpacity']??.24;$rgb=$settings['haloColor']??[245,210,131];
for($yy=0;$yy<320;$yy++)for($xx=0;$xx<240;$xx++){
 $p=imagecolorat($small,$xx,$yy);$a=1-(($p>>24&127)/127);
 $edge=pow(max(0,1-pow(abs(($xx-120)/120),4))*max(0,1-pow(abs(($yy-160)/160),4)),2);
 $a*=$opacity*$edge;
 imagesetpixel($out,$xx,$yy,imagecolorallocatealpha($out,$p>>16&255,$p>>8&255,$p&255,(int)round(127*(1-$a))));
}
imagealphablending($out,true);
for($yy=0;$yy<320;$yy++)for($xx=0;$xx<240;$xx++){
 $r=pow(($xx-120)/93,2)+pow(($yy-142)/133,2);
 $alpha=$halo*exp(-3.5*$r)*max(0,1-$r/2);
 if($alpha>.008)imagesetpixel($out,$xx,$yy,imagecolorallocatealpha($out,$rgb[0],$rgb[1],$rgb[2],(int)round(127*(1-$alpha))));
}
$scale=min(194/$w,274/$h);$dw=(int)round($w*$scale);$dh=(int)round($h*$scale);$dx=(int)round((240-$dw)/2);$dy=292-$dh;
imagecopyresampled($out,$cell,$dx,$dy,$x,$y,$dw,$dh,$w,$h);imagesavealpha($out,true);
imagepng($out,"$dir/review/portrait.png",9);
$record=['variant'=>$cfg['variant'],'identity'=>$cfg['reference'],'identitySha256'=>hash_file('sha256',$path),'identityPath'=>$cfg['referencePath'],
 'backgroundSha256'=>hash_file('sha256',$bgPath),'promptSha256'=>hash_file('sha256',"$dir/prompts/portrait-background.txt"),'portraitSha256'=>hash_file('sha256',"$dir/review/portrait.png"),
 'sourceRect'=>$rect,'ink'=>[$x,$y,$w,$h],'destination'=>[$dx,$dy,$dw,$dh],'scale'=>$scale,'size'=>[240,320],'opaque'=>false,
 'backgroundOpacity'=>$opacity,'haloOpacity'=>$halo,'method'=>'Approved original identity; transparent generated scenery with reduced alpha and diffuse halo, composed offline.'];
file_put_contents("$dir/review/portrait.json",json_encode($record,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES)."\n");
$preview=adventureClearCanvas(720,320);imagealphablending($preview,true);
foreach([[20,42,34],[113,139,85],[231,222,201]]as$i=>$color){imagefilledrectangle($preview,$i*240,0,$i*240+239,319,imagecolorallocate($preview,...$color));imagecopy($preview,$out,$i*240,0,0,0,240,320);}
imagepng($preview,"$dir/review/portrait-backgrounds.png",9);
echo "$key: alpha portrait with original identity, three-background proof.\n";
