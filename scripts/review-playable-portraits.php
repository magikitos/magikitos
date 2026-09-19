<?php
declare(strict_types=1);
/** Contact sheet of authored candidates; does not make unfinished avatars selectable. */
$root=dirname(__DIR__);
$profiles=array_column(json_decode(file_get_contents("$root/data/aventura/art/residents/catalog.json"),true)['profiles'],null,'id');
$ids=json_decode(file_get_contents("$root/data/aventura/art/residents/actions/catalog.json"),true)['variants'];
$out=imagecreatetruecolor(960,(int)ceil(count($ids)/4)*320);
foreach($ids as $i=>$id) {
 $key=$profiles[$id]['key'];$image=imagecreatefrompng("$root/data/aventura/art/playable-cast/$key/review/portrait.png");
 imagecopy($out,$image,($i%4)*240,intdiv($i,4)*320,0,0,240,320);
}
$file="$root/data/aventura/art/playable-cast/portraits-review.png";imagepng($out,$file,9);echo "$file\n";
