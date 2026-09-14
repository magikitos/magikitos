<?php
declare(strict_types=1);
require __DIR__.'/lib/adventure-cutout.php';
function check(bool $ok,string $message): void { if (!$ok) throw new RuntimeException($message); }
$im=imagecreatetruecolor(40,40);imagealphablending($im,false);imagesavealpha($im,true);
$matte=imagecolorallocate($im,255,0,255);$gold=imagecolorallocate($im,170,122,40);
$purple=imagecolorallocate($im,130,90,180);$transparent=imagecolorallocatealpha($im,0,0,0,127);
imagefill($im,0,0,$matte);imagefilledrectangle($im,10,10,29,29,$gold);
imagesetpixel($im,20,20,$matte);imagesetpixel($im,15,15,$purple);imagesetpixel($im,0,0,$transparent);
$result=adventureKeyedCutout($im,'synthetic');
check($result['bounds']===[10,10,20,20],'Exact silhouette bounds');
check((imagecolorat($im,20,20)>>24)===127,'Internal gaps removed');
check(imagecolorat($im,15,15)===$purple,'Internal violet is preserved');
check(imagecolorat($im,11,11)===$gold,'Original colour is unchanged');
check((imagecolorat($im,0,0)>>24)===127,'Existing transparency preserved');
$bad=imagecreatetruecolor(40,40);imagefill($bad,0,0,$gold);
try {adventureKeyedCutout($bad,'missing-matte');throw new LogicException('Invalid master was accepted');}
catch(RuntimeException $e) { check(str_contains($e->getMessage(),'coverage'),'Reject ambiguous masters'); }
$edge=imagecreatetruecolor(40,40);imagefill($edge,0,0,$matte);imagefilledrectangle($edge,0,10,25,30,$gold);
try {adventureKeyedCutout($edge,'clipped');throw new LogicException('Clipped master was accepted');}
catch(RuntimeException $e) {check(str_contains($e->getMessage(),'edge'),'Reject clipped sprites');}
echo "PASS: cutout alpha, holes, colour invariants, silhouette margins and invalid matte rejection.\n";
