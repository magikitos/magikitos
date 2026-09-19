<?php
declare(strict_types=1);
/** Art-only review packs: use the real registration/reduction without publishing a character. */
require_once __DIR__.'/lib/adventure-actor-registration.php';
$root=dirname(__DIR__);$key=getopt('', ['character:'])['character']??'';
if(!preg_match('/^[a-z]+-[a-z]+$/D',$key))throw new RuntimeException('Use --character=profile-key');
$dir="$root/data/aventura/art/playable-cast/$key";
$config=json_decode(file_get_contents("$dir/authoring.json"),true,512,JSON_THROW_ON_ERROR);
$catalog=json_decode(file_get_contents("$root/data/aventura/art/residents/catalog.json"),true,512,JSON_THROW_ON_ERROR);
$actions=json_decode(file_get_contents("$root/data/aventura/art/residents/actions/catalog.json"),true,512,JSON_THROW_ON_ERROR)['actions'];
$actions=['walk'=>['grid'=>[8,4],'directions'=>$catalog['directions']]]+$actions;
$cw=216;$ch=208;
$reference=null;$report=['variant'=>$config['variant'],'key'=>$key,'packs'=>[],'actions'=>[]];
$comparison=adventureClearCanvas(8*$cw,8*$ch);imagealphablending($comparison,true);
imagefilledrectangle($comparison,0,0,8*$cw-1,8*$ch-1,imagecolorallocate($comparison,76,102,73));
$comparisonRow=0;
foreach($actions as $action=>$spec) {
 $source=imagecreatefrompng("$dir/review/$action.png");adventureKeyedCutout($source,"$key/$action",false,'red');
 $sheet=$spec+['id'=>"$key-$action",'variant'=>$config['variant'],'action'=>$action,'height'=>40,'sourceCellWidth'=>384,'strictMargins'=>true,'cleanFragments'=>.015];
 if($action!=='walk')$sheet['reference']='walk';
 if(($sheet['directions']??null)==='eight')$sheet['directions']=$catalog['directions'];
 if(isset($sheet['names']))$sheet['names']=array_map(fn($name)=>"person-{$config['variant']}-$name",$sheet['names']);
 if($action==='row')$sheet['sourceSeatAnchors']=array_fill(0,4,array_fill(0,8,[192,270]));
 [$cells,$bounds]=adventureActorCells($source,$sheet);
 $registered=adventureRegisterActor($sheet,$catalog,$cells,$bounds,$reference);
 if($action==='walk')$reference=$registered['measurement'];
 [$cols,$rows]=$spec['grid'];[$w,$h]=$spec['canvas']??$catalog['canvas'];
 $atlas=adventureClearCanvas(($w*2+4)*$cols,($h*2+4)*$rows);$frames=[];$index=0;
 $contact=adventureClearCanvas($cols*$cw,$rows*$ch);imagealphablending($contact,true);
 imagefilledrectangle($contact,0,0,imagesx($contact)-1,imagesy($contact)-1,imagecolorallocate($contact,91,122,92));
 foreach($registered['frames'] as $name=>$frame) {
  $cell=adventurePreparedSpriteCell($source,adventureSourceCell($source,$frame),$frame);
  $image=adventureNativeSprite($cell,$frame,[0,0,imagesx($cell),imagesy($cell)],[]);
  $c=$index%$cols;$r=intdiv($index,$cols);$x=$c*($w*2+4)+2;$y=$r*($h*2+4)+2;
  imagecopy($atlas,$image,$x,$y,0,0,$w*2,$h*2);
  $frames[$name]=['x'=>$x,'y'=>$y,'w'=>$w,'h'=>$h,'pixelRatio'=>2,'anchor'=>$frame['anchor'],'bounds'=>[-$frame['anchor'][0],-$frame['anchor'][1],$w,$h]];
  imagecopyresized($contact,$image,$c*$cw+(int)(($cw-$w*3)/2),$r*$ch+8,0,0,$w*3,$h*3,$w*2,$h*2);
  imagestring($contact,2,$c*$cw+5,($r+1)*$ch-14,str_replace("person-{$config['variant']}-",'',$name),imagecolorallocate($contact,250,243,219));
  if($r===0) {
   imagecopyresized($comparison,$image,$c*$cw+(int)(($cw-$w*3)/2),$comparisonRow*$ch+8,0,0,$w*3,$h*3,$w*2,$h*2);
   imagestring($comparison,2,$c*$cw+5,($comparisonRow+1)*$ch-14,$action,imagecolorallocate($comparison,250,243,219));
  }
  $index++;
 }
 $filename="$action-atlas";imagepng($atlas,"$dir/review/$filename.png",9);imagepng($contact,"$dir/review/$action-contact.png",9);
 $metadata=['width'=>imagesx($atlas),'height'=>imagesy($atlas),'frames'=>$frames];
 file_put_contents("$dir/review/$filename.json",json_encode($metadata,JSON_UNESCAPED_SLASHES)."\n");
 $pack="actor-{$config['variant']}".($action==='walk'?'':"-$action");
 $report['packs'][$pack]=['image'=>"$filename.png",'metadata'=>"$filename.json",'width'=>imagesx($atlas),'height'=>imagesy($atlas),'bytes'=>filesize("$dir/review/$filename.png"),'sprites'=>array_keys($frames)];
 $report['actions'][$action]=['count'=>$index,'sourceSha256'=>hash_file('sha256',"$dir/review/$action.png")]+$registered;
 $comparisonRow++;
}
imagepng($comparison,"$dir/review/scale-comparison.png",9);
$ratio=$report['actions']['row']['measurement']['ratio'];
$scale=function($value)use(&$scale,$ratio){return is_array($value)?array_map($scale,$value):round($value*$ratio,2);};
$report['rowingRig']=$scale(json_decode(file_get_contents("$dir/review/row-rig-source.json"),true,512,JSON_THROW_ON_ERROR));
$report['rowingBody']=$scale(json_decode(file_get_contents("$dir/review/row-body-source.json"),true,512,JSON_THROW_ON_ERROR));
file_put_contents("$dir/review/review.json",json_encode($report,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES)."\n");
echo "$key: ".array_sum(array_column($report['actions'],'count'))." strictly registered frames at 2x. Review only, no catalogue/build changes.\n";
