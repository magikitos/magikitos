<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/adventure-sprite-packer.php';
$root=dirname(__DIR__);$out=$root.'/data/aventura/art/woodland-kit/references';
if(!is_dir($out))mkdir($out,0755,true);
$source=imagecreatefrompng($root.'/data/aventura/art/forest-near-trees.png');
foreach(['oak'=>[0,0,864,1024],'birch'=>[864,0,672,1024]] as $name=>[$x,$y,$w,$h]){
 $copy=adventureClearCanvas($w,$h);imagecopy($copy,$source,0,0,$x,$y,$w,$h);imagepng($copy,$out.'/'.$name.'.png');echo $name,"\n";
}
