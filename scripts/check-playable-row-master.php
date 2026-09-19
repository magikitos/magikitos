<?php
declare(strict_types=1);
/** Exact offline invariant, separate from the visual Chrome/WebKit clipping review. */
$root=dirname(__DIR__);$key=getopt('', ['character:'])['character']??'';
if(!preg_match('/^[a-z]+-[a-z]+$/D',$key))throw new RuntimeException('Use --character=profile-key');
$dir="$root/data/aventura/art/playable-cast/$key";
$master=imagecreatefrompng("$dir/review/row.png");$body=imagecreatefrompng("$dir/review/row-fixed-bodies.png");
$coverage=imagecreatefrompng("$dir/review/row-oar-coverage.png");
function verifyBody(GdImage $master,GdImage $body,GdImage $coverage):int {
 $checked=0;
 for($r=0;$r<4;$r++)for($c=0;$c<8;$c++)for($y=0;$y<384;$y++)for($x=0;$x<384;$x++) {
  $sx=$c*384+$x;$sy=$r*384+$y;
  if((imagecolorat($coverage,$sx,$sy)>>24&127)!==127)continue;
  $before=imagecolorat($body,$sx,$y);$after=imagecolorat($master,$sx,$sy);
  if(($before>>24&127)===127&&($after>>24&127)===127)continue;
  if($before!==$after)throw new RuntimeException("Body moved outside oars: $c/$r/$x/$y");$checked++;
 }
 return $checked;
}
$checked=verifyBody($master,$body,$coverage);
$original=imagecolorat($master,192,540);imagesetpixel($master,192,540,imagecolorallocate($master,255,0,255));
$caught=false;try{verifyBody($master,$body,$coverage);}catch(RuntimeException $e){$caught=true;}
if(!$caught)throw new RuntimeException('Negative body control failed');imagesetpixel($master,192,540,$original);
$config=json_decode(file_get_contents("$dir/authoring.json"),true,512,JSON_THROW_ON_ERROR);
$qa=json_decode(file_get_contents("$root/data/aventura/art/residents/actions/cutouts/$key-row-master.json"),true,512,JSON_THROW_ON_ERROR);
$raw=json_decode(file_get_contents("$dir/review/row-rig-source.json"),true,512,JSON_THROW_ON_ERROR);
$runtime=json_decode(file_get_contents("$root/data/aventura/rowing.json"),true,512,JSON_THROW_ON_ERROR)['rigs'][$key];
foreach($raw as $direction=>$phases)foreach($phases as $phase=>$pair)foreach($pair as $i=>$point) {
 if(array_slice($point,0,2)!==array_slice($phases[0][$i],0,2))throw new RuntimeException('Grip moves between phases');
 foreach($point as $axis=>$value)if(abs($runtime[$direction][$phase][$i][$axis]-round($value*$qa['measurement']['ratio'],2))>.001)
  throw new RuntimeException("Clipping does not match the drawn paddle: $direction/$phase/$i/$axis");
}
echo "PASS $key: $checked exact fixed-body pixels; immobile grips, measured rig and negative control.\n";
