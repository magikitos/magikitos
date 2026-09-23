<?php
declare(strict_types=1);

// Texture pixels are not world units. The accepted profile is baked offline.
const ADVENTURE_ART_PROFILE = ['pixelRatio'=>2, 'sampling'=>'area'];

/** All poses are authored explicitly; no implicit mirrored animation template. */
function adventureSpriteFrames(array $package): array
{
    return $package['frames'];
}

function adventureClearCanvas(int $width, int $height): GdImage
{
    $image = imagecreatetruecolor($width, $height);
    imagealphablending($image, false);
    imagesavealpha($image, true);
    imagefill($image, 0, 0, imagecolorallocatealpha($image, 0, 0, 0, 127));
    return $image;
}

/** Explicit crop windows also support source sheets whose row spacing is uneven. */
function adventureSourceCell(GdImage $source, array $definition): array
{
    if (isset($definition['rect'])) {
        [$x, $y, $width, $height] = $definition['rect'];
    } else {
        [$column, $row] = $definition['cell'];
        [$columns, $rows] = $definition['grid'];
        $x = (int) round(imagesx($source) * $column / $columns);
        $y = (int) round(imagesy($source) * $row / $rows);
        $width = (int) round(imagesx($source) * ($column + 1) / $columns) - $x;
        $height = (int) round(imagesy($source) * ($row + 1) / $rows) - $y;
    }
    if ($x < 0 || $y < 0 || $width < 1 || $height < 1
        || $x + $width > imagesx($source) || $y + $height > imagesy($source)) {
        throw new RuntimeException('Crop outside source: ' . $definition['source']);
    }
    return [$x, $y, $width, $height];
}

function adventureVisibleBounds(GdImage $source, array $cell, string $name): array
{
    [$sx, $sy, $width, $height] = $cell;
    $minX = $width;
    $minY = $height;
    $maxX = $maxY = -1;
    for ($y = 0; $y < $height; $y++) {
        for ($x = 0; $x < $width; $x++) {
            if (((imagecolorat($source, $sx + $x, $sy + $y) >> 24) & 127) > 37) {
                continue;
            }
            $minX = min($minX, $x);
            $minY = min($minY, $y);
            $maxX = max($maxX, $x);
            $maxY = max($maxY, $y);
        }
    }
    if ($maxX < 0) {
        throw new RuntimeException("Empty sprite: $name");
    }
    return [$sx + $minX, $sy + $minY, $maxX - $minX + 1, $maxY - $minY + 1];
}

/** Remove isolated source-sheet marks, not details connected to the furniture body. */
function adventureCleanFragments(GdImage $sprite, float $ratio): void
{
    $width = imagesx($sprite);
    $height = imagesy($sprite);
    $seen = $components = [];
    for ($pixel = 0; $pixel < $width * $height; $pixel++) {
        if (isset($seen[$pixel])
            || ((imagecolorat($sprite, $pixel % $width, intdiv($pixel, $width)) >> 24) & 127) > 37) {
            continue;
        }
        $queue = [$pixel];
        $seen[$pixel] = true;
        for ($at = 0; $at < count($queue); $at++) {
            $index = $queue[$at];
            $x = $index % $width;
            $y = intdiv($index, $width);
            foreach ([[$x - 1, $y], [$x + 1, $y], [$x, $y - 1], [$x, $y + 1]] as [$nx, $ny]) {
                $next = $ny * $width + $nx;
                if ($nx < 0 || $ny < 0 || $nx >= $width || $ny >= $height || isset($seen[$next])
                    || ((imagecolorat($sprite, $nx, $ny) >> 24) & 127) > 37) {
                    continue;
                }
                $seen[$next] = true;
                $queue[] = $next;
            }
        }
        $components[] = $queue;
    }
    if (!$components) {
        return;
    }
    $minimum = max(array_map('count', $components)) * $ratio;
    $clear = imagecolorallocatealpha($sprite, 0, 0, 0, 127);
    foreach ($components as $part) {
        if (count($part) >= $minimum) {
            continue;
        }
        foreach ($part as $pixel) {
            imagesetpixel($sprite, $pixel % $width, intdiv($pixel, $width), $clear);
        }
    }
}

/** Isolate before reducing: neighbouring sheet fragments must not bleed into native pixels.
 * Used by production, registration measurements and candidate review alike. */
function adventurePreparedSpriteCell(GdImage $source, array $cell, array $definition): GdImage
{
    [$sx, $sy, $sw, $sh] = $cell;
    $image = adventureClearCanvas($sw, $sh);
    imagecopy($image, $source, 0, 0, $sx, $sy, $sw, $sh);
    if (!empty($definition['cleanFragments'])) {
        adventureCleanFragments($image, $definition['cleanFragments']);
    }
    return $image;
}

function adventureNativeSprite(GdImage $source, array $definition, array $cell, array $groups, array $profile = ADVENTURE_ART_PROFILE): GdImage
{
    [$sx, $sy, $sw, $sh] = $cell;
    [$width, $height] = $definition['size'];
    $dw = $width;
    $dh = $height;
    if (!empty($definition['fit'])) {
        [$gw, $gh] = isset($definition['scaleGroup']) ? $groups[$definition['scaleGroup']] : [$sw, $sh];
        $ratio = min($width / $gw, $height / $gh);
        $dw = (int) round($sw * $ratio);
        $dh = (int) round($sh * $ratio);
    }
    $density = $profile['pixelRatio'];
    $sprite = adventureClearCanvas($width * $density, $height * $density);
    $copy = $profile['sampling'] === 'area' ? 'imagecopyresampled' : 'imagecopyresized';
    if (isset($definition['registration'])) {
        $r = $definition['registration'];
        $copy($sprite, $source, (int)round($r['offset'][0]*$density), (int)round($r['offset'][1]*$density),
            $sx, $sy, (int)round($sw*$r['scale']*$density), (int)round($sh*$r['scale']*$density), $sw, $sh);
    } else {
        $copy($sprite, $source, intdiv($width - $dw, 2) * $density, ($height - $dh) * $density, $sx, $sy, $dw * $density, $dh * $density, $sw, $sh);
    }
    if (!empty($definition['cleanFragments'])) {
        adventureCleanFragments($sprite, $definition['cleanFragments']);
    }
    if (!empty($definition['flip'])) {
        imageflip($sprite, IMG_FLIP_HORIZONTAL);
    }
    return $sprite;
}

/** Palette is local to this package; alpha stays binary rather than becoming a painted background. */
function adventureIndexedImage(GdImage $source): GdImage
{
    $width = imagesx($source);
    $height = imagesy($source);
    $palette = imagecreatetruecolor($width, $height);
    imagecopy($palette, $source, 0, 0, 0, 0, $width, $height);
    imagetruecolortopalette($palette, false, 255);
    $transparent = imagecolorallocatealpha($palette, 1, 0, 1, 127);
    imagecolortransparent($palette, $transparent);
    for ($y = 0; $y < $height; $y++) {
        for ($x = 0; $x < $width; $x++) {
            if (((imagecolorat($source, $x, $y) >> 24) & 127) > 37) {
                imagesetpixel($palette, $x, $y, $transparent);
            }
        }
    }
    return $palette;
}

/** Every read below is `imagecolorat() >> 24`, which is the ALPHA only on a truecolor image: on an
 *  indexed PNG it returns the palette index, so a transparent corner read as opaque and a sheet
 *  saved with a palette was refused. Convert once on open, whatever the file was saved as. */
function adventureOpenSource(string $file): GdImage
{
    $image = imagecreatefrompng($file);
    if ($image === false) throw new RuntimeException('Unreadable sprite source: ' . $file);
    if (!imageistruecolor($image)) imagepalettetotruecolor($image);
    imagealphablending($image, false);
    imagesavealpha($image, true);
    return $image;
}

/**
 * A soft-edged package whose pixels already use 256 colours or fewer (a sheet quantised once at
 * the source, like the diary's panel) is stored with an EXACT palette: the same pixels, alpha
 * included, at about half the bytes. More colours than that and it stays truecolor — this never
 * quantises anything itself, so no package can lose a shade here.
 */
function adventureExactPalette(GdImage $image): ?GdImage
{
    $width = imagesx($image);
    $height = imagesy($image);
    $colours = [];
    for ($y = 0; $y < $height; $y++) {
        for ($x = 0; $x < $width; $x++) {
            $colours[imagecolorat($image, $x, $y)] = true;
            if (count($colours) > 256) return null;
        }
    }
    $palette = imagecreate($width, $height);
    imagealphablending($palette, false);
    imagesavealpha($palette, true);
    $index = [];
    foreach (array_keys($colours) as $c) {
        $index[$c] = imagecolorallocatealpha($palette, ($c >> 16) & 255, ($c >> 8) & 255, $c & 255, ($c >> 24) & 127);
    }
    for ($y = 0; $y < $height; $y++) {
        for ($x = 0; $x < $width; $x++) {
            imagesetpixel($palette, $x, $y, $index[imagecolorat($image, $x, $y)]);
        }
    }
    return $palette;
}

function bakeAdventureSprites(array $definitions, string $root, array $profile = ADVENTURE_ART_PROFILE): array
{
    $density = $profile['pixelRatio'];
    if (!in_array($density, [1,2,3], true) || !in_array($profile['sampling'], ['area','nearest'], true)) {
        throw new RuntimeException('Invalid offline art profile');
    }
    if (!$definitions) {
        throw new RuntimeException('Empty sprite package');
    }
    // UI portraits need their faint scenery/halo, not the world's binary-alpha pixel palette.
    // Keep the policy explicit per package so existing world/actor textures remain identical.
    $alphaCount = count(array_filter($definitions, static fn($d) => ($d['continuousAlpha'] ?? false) === true));
    if ($alphaCount !== 0 && $alphaCount !== count($definitions)) {
        throw new RuntimeException('Do not mix continuous and binary alpha in one sprite package');
    }
    $continuousAlpha = $alphaCount > 0;
    foreach ($definitions as $definition) {
        [$width, $height] = $definition['size'];
        if ($width < 1 || $width > 510 || $height < 1 || $height > 2046) {
            throw new RuntimeException('Invalid native sprite size');
        }
    }
    $area = array_sum(array_map(static fn($d) => ($d['size'][0] + 2) * ($d['size'][1] + 2), $definitions));
    $widest = max(array_map(static fn($d) => $d['size'][0] + 2, $definitions));
    $width = min(512, max(64, 2 ** (int) ceil(log(max($widest, sqrt($area)), 2)))) * $density;
    $atlas = adventureClearCanvas($width, 2048 * $density);
    $clear = imagecolorallocatealpha($atlas, 0, 0, 0, 127);
    $sources = $prepared = $frames = $cells = $groups = [];
    foreach ($definitions as $name => $definition) {
        $source = $sources[$definition['source']] ??= adventureOpenSource($root . '/' . $definition['source']);
        if (($definition['opaque'] ?? false) !== true && ((imagecolorat($source, 0, 0) >> 24) & 127) < 100) {
            throw new RuntimeException('Source needs a real alpha channel: ' . $definition['source']);
        }
        [$sx, $sy, $sw, $sh] = adventureSourceCell($source, $definition);
        // Reject isolated sheet debris before fitting, so it cannot shrink or offset the actual object.
        $cellImage = adventurePreparedSpriteCell($source, [$sx, $sy, $sw, $sh], $definition);
        $prepared[$name] = $cellImage;
        $visible = adventureVisibleBounds($cellImage, [0, 0, $sw, $sh], $name);
        // Authored animation cells share a registration canvas. Fitting each pose's
        // silhouette independently makes feet slide when an arm or head moves.
        $cells[$name] = !empty($definition['preserveCanvas']) ? [0, 0, $sw, $sh] : $visible;
        if (isset($definition['scaleGroup'])) {
            $group = $definition['scaleGroup'];
            $groups[$group] = [
                max($groups[$group][0] ?? 0, $cells[$name][2]),
                max($groups[$group][1] ?? 0, $cells[$name][3]),
            ];
        }
    }
    $x = $y = $density;
    $rowHeight = 0;
    foreach ($definitions as $name => $definition) {
        [$nativeWidth, $nativeHeight] = $definition['size'];
        $sprite = adventureNativeSprite($prepared[$name], $definition, $cells[$name], $groups, $profile);
        $editCrop = $definition['crop'] ?? [0, 0, $nativeWidth, $nativeHeight];
        if (count($editCrop) !== 4 || count(array_filter($editCrop, 'is_int')) !== 4
            || $editCrop[0] < 0 || $editCrop[1] < 0 || $editCrop[2] < 1 || $editCrop[3] < 1
            || $editCrop[0] + $editCrop[2] > $nativeWidth || $editCrop[1] + $editCrop[3] > $nativeHeight) {
            throw new RuntimeException('Invalid native crop: ' . $name);
        }
        if (str_starts_with($name, 'person-') || $continuousAlpha) {
            [$cropX, $cropY, $w, $h] = $editCrop;
        } else {
            [$vx,$vy,$vw,$vh] = adventureVisibleBounds($sprite, array_map(static fn($n)=>$n*$density, $editCrop), $name);
            // Round outwards to whole logical units. Studio crops stay in world
            // units; a half-pixel texture edge cannot move the foot or collider.
            $cropX = (int) floor($vx/$density); $cropY = (int) floor($vy/$density);
            $w = (int) ceil(($vx+$vw)/$density)-$cropX;
            $h = (int) ceil(($vy+$vh)/$density)-$cropY;
        }
        $anchor = $definition['anchor'] ?? [intdiv($nativeWidth, 2), $nativeHeight - 3];
        if (count($anchor) !== 2 || !is_int($anchor[0]) || !is_int($anchor[1])
            || $anchor[0] < 0 || $anchor[0] > $nativeWidth || $anchor[1] < 0 || $anchor[1] > $nativeHeight) {
            throw new RuntimeException('Invalid sprite anchor: ' . $name);
        }
        $anchor = [$anchor[0] - $cropX, $anchor[1] - $cropY];
        $tw = $w * $density; $th = $h * $density;
        if ($x + $tw + $density > $width) {
            $x = $density;
            $y += $rowHeight + 2 * $density;
            $rowHeight = 0;
        }
        if ($y + $th + $density > 2048 * $density) {
            throw new RuntimeException('Sprite package exceeds texture budget');
        }
        imagecopy($atlas, $sprite, $x, $y, $cropX * $density, $cropY * $density, $tw, $th);
        // Binary alpha and 5-bit channels share the same crisp native pixel grid.
        for ($py = $y; !$continuousAlpha && $py < $y + $th; $py++) {
            for ($px = $x; $px < $x + $tw; $px++) {
                $color = imagecolorat($atlas, $px, $py);
                imagesetpixel($atlas, $px, $py, (($color >> 24) & 127) > 37 ? $clear : ($color & 0x00f8f8f8));
            }
        }
        [$ix,$iy,$iw,$ih] = adventureVisibleBounds($atlas, [$x,$y,$tw,$th], $name);
        $frames[$name] = [
            'x' => $x, 'y' => $y, 'w' => $w, 'h' => $h,
            'pixelRatio' => $density,
            'ink' => [($ix-$x)/$density,($iy-$y)/$density,$iw/$density,$ih/$density],
            'anchor' => $anchor, 'bounds' => [-$anchor[0], -$anchor[1], $w, $h],
            'nativeSize' => [$nativeWidth, $nativeHeight],
            'trim' => [$cropX, $cropY], 'crop' => $editCrop,
        ];
        $x += $tw + 2 * $density;
        $rowHeight = max($rowHeight, $th);
    }
    $height = $y + $rowHeight + $density;
    $packed = imagecrop($atlas, ['x' => 0, 'y' => 0, 'width' => $width, 'height' => $height]);
    imagesavealpha($packed, true);
    // ⛔ EL PAQUETE VIAJA EN WEBP SIN PÉRDIDA (23-sep-2026, revisión de la compresión). Se cuantiza
    // igual que antes —la paleta de 255 colores ES el aspecto de estos dibujos— y esa misma imagen
    // se codifica sin pérdida: los píxeles son idénticos a los del PNG (comprobado paquete a
    // paquete) y el total baja un 13 %. AVIF sin pérdida se probó y pesa 2,3 veces más que el PNG
    // en arte de paleta, y con pérdida emborrona el píxel, que es lo único que no se puede tocar.
    $final = $continuousAlpha ? (adventureExactPalette($packed) ?? $packed) : adventureIndexedImage($packed);
    if (!imageistruecolor($final)) imagepalettetotruecolor($final);
    imagealphablending($final, false);
    imagesavealpha($final, true);
    ob_start();
    imagewebp($final, null, IMG_WEBP_LOSSLESS);
    $encoded = ob_get_clean();
    return [
        'image' => $encoded,
        'metadata' => ['version' => 1, 'width' => $width, 'height' => $height, 'frames' => $frames],
    ];
}
