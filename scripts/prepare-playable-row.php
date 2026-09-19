<?php
declare(strict_types=1);
/** Authoring only. Eight immutable bodies + measured grips + synchronized illustrated oars. */
require_once __DIR__.'/lib/adventure-actor-registration.php';
$root=dirname(__DIR__);$key=getopt('', ['character:'])['character']??'';
if(!preg_match('/^[a-z]+-[a-z]+$/D',$key))throw new RuntimeException('Use --character=profile-key');
$dir="$root/data/aventura/art/playable-cast/$key";
$config=json_decode(file_get_contents("$dir/authoring.json"),true,512,JSON_THROW_ON_ERROR);
$settings=$config['actions']['row'];
$source=imagecreatefrompng("$dir/sources/{$settings['source']}.png");
adventureKeyedCutout($source,'seated',false,'red');
$wood=imagecreatefrompng("$root/data/aventura/art/brezo-repair/review/paddle-cutout.png");
$reference=json_decode(file_get_contents("$root/data/aventura/art/brezo-repair/review/row-rig-source.json"),true,512,JSON_THROW_ON_ERROR);
$directions=['down','down-right','right','up-right','up','up-left','left','down-left'];
$far=['down-right'=>1,'right'=>1,'up-right'=>1,'up-left'=>0,'left'=>0,'down-left'=>0];
function rowCanvas(int $w,int $h):GdImage {
 $im=imagecreatetruecolor($w,$h);imagealphablending($im,false);imagesavealpha($im,true);
 imagefill($im,0,0,imagecolorallocatealpha($im,0,0,0,127));return $im;
}
function rowPaddle(GdImage $dst,GdImage $texture,array $grip,array $tip,float $radius):void {
 [$gx,$gy]=$grip;[$tx,$ty]=$tip;$length=hypot($tx-$gx,$ty-$gy);$ux=($tx-$gx)/$length;$uy=($ty-$gy)/$length;
 for($y=max(0,(int)floor(min($gy,$ty)-$radius));$y<min(384,ceil(max($gy,$ty)+$radius));$y++)
 for($x=max(0,(int)floor(min($gx,$tx)-$radius));$x<min(384,ceil(max($gx,$tx)+$radius));$x++) {
  $a=(($x-$gx)*$ux+($y-$gy)*$uy)/$length;$b=-($x-$gx)*$uy+($y-$gy)*$ux;
  if($a<0||$a>1||abs($b)>$radius)continue;
  $color=imagecolorat($texture,(int)round(32+$b*30/$radius),min(159,(int)round($a*159)));
  if(($color>>24&127)<127)imagesetpixel($dst,$x,$y,$color);
 }
}
$full=rowCanvas(3072,1536);$strip=rowCanvas(3072,384);$coverage=rowCanvas(3072,1536);$rig=[];$masks=[];
[$cols,$rows]=$settings['grid'];$scale=256/(imagesx($source)/$cols)*($settings['scale']??1);
// Match the approved physical stroke, not the arbitrary dimensions of a generation.
$stroke=256/280;
foreach($directions as $c=>$direction) {
 $sx=(int)round(($c%$cols)*imagesx($source)/$cols);$sy=(int)round(intdiv($c,$cols)*imagesy($source)/$rows);
 $sw=(int)round(($c%$cols+1)*imagesx($source)/$cols)-$sx;
 $sh=(int)round((intdiv($c,$cols)+1)*imagesy($source)/$rows)-$sy;
 $cell=adventurePreparedSpriteCell($source,[$sx,$sy,$sw,$sh],['cleanFragments'=>.015]);
 [$seatX,$seatY]=$config['row']['seats'][$c];$dx=192-(int)round($seatX*$scale);$dy=270-(int)round($seatY*$scale);
 $body=rowCanvas(384,384);
 imagecopyresampled($body,$cell,$dx,$dy,0,0,(int)round($sw*$scale),(int)round($sh*$scale),$sw,$sh);
 imagecopy($strip,$body,$c*384,0,0,0,384,384);
 $grips=array_map(fn($p)=>[$dx+$p[0]*$scale,$dy+$p[1]*$scale],$config['row']['grips'][$c]);
 // A compact measured silhouette guards actual anatomy, not a guessed head rectangle.
 [$bx,$by,$bw,$bh]=adventureVisibleBounds($body,[0,0,384,384],"row/$direction");
 $left=[];$right=[];$bands=10;
 for($band=0;$band<$bands;$band++) {
  $y0=$by+(int)floor($bh*$band/$bands);$y1=$by+(int)ceil($bh*($band+1)/$bands);
  $lo=384;$hi=-1;
  for($y=$y0;$y<$y1;$y++)for($x=$bx;$x<$bx+$bw;$x++)if((imagecolorat($body,$x,$y)>>24&127)<110){$lo=min($lo,$x);$hi=max($hi,$x);}
  if($hi<0)continue;$yy=$band===0?$y0:($band===$bands-1?$y1:($y0+$y1)/2);
  $left[]=[$lo-2-192,$yy-270];$right[]=[$hi+2-192,$yy-270];
 }
 $masks[$direction]=array_merge($left,array_reverse($right));
 for($phase=0;$phase<4;$phase++) {
  $sprite=rowCanvas(384,384);$layers=[];$points=[];
  foreach([0,1] as $i) {
   $ref=$reference[$direction][$phase][$i];$tip=[192+$ref[2]*$stroke,270+$ref[3]*$stroke];$radius=$ref[4]*$stroke;
   $layers[$i]=rowCanvas(384,384);
   $hidden=in_array($direction,['up-right','up-left'],true)&&in_array($phase,[0,3],true)&&$i===$far[$direction];
   if(!$hidden)rowPaddle($layers[$i],$wood,$grips[$i],$tip,$radius);
   $points[]=[$grips[$i][0]-192,$grips[$i][1]-270,$tip[0]-192,$tip[1]-270,$radius,hypot($tip[0]-$grips[$i][0],$tip[1]-$grips[$i][1])*.44];
   imagealphablending($coverage,true);imagecopy($coverage,$layers[$i],$c*384,$phase*384,0,0,384,384);
  }
  imagealphablending($sprite,true);
  foreach([0,1] as $i)if($direction==='up'||$i===($far[$direction]??null))imagecopy($sprite,$layers[$i],0,0,0,0,384,384);
  imagecopy($sprite,$body,0,0,0,0,384,384);
  foreach([0,1] as $i)if($direction!=='up'&&$i!==($far[$direction]??null))imagecopy($sprite,$layers[$i],0,0,0,0,384,384);
  imagealphablending($sprite,false);
  foreach($grips as [$gx,$gy])for($y=(int)$gy-9;$y<$gy+8;$y++)for($x=(int)$gx-10;$x<$gx+10;$x++) {
   $color=imagecolorat($body,$x,$y);if(($color>>24&127)<110)imagesetpixel($sprite,$x,$y,$color);
  }
  imagecopy($full,$sprite,$c*384,$phase*384,0,0,384,384);$rig[$direction][$phase]=$points;
 }
}
foreach(['row'=>$full,'row-fixed-bodies'=>$strip,'row-oar-coverage'=>$coverage] as $name=>$im)imagepng($im,"$dir/review/$name.png",9);
foreach(['row-rig-source'=>$rig,'row-body-source'=>$masks] as $name=>$value)
 file_put_contents("$dir/review/$name.json",json_encode($value,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES)."\n");
echo "$key: eight fixed bodies, 32 synchronized rowing cells; review measured grips before accepting.\n";
