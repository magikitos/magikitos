<?php
declare(strict_types=1);
/** Authoring only: normalize approved generated cells, never fit each pose by its height. */
require_once __DIR__.'/lib/adventure-actor-registration.php';
$root=dirname(__DIR__);
$key=getopt('', ['character:'])['character']??'';
if(!preg_match('/^[a-z]+-[a-z]+$/D',$key))throw new RuntimeException('Use --character=profile-key');
$dir="$root/data/aventura/art/playable-cast/$key";
if(!is_dir("$dir/review"))mkdir("$dir/review",0775,true);
$config=json_decode(file_get_contents("$dir/authoring.json"),true,512,JSON_THROW_ON_ERROR);
$specs=json_decode(file_get_contents("$root/data/aventura/art/residents/actions/catalog.json"),true,512,JSON_THROW_ON_ERROR)['actions'];
// New approved designs may need a separately reviewed walking layout. This remains
// offline authoring and never modifies their original candidate or NPC catalogue.
$selected=$config['actions'];
if(isset($config['walk'])) {
    $specs['walk']=['grid'=>[8,4]];
    $selected=['walk'=>$config['walk']]+$selected;
}
function masterCanvas(int $w,int $h):GdImage {
    $im=imagecreatetruecolor($w,$h);imagealphablending($im,false);imagesavealpha($im,true);
    imagefill($im,0,0,imagecolorallocatealpha($im,0,0,0,127));return $im;
}
foreach($selected as $action=>$settings) {
    if($action==='row')continue;
    [$cols,$rows]=$specs[$action]['grid'];
    $source=imagecreatefrompng("$dir/sources/{$settings['source']}.png");
    // Explicitly reviewed complete silhouettes may have only one empty outer pixel.
    // Padding cannot repair a clipped drawing: reject any ink touching the actual edge.
    $padding=$settings['sourcePadding']??0;
    if($padding) {
        if(!is_int($padding)||$padding<1||$padding>8)throw new RuntimeException('Reviewed padding must be 1..8 pixels');
        try { adventureKeyedCutout($source,"$key/$action",false,'red'); }
        catch(RuntimeException $e) {
            if(!str_starts_with($e->getMessage(),'Art touches source edge;'))throw $e;
        }
        $w=imagesx($source);$h=imagesy($source);
        for($y=0;$y<$h;$y++)for($x=0;$x<$w;$x++) {
            if($x!==0&&$y!==0&&$x!==$w-1&&$y!==$h-1)continue;
            if((imagecolorat($source,$x,$y)>>24&127)<127)throw new RuntimeException("Cannot pad a possibly clipped silhouette: $key/$action");
        }
        $padded=masterCanvas($w+2*$padding,$h+2*$padding);
        imagecopy($padded,$source,$padding,$padding,0,0,$w,$h);$source=$padded;
    }
    adventureKeyedCutout($source,"$key/$action",false,'red');
    $out=masterCanvas($cols*384,$rows*384);
    $scale=256/(imagesx($source)/$cols)*($settings['scale']??1);
    $records=[];
    $xs=[0];
    for($c=1;$c<$cols;$c++) {
        $target=$c*imagesx($source)/$cols;$radius=(int)round(imagesx($source)/$cols*.3);$best=INF;$line=0;
        for($x=(int)$target-$radius;$x<(int)$target+$radius;$x++) {
            $ink=0;for($y=0;$y<imagesy($source);$y++)if((imagecolorat($source,$x,$y)>>24&127)<100)$ink++;
            $score=$ink*1000+abs($x-$target);if($score<$best){$best=$score;$line=$x;}
        }
        if($best>=1000)throw new RuntimeException("No transparent column separator for $action/$c; review source rectangles");
        $xs[]=$line;
    }
    $xs[]=imagesx($source);
    for($c=0;$c<$cols;$c++) {
        $x0=$xs[$c];$x1=$xs[$c+1];
        // Separate on the nearest empty scanline, not through a wandering cap tip.
        $ys=[0];
        for($r=1;$r<$rows;$r++) {
            $target=$r*imagesy($source)/$rows;$best=INF;$line=0;
            $radius=(int)ceil(imagesy($source)/$rows*.35);
            for($y=max($ys[$r-1]+2,(int)$target-$radius);$y<min(imagesy($source)-1,(int)$target+$radius);$y++) {
                $ink=0;for($x=$x0;$x<$x1;$x++)if((imagecolorat($source,$x,$y)>>24&127)<100)$ink++;
                $score=$ink*1000+abs($y-$target);if($score<$best){$best=$score;$line=$y;}
            }
            if($best>=1000)throw new RuntimeException("No transparent row separator for $action/$c/$r; review source rectangles");
            $ys[]=$line;
        }
        $ys[]=imagesy($source);
        for($r=0;$r<$rows;$r++) {
            $rect=[$x0,$ys[$r],$x1-$x0,$ys[$r+1]-$ys[$r]];
            $cell=adventurePreparedSpriteCell($source,$rect,['cleanFragments'=>.015]);
            [$bx,$by,$bw,$bh]=adventureVisibleBounds($cell,[0,0,imagesx($cell),imagesy($cell)],"$key/$action/$c/$r");
            $dw=(int)round($bw*$scale);$dh=(int)round($bh*$scale);
            $dx=$c*384+192-(int)round($dw/2);
            $dy=$r*384+($action==='carried'?32:360-$dh);
            if($dw>348||$dh>348)throw new RuntimeException("Pose needs reviewed scale, not automatic squeezing: $action/$c/$r");
            imagecopyresampled($out,$cell,$dx,$dy,$bx,$by,$dw,$dh,$bw,$bh);
            $records[]=['cell'=>[$c,$r],'sourceRect'=>$rect,'ink'=>[$bx,$by,$bw,$bh],'scale'=>$scale];
        }
    }
    // Reviewed corrections replace existing slots; they never add phases or
    // change the shared action contract. A whole correction strip has ONE scale.
    $replaced=[];
    foreach($settings['overrides']??[] as $override) {
        $name=$override['source'];
        if(!preg_match('/^[a-z0-9-]+$/D',$name))throw new RuntimeException('Invalid override source');
        $extra=imagecreatefrompng("$dir/sources/$name.png");
        try { adventureKeyedCutout($extra,"$key/$action/$name",false,'red'); }
        catch(RuntimeException $e) {
            if(!str_starts_with($e->getMessage(),'Art touches source edge;'))throw $e;
            // An unused outer cell may be clipped. Each selected cell below
            // still has to have completely transparent margins of its own.
        }
        [$nc,$nr]=$override['grid'];
        $extraScale=256/(imagesx($extra)/$nc)*$override['scale'];
        foreach($override['cells'] as $mapping) {
            [$sc,$sr]=$mapping['from'];[$tc,$tr]=$mapping['to'];
            if(min($sc,$sr,$tc,$tr)<0||$sc>=$nc||$sr>=$nr||$tc>=$cols||$tr>=$rows||isset($replaced["$tc/$tr"]))
                throw new RuntimeException('Invalid or duplicate replacement slot');
            $sx=(int)round($sc*imagesx($extra)/$nc);$sy=(int)round($sr*imagesy($extra)/$nr);
            $sw=(int)round(($sc+1)*imagesx($extra)/$nc)-$sx;$sh=(int)round(($sr+1)*imagesy($extra)/$nr)-$sy;
            $rect=$mapping['sourceRect']??[$sx,$sy,$sw,$sh];
            [$sx,$sy,$sw,$sh]=$rect;
            if(min($sx,$sy)<0||min($sw,$sh)<1||$sx+$sw>imagesx($extra)||$sy+$sh>imagesy($extra))throw new RuntimeException('Replacement rectangle outside source');
            $cell=adventurePreparedSpriteCell($extra,$rect,['cleanFragments'=>.015]);
            [$bx,$by,$bw,$bh]=adventureVisibleBounds($cell,[0,0,$sw,$sh],"$key/$action/$name");
            if($bx<1||$by<1||$bx+$bw>=$sw||$by+$bh>=$sh)throw new RuntimeException("Replacement silhouette touches crop edge: $key/$action/$name $tc,$tr rect=".json_encode($rect).' ink='.json_encode([$bx,$by,$bw,$bh]));
            $dw=(int)round($bw*$extraScale);$dh=(int)round($bh*$extraScale);
            if($dw>348||$dh>348)throw new RuntimeException('Replacement needs reviewed uniform scale');
            imagefilledrectangle($out,$tc*384,$tr*384,($tc+1)*384-1,($tr+1)*384-1,imagecolorallocatealpha($out,0,0,0,127));
            imagecopyresampled($out,$cell,$tc*384+192-(int)round($dw/2),$tr*384+($action==='carried'?32:360-$dh),$bx,$by,$dw,$dh,$bw,$bh);
            $replaced["$tc/$tr"]=true;
            foreach($records as &$record)if($record['cell']===[$tc,$tr])$record=['cell'=>[$tc,$tr],'overrideSource'=>$name,'sourceRect'=>$rect,'ink'=>[$bx,$by,$bw,$bh],'scale'=>$extraScale];
            unset($record);
        }
    }
    imagepng($out,"$dir/review/$action.png",9);
    file_put_contents("$dir/review/$action.registration.json",json_encode($records,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES)."\n");
    echo "$key/$action: ".count($records)." cells, fixed source scale $scale\n";
}
