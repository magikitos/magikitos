<?php
declare(strict_types=1);
/** Offline portrait composition: the identity is the original sprite, never a redraw. */
require_once __DIR__.'/lib/adventure-actor-registration.php';
$root=dirname(__DIR__);
$key=getopt('', ['character:'])['character']??'';
if(!preg_match('/^[a-z]+-[a-z]+$/D',$key))throw new RuntimeException('Use --character=profile-key');
$dir="$root/data/aventura/art/playable-cast/$key";
$profiles=json_decode(file_get_contents("$root/data/aventura/art/residents/catalog.json"),true,512,JSON_THROW_ON_ERROR)['profiles'];
$profile=null;foreach($profiles as $p)if($p['key']===$key)$profile=$p;
if(!$profile)throw new RuntimeException('Unknown character');
$reference="$root/data/aventura/art/residents/sources/{$profile['source']}.png";
$background="$dir/sources/portrait-background.png";
$sprite=imagecreatefrompng($reference);
adventureKeyedCutout($sprite,'portrait-identity',false,'red');
$rect=[0,0,(int)round(imagesx($sprite)/8),(int)round(imagesy($sprite)/4)];
$cell=adventurePreparedSpriteCell($sprite,$rect,['cleanFragments'=>.015]);
[$x,$y,$w,$h]=adventureVisibleBounds($cell,[0,0,imagesx($cell),imagesy($cell)],'portrait');
$bg=imagecreatefrompng($background);$out=imagecreatetruecolor(240,320);
imagecopyresampled($out,$bg,0,0,0,0,240,320,imagesx($bg),imagesy($bg));
// One scale preserves head/body/hat proportions. No pose deformation, recolouring or filter.
$scale=min(192/$w,264/$h);$dw=(int)round($w*$scale);$dh=(int)round($h*$scale);
$dx=(int)round((240-$dw)/2);$dy=286-$dh;
imagealphablending($out,true);
for($i=15;$i>0;$i--)imagefilledellipse($out,120,285,(int)round($dw*.72)+$i*2,6+$i,imagecolorallocatealpha($out,29,37,22,124));
imagecopyresampled($out,$cell,$dx,$dy,$x,$y,$dw,$dh,$w,$h);
if(!is_dir("$dir/review"))mkdir("$dir/review",0775,true);
imagepng($out,"$dir/review/portrait.png",9);
$record=['variant'=>$profile['id'],'identity'=>$profile['source'],'identitySha256'=>hash_file('sha256',$reference),
 'portraitSha256'=>hash_file('sha256',"$dir/review/portrait.png"),
 'backgroundSha256'=>hash_file('sha256',$background),'promptSha256'=>hash_file('sha256',"$dir/prompts/portrait-background.txt"),
 'sourceRect'=>$rect,'ink'=>[$x,$y,$w,$h],'scale'=>$scale,'destination'=>[$dx,$dy,$dw,$dh],
 'size'=>[240,320],'method'=>'Original idle pixels + individually generated illustrated background; no identity regeneration.'];
file_put_contents("$dir/review/portrait.json",json_encode($record,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES)."\n");
echo "$key: original {$profile['source']} composited into 240x320 portrait.\n";
