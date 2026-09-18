<?php
/**
 * ⛔ EL SELECTOR NO PUEDE PEDIR TREINTA HOJAS DE ANDAR PARA ENSEÑAR TREINTA CARAS.
 *
 * La hoja base de un duende son 1024x400 (32 poses): 1,6 MB ya decodificados. Pintar el elenco
 * completo con ellas serían casi 50 MB para elegir una cara, o sea reventar el presupuesto de
 * residencia de sprites y dejar el juego sin memoria para la pantalla que se está jugando. Aquí se
 * saca UN retrato por duende jugable —su pose quieta mirando abajo— y se empaqueta todo junto: un
 * solo paquete pequeño que se pide al abrir el panel y se suelta al cerrarlo.
 *
 * El retrato NO se vuelve a recortar ni a medir: se copia la definición de la hoja que ya existe,
 * así que es literalmente el mismo pixel que camina por el bosque y no puede desalinearse de él.
 *
 * ⛔ Y LA LISTA SALE DE `rowingRigs`, QUE ES LA ÚNICA LISTA DE AUTORÍA DEL ELENCO. Un duende
 * protagonista necesita su remo MEDIDO a mano (la pala no cae igual en dos hojas distintas), así
 * que esa es la lista que el dueño toca al añadir uno. Que además esté completamente horneado lo
 * decide después el mundo (`data/aventura/world.php`), que es quien mira el manifiesto: un retrato
 * de más pesa unos kilobytes y no se puede enseñar, porque el selector recorre el elenco OFRECIDO.
 */
declare(strict_types=1);
$root = dirname(__DIR__);
$read = static fn(string $file): array => json_decode(
    file_get_contents($file), true, 512, JSON_THROW_ON_ERROR
);
$frames = [];
$cast = array_map('intval', array_keys($read($root . '/data/aventura/player-art.json')['rowingRigs']));
sort($cast);
foreach ($cast as $id) {
    $sheet = $root . "/data/aventura/assets/actor-$id.json";
    if (!is_file($sheet)) {
        throw new RuntimeException("Playable duende without a registered walk sheet: $id");
    }
    $frames["cast-$id"] = $read($sheet)['frames']["person-$id-down"]
        ?? throw new RuntimeException("Playable duende without a resting pose: $id");
}
$file = $root . '/data/aventura/assets/cast-portraits.json';
$json = json_encode(['frames' => $frames], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
if (!is_file($file) || file_get_contents($file) !== $json) {
    file_put_contents($file, $json);
}
echo count($frames) . " cast portraits.\n";
