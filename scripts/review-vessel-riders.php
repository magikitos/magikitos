<?php
declare(strict_types=1);
/** Native-pixel composition contact sheet. Derived preview only, never a compound runtime sprite. */
require_once __DIR__ . '/lib/adventure-sprite-packer.php';
$root = dirname(__DIR__);
$variant = (int) (getopt('', ['variant:'])['variant'] ?? 100);
$rowers = json_decode(file_get_contents("$root/data/aventura/assets/actor-$variant-row.json"), true, 512, JSON_THROW_ON_ERROR)['frames'];
$vessels = json_decode(file_get_contents("$root/data/aventura/art/river/vessels.json"), true, 512, JSON_THROW_ON_ERROR);
$images = [];
$native = function (array $frame) use (&$images, $root): GdImage {
    $source = $images[$frame['source']] ??= imagecreatefrompng("$root/{$frame['source']}");
    return adventureNativeSprite($source, $frame, adventureSourceCell($source, $frame), []);
};
foreach ($vessels['sheets'] as $vessel) {
    $hulls = json_decode(file_get_contents("$root/data/aventura/assets/{$vessel['pack']}.json"), true, 512, JSON_THROW_ON_ERROR)['frames'];
    $out = imagecreatetruecolor(8 * 264, 4 * 230);
    imagefill($out, 0, 0, imagecolorallocate($out, 91, 138, 143));
    $ink = imagecolorallocate($out, 242, 233, 203);
    foreach ($vessels['directions'] as $column => $direction) for ($phase = 0; $phase < 4; $phase++) {
        foreach ([$hulls["{$vessel['spritePrefix']}-$direction-0"], $rowers["person-$variant-$direction-row-$phase"]] as $frame) {
            $image = $native($frame);
            $x = $column * 264 + 132 - $frame['anchor'][0] * 3;
            $y = $phase * 230 + 123 - $frame['anchor'][1] * 3;
            imagecopyresized($out, $image, (int)$x, (int)$y, 0, 0, $frame['size'][0] * 3, $frame['size'][1] * 3, imagesx($image), imagesy($image));
        }
        imagestring($out, 2, $column * 264 + 8, ($phase + 1) * 230 - 20, "$direction / $phase", $ink);
    }
    $file = "$root/.local/vessel-art-reviews/{$vessel['id']}-rider-$variant.png";
    imagepng($out, $file, 9);
    echo "$file\n";
}
