<?php
declare(strict_types=1);
require_once __DIR__ . '/adventure-sprite-packer.php';
/** Removes only an explicitly authored magenta matte. Never resizes, recolours or reshapes the object. */
function adventureKeyedCutout(GdImage $source, string $id, bool $foliageMatte = false): array
{
    imagepalettetotruecolor($source);
    imagealphablending($source, false); imagesavealpha($source, true);
    $w = imagesx($source); $h = imagesy($source);
    if ($w * $h > 16000000) throw new RuntimeException('Unreasonably large source');
    $mask = str_repeat("\0", $w * $h);
    $removed = 0;
    for ($y = 0; $y < $h; $y++) for ($x = 0; $x < $w; $x++) {
        $pixel = imagecolorat($source, $x, $y);
        $r = ($pixel >> 16) & 255; $g = ($pixel >> 8) & 255; $b = $pixel & 255;
        // The reviewed tree masters contain no purple subject matter: recover desaturated gaps too.
        $foliageGap = $foliageMatte && min($r,$b)-$g > 8 && $r > $g*1.07 && $b > $g*1.07 && $r > $b*.5 && $r < $b*2;
        if ((($pixel >> 24) & 127) > 100 || $foliageGap || ($r > 200 && $b > 190 && min($r, $b) - $g > 120)) {
            $mask[$y * $w + $x] = "\1"; $removed++;
        }
    }
    // Remove only two source-pixel anti-aliased matte fringes. Interior colours are never keyed by hue.
    for ($pass = 0; $pass < 2; $pass++) {
        $next = $mask;
        for ($y = 1; $y < $h - 1; $y++) for ($x = 1; $x < $w - 1; $x++) {
            $i = $y * $w + $x;
            if ($mask[$i] === "\1" || ($mask[$i-1] === "\0" && $mask[$i+1] === "\0" && $mask[$i-$w] === "\0" && $mask[$i+$w] === "\0")) continue;
            $pixel = imagecolorat($source, $x, $y);
            $r = ($pixel >> 16) & 255; $g = ($pixel >> 8) & 255; $b = $pixel & 255;
            if (min($r, $b) - $g > 60 && $r > $g * 1.7 && $b > $g * 1.7 && $r > $b * .8 && $r < $b * 1.3) {
                $next[$i] = "\1"; $removed++;
            }
        }
        $mask = $next;
    }
    if ($removed < $w*$h*.05 || $removed > $w*$h*.995) throw new RuntimeException('Unexpected matte coverage: ' . $id);
    $clear = imagecolorallocatealpha($source, 0, 0, 0, 127);
    for ($y=0; $y<$h; $y++) for ($x=0; $x<$w; $x++) if ($mask[$y*$w+$x] === "\1") imagesetpixel($source,$x,$y,$clear);
    $bounds = adventureVisibleBounds($source, [0,0,$w,$h], $id);
    if ($bounds[0] < 3 || $bounds[1] < 3 || $bounds[0]+$bounds[2]>$w-3 || $bounds[1]+$bounds[3]>$h-3)
        throw new RuntimeException('Art touches source edge; regenerate with full silhouette: ' . $id);
    return ['bounds'=>$bounds, 'alpha'=>round($removed/($w*$h),3)];
}
