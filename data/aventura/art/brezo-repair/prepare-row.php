<?php
declare(strict_types=1);
$root=dirname(__DIR__,4);
require "$root/scripts/lib/adventure-actor-registration.php";
$dir="$root/data/aventura/art/brezo-repair";
if(!is_dir("$dir/review"))mkdir("$dir/review",0775,true);
function canvas(int $w,int $h):GdImage {
    $im=imagecreatetruecolor($w,$h);imagealphablending($im,false);imagesavealpha($im,true);
    imagefill($im,0,0,imagecolorallocatealpha($im,0,0,0,127));return $im;
}
$identity=imagecreatefrompng("$root/data/aventura/art/residents/sources/resident-001.png");adventureKeyedCutout($identity,'identity',false,'red');
function originalHead(GdImage $dst,GdImage $identity,int $direction,float $cx,float $cut,float $scale):void {
    $clear=imagecolorallocatealpha($dst,0,0,0,127);
    imagealphablending($dst,false);
    imagefilledrectangle($dst,0,0,imagesx($dst)-1,(int)$cut,$clear);
    $sx=(int)round($direction*imagesx($identity)/8);$left=222;$right=0;
    for($y=60;$y<100;$y++)for($x=0;$x<221;$x++)if((imagecolorat($identity,$sx+$x,$y)>>24&127)<90){$left=min($left,$x);$right=max($right,$x);}
    imagealphablending($dst,true);
    imagecopyresampled($dst,$identity,(int)round($cx-($left+$right)/2*$scale),(int)round($cut-114*$scale),$sx,0,
        (int)round(221*$scale),(int)round(122*$scale),221,122);
    imagealphablending($dst,false);
}
$body=imagecreatefrompng("$dir/sources/row-empty-hands.png");adventureKeyedCutout($body,'row-body',false,'red');
$wood=imagecreatefrompng("$dir/sources/row-paddle.png");adventureKeyedCutout($wood,'row-wood',false,'red');
// Crop the supplied standalone illustrated oar below its grip cap (hidden inside the fist).
[$wx,$wy,$ww,$wh]=adventureVisibleBounds($wood,[0,0,imagesx($wood),imagesy($wood)],'oar');
$paddle=canvas(64,160);
imagecopyresampled($paddle,$wood,2,0,$wx,$wy+110,60,160,$ww,$wh-110);
imagepng($paddle,"$dir/review/paddle-cutout.png",9);
function paddle(GdImage $dst,GdImage $p,array $grip,array $tip,float $width):void {
    [$gx,$gy]=$grip;[$tx,$ty]=$tip;$len=hypot($tx-$gx,$ty-$gy);$ux=($tx-$gx)/$len;$uy=($ty-$gy)/$len;
    for($y=max(0,(int)floor(min($gy,$ty)-$width));$y<min(imagesy($dst),ceil(max($gy,$ty)+$width));$y++)
    for($x=max(0,(int)floor(min($gx,$tx)-$width));$x<min(imagesx($dst),ceil(max($gx,$tx)+$width));$x++) {
        $along=(($x-$gx)*$ux+($y-$gy)*$uy)/$len;
        $across=-(($x-$gx)*$uy)+($y-$gy)*$ux;
        if($along<0||$along>1||abs($across)>$width)continue;
        $color=imagecolorat($p,(int)round(32+$across*30/$width),min(159,(int)round($along*159)));
        if(($color>>24&127)<127)imagesetpixel($dst,$x,$y,$color);
    }
}
$tips=[
    // Each pair is a single synchronized stroke, in seat-relative source pixels.
    'right'=>[[[146,74],[146,-91]],[[112,88],[112,-105]],[[-143,58],[-143,-91]],[[135,45],[135,-112]]],
    'up-right'=>[[[151,48],[78,-136]],[[132,90],[-101,-119]],[[-34,93],[-157,-38]],[[130,30],[72,-149]]],
];
$directions=['down','down-right','right','up-right','up','up-left','left','down-left'];
$sideDirections=['right','up-right','up-left','left'];
$bodies=[];$gripsByDirection=[];$endsByDirection=[];$widthsByDirection=[];
$seatXs=[149,151,163,173];
$handOffsets=[
    [[3,-50],[47,-61]], [[57,-51],[24,-67]],
    [[-55,-51],[-24,-67]], [[-6,-50],[-48,-61]]
];
// One immutable body and two immutable grips per heading. The phase is deliberately
// absent from this loop: neither anatomy nor head registration may animate.
foreach($sideDirections as $c=>$direction) {
    $xs=[0,314,627,941,1254];
    $rect=[$xs[$c],0,$xs[$c+1]-$xs[$c],315];
    $cell=adventurePreparedSpriteCell($body,$rect,['cleanFragments'=>.015]);
    [$bx,$by,$bw,$bh]=adventureVisibleBounds($cell,[0,0,imagesx($cell),imagesy($cell)],'body');
    $seat=[$seatXs[$c],$by+$bh-24];$ox=192-$seat[0];$oy=270-$seat[1];
    $identityDirections=[2,3,5,6];$headOffsets=[5,9,-17,-18];
    originalHead($cell,$identity,$identityDirections[$c],$seat[0]+$headOffsets[$c],$by+$bh*.555,280/221.75);
    $fixed=canvas(384,384);imagecopy($fixed,$cell,$ox,$oy,0,0,imagesx($cell),imagesy($cell));
    $bodies[$direction]=$fixed;
    $key=$c===0||$c===3?'right':'up-right';$mirror=$c>1?-1:1;
    $grips=$handOffsets[$c];$widths=[23,17];
    // Runtime ordering is left/right, not near/far.
    $gripsByDirection[$direction]=$c>1?array_reverse($grips):$grips;
    $widthsByDirection[$direction]=$c>1?array_reverse($widths):$widths;
    foreach($tips[$key] as $r=>$pair) {
        $ends=array_map(fn($p)=>[$mirror*$p[0],$p[1]],$pair);
        $endsByDirection[$direction][$r]=$c>1?array_reverse($ends):$ends;
    }
}
$base=imagecreatefrompng("$dir/sources/row-matte-base-01.png");adventureKeyedCutout($base,'row-base',false,'red');
$catalog=json_decode(file_get_contents("$root/data/aventura/art/residents/actions/catalog.json"),true);
$old=null;foreach(array_merge($catalog['sheets'],$catalog['rejectedSheets']) as $sheet)if($sheet['id']==='brezo-alba-row-long-clean')$old=$sheet;
$baseScale=280/221.75;
// Authoring-only silhouettes separate the already approved phase-0 bodies from
// their baked paddles. These paths never ship to the renderer. No body is redrawn.
$silhouettes=[
    'down'=>[[0,0],[383,0],[383,214],[250,214],[249,232],[244,241],[236,245],[238,309],[151,309],[151,260],[155,249],[147,242],[144,237],[143,221],[0,214]],
    'down-right'=>[[0,0],[383,0],[383,214],[255,214],[262,233],[252,240],[242,241],[251,285],[238,306],[169,302],[157,270],[166,252],[178,245],[176,241],[166,236],[157,237],[157,221],[0,214]],
    'up'=>[[0,0],[383,0],[383,207],[245,207],[239,222],[240,236],[235,239],[236,253],[225,264],[232,306],[151,306],[150,267],[146,258],[143,249],[143,236],[141,230],[145,217],[136,208],[0,207]],
    'down-left'=>[[0,0],[383,0],[383,215],[230,215],[231,235],[225,242],[218,245],[217,265],[205,297],[177,309],[134,303],[138,252],[138,244],[126,241],[119,236],[120,219],[0,214]],
];
$baseGrips=[
    'down'=>[[-40,-37],[50,-37]], 'down-right'=>[[-13,-31],[63,-41]],
    'up'=>[[-44,-42],[45,-43]], 'down-left'=>[[-65,-38],[32,-35]],
];
// Synchronized fore/aft trajectories; a single pair of grips for the entire cycle.
$baseTips=[
    'down'=>[[[-135,32],[135,26]],[[-135,58],[129,58]],[[-132,55],[132,51]],[[-135,3],[135,3]]],
    'down-right'=>[[[-109,32],[138,10]],[[-113,61],[138,51]],[[-106,58],[142,51]],[[-109,16],[138,-6]]],
    'up'=>[[[-119,13],[129,13]],[[-119,64],[129,64]],[[-119,58],[122,58]],[[-119,-3],[122,-6]]],
    'down-left'=>[[[-142,23],[125,29]],[[-138,58],[129,58]],[[-142,55],[122,55]],[[-142,6],[129,6]]],
];
foreach($directions as $c=>$direction) {
    if(isset($bodies[$direction]))continue;
    $rect=$old['sourceRects'][0][$c];$seat=$old['sourceSeatAnchors'][0][$c];
    $seat[1]+=$rect[1];$rect[1]=0;$rect[3]=260;
    $cell=adventurePreparedSpriteCell($base,$rect,['cleanFragments'=>.015]);
    [$bx,$by,$bw,$bh]=adventureVisibleBounds($cell,[0,0,imagesx($cell),imagesy($cell)],'base');
    $headOffsets=[0=>4,1=>4,4=>0,7=>-12];
    originalHead($cell,$identity,$c,$seat[0]+$headOffsets[$c],$by+104,1);
    $fixed=canvas(384,384);
    imagecopyresampled($fixed,$cell,192-(int)round($seat[0]*$baseScale),270-(int)round($seat[1]*$baseScale),
        0,0,(int)round($rect[2]*$baseScale),(int)round($rect[3]*$baseScale),$rect[2],$rect[3]);
    $mask=canvas(384,384);$white=imagecolorallocate($mask,255,255,255);
    imagefilledpolygon($mask,array_merge(...$silhouettes[$direction]),$white);
    $clear=imagecolorallocatealpha($fixed,0,0,0,127);
    for($y=0;$y<384;$y++)for($x=0;$x<384;$x++)
        if((imagecolorat($mask,$x,$y)>>24&127)===127)imagesetpixel($fixed,$x,$y,$clear);
    $bodies[$direction]=$fixed;$gripsByDirection[$direction]=$baseGrips[$direction];
    $endsByDirection[$direction]=$baseTips[$direction];$widthsByDirection[$direction]=[21,21];
}
$full=canvas(3072,1536);$bodyStrip=canvas(3072,384);$coverage=canvas(3072,1536);$meta=[];
$farIndices=['right'=>1,'up-right'=>1,'down-right'=>1,'left'=>0,'up-left'=>0,'down-left'=>0];
foreach($directions as $c=>$direction) {
    $fixed=$bodies[$direction];imagecopy($bodyStrip,$fixed,$c*384,0,0,0,384,384);
    $grips=array_map(fn($p)=>[$p[0]+192,$p[1]+270],$gripsByDirection[$direction]);
    for($r=0;$r<4;$r++) {
        $sprite=canvas(384,384);$oarLayers=[];$points=[];
        $ends=array_map(fn($p)=>[$p[0]+192,$p[1]+270],$endsByDirection[$direction][$r]);
        foreach([0,1] as $i) {
            $oarLayers[$i]=canvas(384,384);$width=$widthsByDirection[$direction][$i];
            $hidden=in_array($direction,['up-right','up-left'],true) && in_array($r,[0,3],true) && $i===$farIndices[$direction];
            if(!$hidden)paddle($oarLayers[$i],$paddle,$grips[$i],$ends[$i],$width);
            $points[]=[$grips[$i][0]-192,$grips[$i][1]-270,$ends[$i][0]-192,$ends[$i][1]-270,$width,hypot($ends[$i][0]-$grips[$i][0],$ends[$i][1]-$grips[$i][1])*.44];
            imagealphablending($coverage,true);
            imagecopy($coverage,$oarLayers[$i],$c*384,$r*384,0,0,384,384);
        }
        imagealphablending($sprite,true);
        foreach([0,1] as $i)if($direction==='up'||$i===($farIndices[$direction]??null))imagecopy($sprite,$oarLayers[$i],0,0,0,0,384,384);
        imagecopy($sprite,$fixed,0,0,0,0,384,384);
        foreach([0,1] as $i)if($direction!=='up'&&$i!==($farIndices[$direction]??null))imagecopy($sprite,$oarLayers[$i],0,0,0,0,384,384);
        imagealphablending($sprite,false);
        // Keep the same original fingers on top of each fixed handle pivot.
        foreach($grips as [$hx,$hy])for($y=(int)$hy-14;$y<$hy+10;$y++)for($x=(int)$hx-13;$x<$hx+13;$x++) {
            $color=imagecolorat($fixed,$x,$y);
            if(($color>>24&127)<110)imagesetpixel($sprite,$x,$y,$color);
        }
        imagecopy($full,$sprite,$c*384,$r*384,0,0,384,384);
        $meta[$direction][$r]=$points;
    }
}
imagepng($bodyStrip,"$dir/review/row-fixed-bodies.png",9);
imagepng($coverage,"$dir/review/row-oar-coverage.png",9);
imagepng($full,"$dir/review/brezo-alba-row-matte.png",9);
file_put_contents("$dir/review/row-rig-source.json",json_encode($meta,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES)."\n");
echo json_encode($meta,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES),"\n";
