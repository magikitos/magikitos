<?php
declare(strict_types=1);
require __DIR__ . '/lib/adventure-actor-registration.php';
function check(bool $condition, string $label): void {
    if (!$condition) throw new RuntimeException($label);
}
function rejects(callable $test, string $expected): void {
    try { $test(); } catch (RuntimeException $error) {
        check(str_contains($error->getMessage(), $expected), $error->getMessage()); return;
    }
    throw new RuntimeException("Missing rejection: $expected");
}
$defaults = ['canvas' => [48, 48], 'anchor' => [24, 46]];
$base = ['id' => 'standing', 'grid' => [1, 1], 'height' => 40, 'variant' => 100, 'action' => 'walk', 'directions' => ['down']];
$cell = [[0, 0, 200, 200]];
$ref = adventureRegisterActor($base, $defaults, $cell, [[70, 20, 60, 160]], null);
$pose = $base;
$pose['id'] = 'running'; $pose['reference'] = 'standing'; $pose['action'] = 'run';
$action = adventureRegisterActor($pose, $defaults, $cell, [[60, 10, 80, 176]], $ref['measurement']);
check($action['measurement']['ratio'] === $ref['measurement']['ratio'], 'Running must borrow standing scale, not normalize a long stride');
check(abs($action['poses']['person-100-down-run-0']['support'] - 46) < 0.0001, 'Foot line is shared');
$aligned = adventureRegisterActor($pose + ['horizontalOffsets'=>['down'=>2.5]], $defaults, $cell, [[60, 10, 80, 176]], $ref['measurement']);
$before = $action['frames']['person-100-down-run-0'];
$after = $aligned['frames']['person-100-down-run-0'];
check($after['registration']['offset'][0] === $before['registration']['offset'][0] + 2.5, 'Reviewed body alignment is baked into registration');
check($after['registration']['offset'][1] === $before['registration']['offset'][1]
    && $after['registration']['scale'] === $before['registration']['scale']
    && $after['anchor'] === $before['anchor'], 'Body alignment cannot move the feet, scale or world anchor');
foreach ([['left'=>1], ['down'=>'2'], ['down'=>INF], ['down'=>[2,0]]] as $invalid)
    rejects(fn() => adventureRegisterActor($pose + ['horizontalOffsets'=>$invalid], $defaults, $cell, [[60,10,80,176]], $ref['measurement']), 'horizontal alignment');
rejects(fn() => adventureRegisterActor($pose + ['horizontalOffsets'=>['down'=>48]], $defaults, $cell, [[60,10,80,176]], $ref['measurement']), 'clipped');
rejects(fn() => adventureRegisterActor($pose, $defaults, $cell, [[60, 10, 80, 176]], null), 'Missing standing reference');
$carried = array_replace($pose, ['action' => 'carried', 'canvas' => [48, 50], 'anchor' => [24, 4], 'registrationPoint' => 'top']);
$hanging = adventureRegisterActor($carried, $defaults, $cell, [[55, 20, 90, 100]], $ref['measurement']);
$frame = $hanging['frames']['person-100-down-carried-0'];
check($frame['size'] === [48, 50] && $frame['anchor'] === [24, 4], 'Sheet-specific canvas and mouth attachment survive registration');
check($hanging['poses']['person-100-down-carried-0']['support'] === 4.0, 'Hanging body registers at its top, not dangling feet');
rejects(fn() => adventureRegisterActor(array_replace($carried, ['canvas' => [48, 20]]), $defaults, $cell, [[55, 20, 90, 100]], $ref['measurement']), 'clipped');
rejects(fn() => adventureRegisterActor($pose + ['strictMargins' => true], $defaults, $cell, [[60, 0, 80, 176]], $ref['measurement']), 'cell edge');
$rower = array_replace($pose, ['action' => 'row', 'canvas' => [64, 56], 'anchor' => [32, 40],
    'registrationPoint' => 'seat', 'sourceSeatAnchors' => [[[90, 145]]]]);
$seated = adventureRegisterActor($rower, $defaults, $cell, [[55, 20, 90, 145]], $ref['measurement']);
check($seated['poses']['person-100-down-row-0']['seat'] === [32.0, 40.0], 'Pelvis, not moving boots, registers to vessel seat');
check($seated['poses']['person-100-down-row-0']['ink'][1] + $seated['poses']['person-100-down-row-0']['ink'][3] > 40,
    'Boots may extend below the seat');
rejects(fn() => adventureRegisterActor(array_replace($rower, ['sourceSeatAnchors' => []]), $defaults, $cell, [[55, 20, 90, 145]], $ref['measurement']), 'Missing measured seat');
rejects(fn() => adventureRegisterActor(array_replace($rower, ['sourceSeatAnchors' => [[[201, 145]]]]), $defaults, $cell, [[55, 20, 90, 145]], $ref['measurement']), 'Invalid measured seat');
check(array_column(adventureActorDependencies([$pose, $base], 'running'), 'id') === ['standing', 'running'], '--sheet walks dependencies in order');
$source = adventureClearCanvas(200, 200);
imagefilledrectangle($source, 55, 20, 144, 164, imagecolorallocatealpha($source, 180, 140, 90, 0));
$uneven = $rower + ['sourceRects' => [[[40, 10, 120, 170]]], 'sourceCellWidth' => 200];
$uneven['sourceSeatAnchors'] = [[[50, 135]]];
[$rectCells, $rectBounds] = adventureActorCells($source, $uneven);
$cropped = adventureRegisterActor($uneven, $defaults, $rectCells, $rectBounds, $ref['measurement']);
check($cropped['frames']['person-100-down-row-0']['rect'] === [40, 10, 120, 170], 'Measured source rect reaches production baker');
check($cropped['poses'] === $seated['poses'], 'Uneven crop must not change character size or pelvis placement');
$fragmentSource = adventureClearCanvas(40, 40);
$ink = imagecolorallocatealpha($fragmentSource, 180, 140, 90, 0);
imagefilledrectangle($fragmentSource, 10, 10, 29, 29, $ink);
imagesetpixel($fragmentSource, 3, 3, $ink);
$isolated = adventurePreparedSpriteCell($fragmentSource, [0, 0, 40, 40], ['cleanFragments' => .015]);
check(((imagecolorat($isolated, 3, 3) >> 24) & 127) === 127, 'Review and baker remove isolated debris before reduction');
check(imagecolorat($isolated, 20, 20) === $ink, 'Connected original art remains unchanged');
check(imagecolorat($fragmentSource, 3, 3) === $ink, 'Source image remains untouched');
foreach ([[], [[[40, 10, 120]]], [[[40, 10, 200, 170]]], [[[40.5, 10, 120, 170]]], [[]]] as $invalid)
    rejects(fn() => adventureActorCells($source, array_replace($uneven, ['sourceRects' => $invalid])), 'actor');
rejects(fn() => adventureActorDependencies([$pose], 'running'), 'Unknown actor sheet');
rejects(fn() => adventureActorDependencies([$pose, $base + ['reference' => 'running']], null), 'Cyclic');
rejects(fn() => adventureActorDependencies([$base, $base], null), 'Duplicate');
$patch = $pose;
$patch['id'] = 'running-side'; $patch['overrideOf'] = 'running';
check(array_column(adventureActorDependencies([$patch, $base, $pose], 'running'), 'id') === ['standing', 'running', 'running-side'],
    'Selected build includes directional corrections after the base');
$unchanged = ['down' => ['source' => 'approved'], 'right' => ['source' => 'old']];
$changed = adventureActorOverride($unchanged, ['right' => ['source' => 'corrected']]);
check($changed['down'] === $unchanged['down'] && $changed['right']['source'] === 'corrected', 'Patch preserves approved directions exactly');
rejects(fn() => adventureActorOverride($unchanged, ['diagonal-typo' => []]), 'Unknown actor override');
rejects(fn() => adventureActorOverride($unchanged, []), 'Unknown actor override');
echo "PASS: standing-reference scale, support line, hanging registration, per-sheet canvas, clipping, cell margins and selected-build dependencies.\n";
