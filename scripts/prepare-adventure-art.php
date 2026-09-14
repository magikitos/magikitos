<?php
/** User-authorized offline cutout. Source artwork is never modified. No network. */
declare(strict_types=1);
$directory = dirname(__DIR__) . '/data/aventura/art';
$names = array_slice($argv, 1) ?: ['player', 'elder', 'neighbor', 'guardian', 'woodland', 'moss-neighbor', 'ivory-neighbor', 'puzzle-props'];
foreach ($names as $name) {
    if (!preg_match('/^[a-z-]+$/', $name)) throw new InvalidArgumentException('Invalid source name');
    $source = imagecreatefrompng($directory . '/generated/' . $name . '.png');
    $width = imagesx($source); $height = imagesy($source);
    imagealphablending($source, false);
    imagesavealpha($source, true);
    $clear = imagecolorallocatealpha($source, 0, 0, 0, 127);
    // Only neutral, light pixels connected to the outside can become background.
    // Dark outlines protect cream clothing, white hair, eyes and highlights inside sprites.
    $visited = str_repeat("\0", $width * $height);
    $queue = new SplQueue();
    $visit = static function (int $x, int $y) use ($source, $width, $height, &$visited, $queue, $clear): void {
        if ($x < 0 || $y < 0 || $x >= $width || $y >= $height) return;
        $index = $y * $width + $x;
        if ($visited[$index] !== "\0") return;
        $visited[$index] = "\1";
        $color = imagecolorat($source, $x, $y);
        $r = ($color >> 16) & 255; $g = ($color >> 8) & 255; $b = $color & 255;
        if (min($r, $g, $b) < 145 || max($r, $g, $b) - min($r, $g, $b) > 20) return;
        imagesetpixel($source, $x, $y, $clear);
        $queue->enqueue($index);
    };
    for ($x = 0; $x < $width; $x++) { $visit($x, 0); $visit($x, $height - 1); }
    for ($y = 0; $y < $height; $y++) { $visit(0, $y); $visit($width - 1, $y); }
    while (!$queue->isEmpty()) {
        $index = $queue->dequeue(); $x = $index % $width; $y = intdiv($index, $width);
        $visit($x - 1, $y); $visit($x + 1, $y); $visit($x, $y - 1); $visit($x, $y + 1);
    }
    imagepng($source, $directory . '/' . $name . '-cutout.png', 9);
    echo $name . ": prepared alpha; original retained.\n";
}
