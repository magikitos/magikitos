<?php
declare(strict_types=1);
require_once __DIR__.'/adventure-actor-registration.php';

/** Match the original fabric/boot palette before compositing, avoiding a lighter
 * trouser flash on contact B. Limited channel gains retain the painted shading. */
function adventureGaitMatchPalette(GdImage $legs, GdImage $reference, int $top): void
{
    $means=[];
    foreach ([$legs,$reference] as $image) {
        $sum=[0,0,0]; $count=0;
        for ($y=$top;$y<imagesy($image);$y++) for ($x=0;$x<imagesx($image);$x++) {
            $pixel=imagecolorat($image,$x,$y);
            if ((($pixel>>24)&127)>20) continue;
            $sum[0]+=($pixel>>16)&255; $sum[1]+=($pixel>>8)&255; $sum[2]+=$pixel&255; $count++;
        }
        if (!$count) throw new RuntimeException('Empty gait palette sample');
        $means[]=array_map(fn($value)=>$value/$count,$sum);
    }
    $gain=[];
    foreach ($means[0] as $channel=>$mean) $gain[]=max(.7,min(1.2,$means[1][$channel]/max(1,$mean)));
    imagealphablending($legs,false);
    for ($y=0;$y<imagesy($legs);$y++) for ($x=0;$x<imagesx($legs);$x++) {
        $pixel=imagecolorat($legs,$x,$y); $alpha=($pixel>>24)&127;
        if ($alpha===127) continue;
        $r=min(255,(int)round((($pixel>>16)&255)*$gain[0]));
        $g=min(255,(int)round((($pixel>>8)&255)*$gain[1]));
        $b=min(255,(int)round(($pixel&255)*$gain[2]));
        imagesetpixel($legs,$x,$y,($alpha<<24)|($r<<16)|($g<<8)|$b);
    }
    imagealphablending($legs,true);
}

/**
 * Offline opposite footfall correction. Original heads, clothing and registration
 * remain the inputs. Only lateral/diagonal contact B is composited; no runtime
 * masks, extra frames, enlarged textures or per-character animation code.
 */
function adventureGaitFrames(array $frames, int $variant, string $action, string $root): array
{
    if (!in_array($action, ['walk', 'run'], true)) return $frames;
    $directory = "$root/data/aventura/art/gait";
    $catalog = json_decode(file_get_contents("$directory/catalog.json"), true, 512, JSON_THROW_ON_ERROR);
    $spec = $catalog['characters'][(string)$variant] ?? null;
    if (!$spec) return $frames;

    $sourceFile = "$directory/sources/$variant-opposite.png";
    if (hash_file('sha256', $sourceFile) !== $spec['sha256']) {
        throw new RuntimeException("Unreviewed gait source: $variant");
    }
    $source = imagecreatefrompng($sourceFile);
    adventureKeyedCutout($source, "gait-$variant", false, 'red');
    $directions = ['right', 'down-right', 'up-right', 'left', 'down-left', 'up-left'];
    $density = 8;
    $size = 48 * $density;
    $atlas = adventureClearCanvas(count($directions) * $size, $size);
    $cache = [];
    $native = static function (array $frame) use ($root, &$cache, $density): GdImage {
        $image = $cache[$frame['source']] ??= imagecreatefrompng("$root/{$frame['source']}");
        $cell = adventurePreparedSpriteCell($image, adventureSourceCell($image, $frame), $frame);
        return adventureNativeSprite($cell, $frame, [0, 0, imagesx($cell), imagesy($cell)], [],
            ['pixelRatio'=>$density, 'sampling'=>'area']);
    };
    $pose = $action === 'walk' ? 3 : 2;
    $original = $frames;
    $recipe = $spec[$action];
    $order = $recipe['order'] ?? [0, 1, 2, 3];
    $sorted = $order;
    sort($sorted);
    if ($sorted !== [0, 1, 2, 3]) throw new RuntimeException("Invalid contact order: $variant/$action");
    $qa = ['sourceSha256'=>$spec['sha256'], 'recipeSha256'=>hash('sha256', json_encode($spec)),
        'originalFramesSha256'=>hash('sha256', json_encode($original)), 'poses'=>[]];

    foreach ($directions as $column=>$direction) {
        if ($action === 'run') {
            foreach ($order as $target=>$from) {
                $frames["person-$variant-$direction-run-$target"] = $original["person-$variant-$direction-run-$from"];
            }
        }
        $name = "person-$variant-$direction-$action-$pose";
        $baseFrame = $frames[$name];
        $base = $native($baseFrame);
        $cut = $recipe['cut'];
        $legTop = $cut - ($recipe['overlap'] ?? 2);
        $mirror = $column >= 3;
        $targetX = $recipe['hips'][$column] ?? ($mirror ? 23 : 25);

        // Match contact A's authored stride width, not a single skinny leg rig
        // stretched across all identities. Original soles register at y=46.
        $contact = $native($frames["person-$variant-$direction-$action-".($action === 'walk' ? 1 : 0)]);
        $cutPixel = (int)round($cut * $density);
        [,, $contactWidth] = adventureVisibleBounds($contact,
            [0, $cutPixel, $size, $size - $cutPixel], "$name-contact");
        $cell = adventureSourceCell($source,
            ['grid'=>[2, 3], 'cell'=>[$action === 'run' ? 1 : 0, $column % 3]]);
        $part = adventurePreparedSpriteCell($source, $cell, ['cleanFragments'=>.12]);
        [, $by,, $bh] = adventureVisibleBounds($part, [0, 0, imagesx($part), imagesy($part)], $name);
        [$hx, $hy] = $spec['sourceHips'][$action][$column % 3];
        $hx *= imagesx($part);
        $hy *= imagesy($part);
        $ground = $by + $bh;
        if ($hy < 0 || $hy >= $ground || $legTop < 25 || $cut >= 46) {
            throw new RuntimeException("Invalid gait registration: $name");
        }
        $scaleY = (46 - $legTop) / ($ground - $hy);
        $legs = adventureClearCanvas(imagesx($part), $ground - (int)round($hy));
        imagecopy($legs, $part, 0, 0, 0, (int)round($hy), imagesx($legs), imagesy($legs));
        if ($mirror) {
            imageflip($legs, IMG_FLIP_HORIZONTAL);
            $hx = imagesx($part) - $hx;
        }
        [,, $legWidth] = adventureVisibleBounds($legs, [0, 0, imagesx($legs), imagesy($legs)], "$name-legs");
        $scaleX = $contactWidth / $density / $legWidth * ($recipe['width'] ?? 1);
        $body = adventureClearCanvas($size, $size);
        imagealphablending($body, true);
        imagecopyresampled($body, $legs,
            (int)round(($targetX - $hx * $scaleX) * $density), (int)round($legTop * $density),
            0, 0, (int)round(imagesx($legs) * $scaleX * $density),
            (int)round(imagesy($legs) * $scaleY * $density), imagesx($legs), imagesy($legs));
        adventureGaitMatchPalette($body, $contact, $cutPixel);

        $upper = adventureClearCanvas($size, $size);
        imagecopy($upper, $base, 0, 0, 0, 0, $size, (int)round(($cut + .5) * $density));
        if ($action === 'run') {
            // The previous raised heel sometimes reaches beside the pelvis.
            // Exclude it, retaining the original waist/pouch above the new legs.
            $clear = imagecolorallocatealpha($upper, 0, 0, 0, 127);
            $half = $recipe['waistHalfWidth'] ?? 5.5;
            $heelTop = (int)round(($cut - 2.8) * $density);
            imagefilledrectangle($upper, 0, $heelTop, (int)round(($targetX - $half) * $density), $size, $clear);
            imagefilledrectangle($upper, (int)round(($targetX + $half) * $density), $heelTop, $size, $size, $clear);
        }
        adventureCleanFragments($upper, .03);
        imagecopy($body, $upper, 0, 0, 0, 0, $size, $size);
        imagecopy($atlas, $body, $column * $size, 0, 0, 0, $size, $size);
        $frames[$name] = [
            'source'=>"data/aventura/art/gait/cutouts/$variant-$action.png",
            'grid'=>[6, 1], 'cell'=>[$column, 0], 'size'=>[48, 48], 'anchor'=>[24, 46],
            'preserveCanvas'=>true, 'registration'=>['scale'=>1 / $density, 'offset'=>[0, 0]],
            'cleanFragments'=>.015,
        ];
        $bounds = adventureVisibleBounds($body, [0, 0, $size, $size], $name);
        if ($bounds[0] <= 0 || $bounds[0] + $bounds[2] >= $size
            || $bounds[1] <= 0 || $bounds[1] + $bounds[3] >= $size) {
            throw new RuntimeException("Clipped gait silhouette: $name");
        }
        $qa['poses'][$name] = ['baseFrame'=>$baseFrame,
            'bounds'=>array_map(fn($value)=>$value / $density, $bounds),
            'contactWidth'=>$contactWidth / $density];
    }
    if (!is_dir("$directory/cutouts")) mkdir("$directory/cutouts", 0775, true);
    $temporary = tempnam("$directory/cutouts", '.gait-');
    try {
        if (!imagepng($atlas, $temporary, 9) || !rename($temporary, "$directory/cutouts/$variant-$action.png")) {
            throw new RuntimeException('Cannot publish gait cutout');
        }
    } finally {
        if (is_file($temporary)) unlink($temporary);
    }
    $qa['cutoutSha256'] = hash_file('sha256', "$directory/cutouts/$variant-$action.png");
    file_put_contents("$directory/cutouts/$variant-$action.json",
        json_encode($qa, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n");
    return $frames;
}
