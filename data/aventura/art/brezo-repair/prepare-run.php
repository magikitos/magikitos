<?php
declare(strict_types=1);
// Local art preparation only: preserve sources, remove matte, crop and register generated poses.
$root=dirname(__DIR__,4);
require "$root/scripts/lib/adventure-actor-registration.php";
$directory="$root/data/aventura/art/brezo-repair";
function extractPoses(string $file,int $cols,int $rows):array {
    $src=imagecreatefrompng($file); adventureKeyedCutout($src,basename($file),false,'red');
    $result=[]; $width=imagesx($src); $height=imagesy($src);
    for($c=0;$c<$cols;$c++) {
        $x0=(int)round($c*$width/$cols);$x1=(int)round(($c+1)*$width/$cols);
        $ys=[0];
        for($r=1;$r<$rows;$r++) {
            $target=$r*$height/$rows; $best=INF; $line=0;
            for($y=max(1,(int)$target-30);$y<min($height-1,(int)$target+30);$y++) {
                $ink=0;for($x=$x0;$x<$x1;$x++)if((imagecolorat($src,$x,$y)>>24&127)<100)$ink++;
                $score=$ink*1000+abs($y-$target);if($score<$best){$best=$score;$line=$y;}
            }
            $ys[]=$line;
        }
        $ys[]=$height;
        for($r=0;$r<$rows;$r++) {
            $rect=[$x0,$ys[$r],$x1-$x0,$ys[$r+1]-$ys[$r]];
            $cell=adventurePreparedSpriteCell($src,$rect,['cleanFragments'=>0.015]);
            $bounds=adventureVisibleBounds($cell,[0,0,imagesx($cell),imagesy($cell)],'pose');
            [$bx,$by,$bw,$bh]=$bounds;
            // Centre the head, not the swinging arms or boots, to avoid lateral registration jitter.
            $left=imagesx($cell);$right=0;
            for($y=$by+(int)($bh*.26);$y<$by+(int)($bh*.48);$y++)for($x=0;$x<imagesx($cell);$x++)
                if((imagecolorat($cell,$x,$y)>>24&127)<90){$left=min($left,$x);$right=max($right,$x);}
            $result[$r*$cols+$c]=['image'=>$cell,'bounds'=>$bounds,'headX'=>($left+$right)/2,'rect'=>$rect];
        }
    }
    ksort($result);return $result;
}
$full=extractPoses("$directory/sources/run-eight-01.png",8,4);
$other=extractPoses("$directory/sources/run-opposite-01.png",8,2);
$stride=extractPoses("$directory/sources/run-stride-b-01.png",4,2);
$original=imagecreatefrompng("$root/data/aventura/art/residents/sources/resident-001.png");
adventureKeyedCutout($original,'original-heads',false,'red');
$headFactors=[.505,.51,.51,.49,.47,.49,.49,.50];
$out=imagecreatetruecolor(1776,1024);imagealphablending($out,false);imagesavealpha($out,true);
imagefill($out,0,0,imagecolorallocatealpha($out,0,0,0,127));
$record=[];
for($r=0;$r<4;$r++)for($c=0;$c<8;$c++){
    if($r<2){$pose=$full[$r*8+$c];$scale=.95;$source='run-eight-01';$index=$r*8+$c;}
    elseif($r===2 && !in_array($c,[0,4],true)){$pose=$stride[$c];$scale=.455;$source='run-stride-b-01';$index=$c;}
    else{$index=($r===3?8:0)+$c;$pose=$other[$index];$scale=.71;$source='run-opposite-01';}
    [$x,$y,$w,$h]=$pose['bounds'];$dw=(int)round($w*$scale);$dh=(int)round($h*$scale);
    $dx=$c*222+111-(int)round(($pose['headX']-$x)*$scale);$dy=$r*256+234-$dh;
    imagecopyresampled($out,$pose['image'],$dx,$dy,$x,$y,$dw,$dh,$w,$h);
    // Preserve the approved identity as original pixels, rather than asking the generator
    // to reinterpret face/curls/cap for every pose. Only the generated body is animated.
    $cutY=$dy+(int)round($dh*$headFactors[$c]);
    $clear=imagecolorallocatealpha($out,0,0,0,127);
    $cx=$c*222+111;
    imagefilledpolygon($out,[$cx-68,$r*256,$cx+68,$r*256,$cx+68,$cutY-33,
        $cx+27,$cutY,$cx-27,$cutY,$cx-68,$cutY-33],$clear);
    $sx=(int)round($c*imagesx($original)/8);
    $left=222;$right=0;
    for($hy=60;$hy<100;$hy++)for($hx=0;$hx<221;$hx++)
        if((imagecolorat($original,$sx+$hx,$hy)>>24&127)<90){$left=min($left,$hx);$right=max($right,$hx);}
    $headX=$c*222+111-(int)round(($left+$right)/2);
    imagealphablending($out,true);
    imagecopy($out,$original,$headX,$cutY-114,$sx,0,221,122);
    imagealphablending($out,false);
    $record[]=['cell'=>[$c,$r],'source'=>$source,'sourceIndex'=>$index,'sourceRect'=>$pose['rect'],
        'bounds'=>$pose['bounds'],'scale'=>$scale,'destination'=>[$dx,$dy,$dw,$dh]];
}
imagepng($out,"$directory/review/brezo-alba-run-matte.png",9);
echo json_encode($record,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES),"\n";
