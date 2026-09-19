<?php
declare(strict_types=1);
/** Art-only contract check. No roster, runtime packs or game state is modified. */
$root=dirname(__DIR__);
$options=getopt('', ['character:', 'prepared', 'all-approved']);
$read=fn(string $path)=>json_decode(file_get_contents($path),true,512,JSON_THROW_ON_ERROR);
$actors=$read("$root/data/aventura/art/residents/catalog.json");
$actions=$read("$root/data/aventura/art/residents/actions/catalog.json")['actions'];
$specs=['walk'=>['grid'=>[8,4],'directions'=>$actors['directions']]]+$actions;
$roster=$read("$root/data/aventura/art/playable-cast/approved-101-110.json")['characters'];
function same(mixed $actual,mixed $expected,string $label):void {
    if($actual!==$expected)throw new RuntimeException("Contract mismatch: $label");
}
function validateFrames(array $metadata,array $expected,array $canvas,array $anchor):void {
    same(array_keys($metadata['frames']),$expected,'frame names/order/count');
    foreach($metadata['frames'] as $frame){
        same([$frame['w'],$frame['h']],$canvas,'logical canvas');
        same($frame['anchor'],$anchor,'anchor');
        same($frame['pixelRatio'],2,'2x reduction');
    }
}
$done=[];$pending=[];$negativeChecks=0;
foreach($roster as $person){
    $key=$person['key'];$variant=$person['variant'];
    if(isset($options['character'])&&$options['character']!==$key)continue;
    $dir="$root/data/aventura/art/playable-cast/$key/review";
    if(!is_file("$dir/review.json")){
        $pending[]=$key;
        if(isset($options['all-approved'])||isset($options['character']))throw new RuntimeException("Not prepared: $key");
        continue;
    }
    $report=$read("$dir/review.json");same($report['variant'],$variant,"$key variant");
    same(array_keys($report['actions']),array_keys($specs),"$key actions");$count=0;
    foreach($specs as $action=>$spec){
        [$cols,$rows]=$spec['grid'];$directions=$spec['directions']??[];
        if($directions==='eight')$directions=$actors['directions'];
        $names=[];
        for($r=0;$r<$rows;$r++)for($c=0;$c<$cols;$c++){
            $suffix=isset($spec['names'])?$spec['names'][$r*$cols+$c]:$directions[$c].($action==='walk'&&$r===0?'':"-$action-$r");
            $names[]="person-$variant-$suffix";
        }
        $metadata=$read("$dir/$action-atlas.json");
        validateFrames($metadata,$names,$spec['canvas']??$actors['canvas'],$spec['anchor']??$actors['anchor']);
        same($report['actions'][$action]['count'],$cols*$rows,"$key/$action count");
        same($report['actions'][$action]['measurement']['cellWidth'],384,"$key/$action shared master width");
        same(array_slice(getimagesize("$dir/$action.png"),0,2),[$cols*384,$rows*384],"$key/$action master grid");
        same(hash_file('sha256',"$dir/$action.png"),$report['actions'][$action]['sourceSha256'],"$key/$action source hash");
        $broken=$metadata;array_pop($broken['frames']);$detected=false;
        try{validateFrames($broken,$names,$spec['canvas']??$actors['canvas'],$spec['anchor']??$actors['anchor']);}
        catch(RuntimeException){$detected=true;}
        same($detected,true,'negative control: missing phase must fail');$negativeChecks++;
        $count+=$cols*$rows;
    }
    same($count,156,"$key total");
    same(array_slice(getimagesize("$dir/row-fixed-bodies.png"),0,2),[8*384,384],"$key eight seated bodies");
    $portrait=$read("$dir/portrait.json");same($portrait['size'],[240,320],"$key card size");same($portrait['opaque'],false,"$key card alpha");
    same(hash_file('sha256',"$dir/portrait.png"),$portrait['portraitSha256'],"$key card hash");
    $done[]=$key;
}
if(!$done)throw new RuntimeException('No prepared characters matched');
echo json_encode(['passed'=>$done,'framesEach'=>156,'negativeControls'=>$negativeChecks,'notPrepared'=>$pending],JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT)."\n";
