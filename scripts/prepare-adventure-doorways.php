<?php
declare(strict_types=1);
/** Alpha-only recovery of reviewed door editions; immutable masters and reference art stay untouched. */
require_once __DIR__.'/lib/adventure-cutout.php';
$root=dirname(__DIR__);
$catalog=json_decode(file_get_contents($root.'/data/aventura/art/doorways/catalog.json'),true,512,JSON_THROW_ON_ERROR);
foreach ($catalog['assets'] as $asset) {
    $source=imagecreatefrompng($root.'/'.$asset['source']);
    $reference=imagecreatefrompng($root.'/'.$asset['reference']);
    imagepalettetotruecolor($source);
    imagealphablending($source,false); imagesavealpha($source,true);
    $w=imagesx($source); $h=imagesy($source);
    $rw=imagesx($reference); $rh=imagesy($reference);
    if ($w*$h>16000000) throw new RuntimeException('Unreasonably large source');
    $neutral=str_repeat("\0",$w*$h); $removed=$neutral;
    $queue=new SplQueue();
    // Only neutral checkerboard is eligible. White petals, stone and iron inside the
    // original silhouette are protected unless connected to the exterior matte.
    for ($y=0;$y<$h;$y++) for ($x=0;$x<$w;$x++) {
        $pixel=imagecolorat($source,$x,$y);
        $r=($pixel>>16)&255; $g=($pixel>>8)&255; $b=$pixel&255;
        if (min($r,$g,$b)<90 || max($r,$g,$b)-min($r,$g,$b)>12) continue;
        $i=$y*$w+$x; $neutral[$i]="\1";
        $ref=imagecolorat($reference,min($rw-1,(int)($x*$rw/$w)),min($rh-1,(int)($y*$rh/$h)));
        if ($x===0 || $y===0 || $x===$w-1 || $y===$h-1 || (($ref>>24)&127)>100) {
            $removed[$i]="\1"; $queue->enqueue($i);
        }
    }
    while (!$queue->isEmpty()) {
        $i=$queue->dequeue(); $x=$i%$w;
        foreach ([$x>0?$i-1:-1,$x<$w-1?$i+1:-1,$i-$w,$i+$w] as $j) {
            if ($j<0 || $j>=$w*$h || $neutral[$j]!=="\1" || $removed[$j]==="\1") continue;
            $removed[$j]="\1"; $queue->enqueue($j);
        }
    }
    for ($y=0;$y<$h;$y++) for ($x=0;$x<$w;$x++) if ($removed[$y*$w+$x]==="\1")
        imagesetpixel($source,$x,$y,imagecolorat($source,$x,$y)|0x7f000000);
    $report=adventureKeyedCutout($source,$asset['id']);
    $file=$root.'/'.$asset['cutout'];
    if (!is_dir(dirname($file))) mkdir(dirname($file),0775,true);
    $temporary=tempnam(dirname($file),'.door-');
    try {
        if (!imagepng($source,$temporary,9) || !rename($temporary,$file)) throw new RuntimeException('Could not save doorway');
    } finally { if(is_file($temporary)) unlink($temporary); }
    file_put_contents(substr($file,0,-4).'.json',json_encode([
        'sourceHash'=>hash_file('sha256',$root.'/'.$asset['source']),
        'referenceHash'=>hash_file('sha256',$root.'/'.$asset['reference']),
        'report'=>$report,
    ],JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES)."\n");
    echo $asset['id'].': alpha '.$report['alpha']."\n";
}
