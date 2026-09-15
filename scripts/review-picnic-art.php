<?php
declare(strict_types=1);
/** Offline QA only: native atlas contact sheet, never consumed by the runtime. */
require_once __DIR__ . '/lib/adventure-sprite-packer.php';
$root = dirname(__DIR__);
$manifest = json_decode(file_get_contents($root . '/public/assets/aventura/manifest.json'), true);
$names = [
 'picnic-smoker','picnic-smoker-raise','picnic-smoker-puff','picnic-smoker-lower',
 'picnic-human-friend','picnic-friend-talk','picnic-friend-sip','picnic-friend-smile',
 'picnic-knife','lighter','picnic-guacamole','picnic-tortilla-chips',
 'picnic-lemonade','picnic-orange-soda','picnic-speaker'
];
$contact = imagecreatetruecolor(1440, 1400);
imagefill($contact, 0, 0, imagecolorallocate($contact, 112, 140, 83));
$ink = imagecolorallocate($contact, 255, 244, 210);
foreach ($names as $i=>$name) {
 foreach ($manifest['packs'] as $pack) if (in_array($name, $pack['sprites'], true)) {
    $metadata = json_decode(file_get_contents($root . '/public/assets/aventura/' . $pack['metadata']), true);
    $atlas = imagecreatefrompng($root . '/public/assets/aventura/' . $pack['image']);
    $f = $metadata['frames'][$name];
    $x = ($i%4)*360 + 180 - $f['anchor'][0]*3;
    $y = intdiv($i,4)*350 + 320 - $f['anchor'][1]*3;
    imagecopyresized($contact,$atlas,$x,$y,$f['x'],$f['y'],$f['w']*3,$f['h']*3,$f['w']*$f['pixelRatio'],$f['h']*$f['pixelRatio']);
    imagestring($contact, 3, ($i%4)*360+12, intdiv($i,4)*350+330, $name, $ink);
    break;
 }
}
$out = $root . '/.local/picnic-review';
if (!is_dir($out)) mkdir($out, 0755, true);
imagepng($contact, $out . '/native-art.png');
echo $out . '/native-art.png', "\n";
