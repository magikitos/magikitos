<?php
declare(strict_types=1);
/** Local study exports. Source art is preserved; no game pack or workspace is written. */
require_once dirname(__DIR__, 4) . '/scripts/lib/adventure-cutout.php';
$out = $argv[1] ?? throw new RuntimeException('Missing Studio output');
if (!is_dir($out)) mkdir($out, 0755, true);
$catalog = json_decode(file_get_contents(__DIR__.'/catalog.json'), true, flags: JSON_THROW_ON_ERROR);
$manifest = ['density'=>2, 'logicalHeight'=>$catalog['logicalHeight'], 'designs'=>[]];
foreach ($catalog['designs'] as $design) {
    $id = $design['id'];
    $source = imagecreatefrompng(__DIR__.'/sources/'.$id.'-matte.png');
    $key = adventureKeyedCutout($source, $id);
    $w = imagesx($source); $h = imagesy($source);
    // Find an empty gutter near each third, never slice through a hat or ear.
    $cuts = [0];
    for ($part=1; $part<3; $part++) {
        $target = (int) round($w*$part/3); $best = null;
        for ($x=max(1,$target-110); $x<min($w-1,$target+110); $x++) {
            $empty = true;
            for ($y=0; $y<$h; $y++) if (((imagecolorat($source,$x,$y)>>24)&127)<100) { $empty=false; break; }
            if ($empty && ($best===null || abs($x-$target)<abs($best-$target))) $best=$x;
        }
        if ($best===null) throw new RuntimeException('No clear gutter: '.$id);
        $cuts[]=$best;
    }
    $cuts[]=$w;
    $entry = ['roles'=>[], 'matteCoverage'=>$key['alpha']];
    foreach ($design['roles'] as $i=>$role) {
        [$x,$y,$cw,$ch] = adventureVisibleBounds($source,[$cuts[$i],0,$cuts[$i+1]-$cuts[$i],$h],$id.'-'.$role);
        $asset = ['crop'=>[$x,$y,$cw,$ch], 'variants'=>[]];
        foreach (['portrait'=>400, 'sprite'=>80] as $kind=>$height) {
            $width = (int) round($height*$cw/$ch);
            $image = adventureClearCanvas($width,$height);
            imagecopyresampled($image,$source,0,0,$x,$y,$width,$height,$cw,$ch);
            if ($kind==='sprite') {
                $clear=imagecolorallocatealpha($image,0,0,0,127);
                for ($py=0;$py<$height;$py++) for ($px=0;$px<$width;$px++) {
                    $c=imagecolorat($image,$px,$py);
                    imagesetpixel($image,$px,$py,(($c>>24)&127)>37 ? $clear : ($c&0x00f8f8f8));
                }
            }
            $file=$id.'-'.$role.'-'.$kind.'.png';
            imagepng($image,$out.'/'.$file,9);
            $asset['variants'][$kind]=['image'=>$file,'width'=>$width,'height'=>$height,'bytes'=>filesize($out.'/'.$file),'rgbaBytes'=>$width*$height*4];
        }
        $entry['roles'][$role]=$asset;
    }
    $manifest['designs'][$id]=$entry;
}
file_put_contents($out.'/manifest.json',json_encode($manifest,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR)."\n");
echo "Duende study: 4 families, 12 figures; isolated 2x integrated exports.\n";
