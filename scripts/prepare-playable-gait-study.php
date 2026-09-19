<?php
declare(strict_types=1);
/** Offline crop/reorder only: inspect/correct front and rear gait without adding phases. */
require_once __DIR__.'/lib/adventure-actor-registration.php';
$root=dirname(__DIR__);$key=getopt('', ['character:'])['character']??'';
if(!preg_match('/^[a-z]+-[a-z]+$/D',$key))throw new RuntimeException('Use --character=profile-key');
$dir="$root/data/aventura/art/playable-cast/$key/review";
$im=imagecreatefrompng("$dir/run.png");
if(imagesx($im)!==3072||imagesy($im)!==1536)throw new RuntimeException('Canonical running master required');
$out=adventureClearCanvas(1536,768);
foreach([0,4] as $r=>$direction)for($phase=0;$phase<4;$phase++)
    imagecopy($out,$im,$phase*384,$r*384,$direction*384,$phase*384,384,384);
imagepng($out,"$dir/run-gait-input.png",9);
echo "$key: four front + four rear existing frames; review input, not an extra action.\n";
