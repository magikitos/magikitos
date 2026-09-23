<?php
declare(strict_types=1);
require __DIR__ . '/lib/adventure-sprite-packer.php';
function check(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
$directory = sys_get_temp_dir() . '/magikitos-crop-' . bin2hex(random_bytes(6));
mkdir($directory, 0700);
$source = adventureClearCanvas(128, 128);
$ink = imagecolorallocatealpha($source, 160, 80, 40, 0);
imagefilledrectangle($source, 65, 15, 120, 115, $ink);
imagesetpixel($source, 5, 15, $ink); // A stray sheet mark must not offset the furniture.
imagepng($source, $directory . '/source.png');
$before = hash_file('sha256', $directory . '/source.png');
$definition = ['source'=>'source.png','rect'=>[0,0,128,128],'size'=>[32,40],'cleanFragments'=>0.1];
$plain = bakeAdventureSprites(['bed-test'=>$definition], $directory);
$f = $plain['metadata']['frames']['bed-test'];
check($f['w'] === 32 && $f['h'] === 40, 'Clean debris before fitting to native size');
$cropped = bakeAdventureSprites(['bed-test'=>$definition + ['crop'=>[4,3,20,25]]], $directory);
$f = $cropped['metadata']['frames']['bed-test'];
check($f['w'] === 20 && $f['h'] === 25, 'Exact native crop');
check($f['anchor'] === [12,34], 'Cropping preserves the original foot; anchor may sit below the cropped image');
check($f['trim'] === [4,3], 'Editor can reconstruct original native coordinates');
check(hash_file('sha256', $directory . '/source.png') === $before, 'Source art is immutable');
try {
    bakeAdventureSprites(['bad'=>$definition + ['crop'=>[30,0,4,20]]], $directory);
    throw new RuntimeException('Invalid crop accepted');
} catch (RuntimeException $error) {
    check(str_contains($error->getMessage(), 'Invalid native crop'), 'Reject out-of-bounds crop');
}
// Two animation poses with an identical foot but different arm silhouettes.
$sheet = adventureClearCanvas(128, 64);
$ink = imagecolorallocatealpha($sheet, 160, 80, 40, 0);
foreach ([0, 64] as $offset) imagefilledrectangle($sheet, $offset+24, 20, $offset+39, 55, $ink);
imagefilledrectangle($sheet, 39, 24, 54, 28, $ink);
imagefilledrectangle($sheet, 64+36, 6, 64+39, 24, $ink);
imagepng($sheet, $directory . '/poses.png');
$registered = ['source'=>'poses.png','grid'=>[2,1],'size'=>[32,32],'anchor'=>[16,28],'preserveCanvas'=>true];
$poses = bakeAdventureSprites(['rest'=>$registered+['cell'=>[0,0]],'raised'=>$registered+['cell'=>[1,0]]], $directory);
$image = imagecreatefromstring($poses['png']);
foreach ($poses['metadata']['frames'] as $frame) {
    $footX = $frame['x'] + $frame['anchor'][0] * $frame['pixelRatio'];
    $footY = $frame['y'] + $frame['anchor'][1] * $frame['pixelRatio'] - 1;
    $color = imagecolorsforindex($image, imagecolorat($image, $footX, $footY));
    check($color['alpha'] === 0, 'A raised arm must not resize or recenter the shared foot');
}
// UI cards must keep faint backgrounds; the world still uses its crisp binary palette.
$card = adventureClearCanvas(32, 40);
imagefilledrectangle($card, 2, 2, 29, 37, imagecolorallocatealpha($card, 190, 150, 90, 105));
imagefilledrectangle($card, 12, 8, 19, 32, imagecolorallocatealpha($card, 90, 80, 70, 0));
imagepng($card, $directory . '/card.png');
$cardDefinition = ['source'=>'card.png','grid'=>[1,1],'cell'=>[0,0],'size'=>[32,40],
    'anchor'=>[16,40],'preserveCanvas'=>true,'continuousAlpha'=>true,'registration'=>['scale'=>1,'offset'=>[0,0]]];
$cards = bakeAdventureSprites(['portrait'=>$cardDefinition], $directory);
$image = imagecreatefromstring($cards['png']);
// Few colours: stored with an exact palette (`adventureExactPalette`), so read it as truecolor.
check(!imageistruecolor($image), 'A soft package with few colours is stored with an exact palette');
imagepalettetotruecolor($image);$f = $cards['metadata']['frames']['portrait'];
check($f['w'] === 32 && $f['h'] === 40 && $f['trim'] === [0,0], 'Halo canvas cannot be cropped to opaque body');
$alpha = imagecolorat($image,$f['x']+8,$f['y']+8)>>24&127;
check($alpha === 105, 'Continuous alpha survives the final PNG, not only the source card');
check((imagecolorat($image,$f['x'],$f['y'])>>24&127) === 127, 'Transparent outer edge stays transparent');
try {
    bakeAdventureSprites(['portrait'=>$cardDefinition,'world'=>$definition], $directory);
    throw new RuntimeException('Mixed alpha policy accepted');
} catch (RuntimeException $error) {
    check(str_contains($error->getMessage(),'Do not mix'), 'Explicit package alpha policy');
}
echo "PASS: offline native crop, source debris, immutable originals, bounds, registered animation feet and preserved portrait alpha.\n";
