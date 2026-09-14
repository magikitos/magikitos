<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$out=$argv[1]??$root.'/.local/adventure-studio/experiments/definition-motion/art';
$reference=json_decode(file_get_contents($root.'/tools/adventure-studio/experiments/definition-motion/reference.json'),true,flags:JSON_THROW_ON_ERROR);
function verify(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);}
foreach($reference['files'] as $file=>$sha)
    verify(hash_file('sha256',$out.'/'.$file)===$sha,'Original archived bytes: '.$file);
$study=json_decode(file_get_contents($out.'/manifest.json'),true,flags:JSON_THROW_ON_ERROR);
foreach($study['assets'] as $name=>$asset){
 $f=$asset['logical'];
 foreach($asset['variants'] as $profile=>$v){
  verify($v['width']===$f['w']*$v['density']&&$v['height']===$f['h']*$v['density'],'Density does not alter world bounds');
  verify($v['rgbaBytes']===$v['width']*$v['height']*4,'RGBA estimate');
  verify($v['bytes']===filesize($out.'/'.$v['image']),'Actual PNG bytes');
  if(!empty($asset['fixed']))verify($v['image']===$asset['variants']['1-nearest']['image'],'Reference actors stay fixed');
 }
}
echo "PASS archived study: immutable measured baseline, invariant profile geometry, fixed actors and actual bytes.\n";
