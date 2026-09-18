<?php
declare(strict_types=1);
/** Offline QA contact sheets at game scale. No source images are changed. */
$root=dirname(__DIR__);
$manifest=json_decode(file_get_contents("$root/public/assets/aventura/manifest.json"),true,512,JSON_THROW_ON_ERROR);
$frames=$images=[];
foreach ($manifest['packs'] as $id=>$pack) {
    if (!in_array($id,['actor-0','actor-0-run','actor-12','picnic-neighbor'],true)) continue;
    $images[$id]=imagecreatefrompng("$root/public/assets/aventura/{$pack['image']}");
    foreach (json_decode(file_get_contents("$root/public/assets/aventura/{$pack['metadata']}"),true)['frames'] as $name=>$frame)
        $frames[$name]=[$id,$frame];
}
$directions=['down','down-right','right','up-right','up','up-left','left','down-left'];
$out="$root/.local/mobility-review";
if (!is_dir($out)) mkdir($out,0755,true);
foreach (['ascua'=>['','-run-0','-run-1','-run-2','-run-3'],
    'brizno'=>['','-walk-1','-walk-2','-walk-3','-sit-0','-sit-1','-sit-2','-sit-3']] as $id=>$poses) {
    $image=imagecreatetruecolor(1280,count($poses)*130);
    imagefill($image,0,0,imagecolorallocate($image,112,140,83));
    $ink=imagecolorallocate($image,249,237,201);
    foreach ($poses as $row=>$pose) foreach ($directions as $column=>$direction) {
        $name='person-'.($id==='ascua'?0:12).'-'.$direction.$pose;
        [$pack,$f]=$frames[$name];
        $x=$column*160+80;$y=$row*130+103;
        imagecopyresized($image,$images[$pack],$x-$f['anchor'][0]*2,$y-$f['anchor'][1]*2,$f['x'],$f['y'],
            $f['w']*2,$f['h']*2,$f['w']*$f['pixelRatio'],$f['h']*$f['pixelRatio']);
        imagestring($image,2,$column*160+6,$row*130+112,$direction.($pose?:' idle'),$ink);
    }
    imagepng($image,"$out/$id-poses.png");
    echo "$out/$id-poses.png\n";
}
