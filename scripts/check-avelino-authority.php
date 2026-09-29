<?php
declare(strict_types=1);
/** Run from the sibling website: ddev exec php < ../magikitos-game/scripts/check-avelino-authority.php
 * Real SQL authority, LOCAL disposable identity only. No backend source is bundled in the game. */
if (PHP_SAPI !== 'cli' || getenv('IS_DDEV_PROJECT') !== 'true') throw new RuntimeException('Local DDEV only');
require_once getcwd() . '/src/game/adventure-authority.php';
$db = new PDO('mysql:host=db;dbname=db;charset=utf8mb4', 'db', 'db', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$contract = gameDataContract();
$checks = 0; $user = null;
$check = static function (bool $ok, string $why) use (&$checks): void {
    if (!$ok) throw new RuntimeException($why);
    $checks++;
};
try {
    $db->prepare("INSERT INTO users (name, handle, password_hash, newsletter_consent) VALUES ('Local Avelino fixture', ?, '', 0)")
        ->execute(['avelino-test-' . bin2hex(random_bytes(7))]);
    $user = (int)$db->lastInsertId();
    $account = gameAccountGet($db, $user)['account'];
    $body = static function (string $action, string $scene = 'mill', string $entity = 'avelino') use (&$account): stdClass {
        return (object)['scene' => $scene, 'entity' => $entity, 'action' => $action,
            'operationId' => bin2hex(random_bytes(16)), 'baseRevision' => $account['revision']];
    };
    $act = static function (stdClass $command) use ($db, $user, $contract, &$account): array {
        $result = gameAction($db, $user, $command, $contract);
        $account = $result['account']; return $result;
    };
    $reject = static function (stdClass $command, string $code) use ($act, $check): void {
        try { $act($command); throw new RuntimeException('Accepted an unearned action'); }
        catch (GameApiFailure $e) { $check($e->status === 409 && $e->getMessage() === $code, 'Rejects ' . $code); }
    };
    $reject($body('solveMemory'), 'requirements_not_met');
    $reject($body('interact', 'river-willows', 'mill-chest'), 'no_material_action');
    $reject($body('interact', 'overworld', 'picnic-neighbor'), 'no_material_action');
    $check(empty($account['inventory']->oars), 'Greeting Brizno cannot grant oars');
    $act($body('interact'));
    $check($account['progress']->flags->avelinoMet === true, 'Meeting persists');
    foreach (['mushroom', 'twig', 'shell', 'fern'] as $pair) {
        $reject($body('solveMemory'), 'requirements_not_met');
        $command = $body('pair-' . $pair);
        $act($command); $revision = $account['revision'];
        $retry = $act($command);
        $check($retry['replayed'] && $account['revision'] === $revision, 'Lost acknowledgement does not duplicate a pair');
    }
    $command = $body('solveMemory'); $act($command);
    $check($account['inventory']->millKey === 1 && $account['progress']->flags->avelinoMemorySolved === true, 'Earned key and completion are atomic');
    $revision = $account['revision']; $retry = $act($command);
    $check($retry['replayed'] && $account['revision'] === $revision && $account['inventory']->millKey === 1, 'Lost key acknowledgement is idempotent');
    $reject($body('solveMemory'), 'requirements_not_met');
    // A queued action from before the move keeps its original address and receipt.
    $command = $body('interact', 'overworld', 'mill-chest');
    $act($command); $revision = $account['revision']; $retry = $act($command);
    $check($retry['replayed'] && $account['revision'] === $revision, 'Old chest action and lost acknowledgement survive the move');
    $check($account['progress']->flags->avelinoChestOpened === true && $account['inventory']->millKey === 1, 'Chest opens and preserves the key');
    $check($account['inventory']->oars === 1 && $account['progress']->flags->oarsReceived, 'The chest is the unique oar reward');
    $reject($body('interact', 'river-willows', 'mill-chest'), 'no_material_action');
    $act($body('interact','overworld','picnic-knife'));
    $act($body('interact','overworld','picnic-bin'));
    $act($body('craft','overworld','river-dock'));
    $check($account['inventory']->boat === 1 && empty($account['progress']->flags->picnicSkewerShared), 'Boat can be built without the optional skewer');
    $reject($body('share','overworld','picnic-neighbor'), 'requirements_not_met');
    $reject($body('grill','overworld','picnic-barbecue'), 'requirements_not_met');
    foreach (['picnic-lighter','picnic-twig','forest-mushrooms-fern'] as $entity) $act($body('interact','overworld',$entity));
    $act($body('light','overworld','picnic-barbecue'));
    $command=$body('grill','overworld','picnic-barbecue'); $act($command); $revision=$account['revision'];
    $check($account['inventory']->skewer === 1 && $account['inventory']->mushroom === 1 && empty($account['inventory']->twig), 'Grill atomically uses exactly two mushrooms and a twig');
    $check($act($command)['replayed'] && $account['revision']===$revision, 'Lost grill acknowledgement does not consume twice');
    $command=$body('share','overworld','picnic-neighbor'); $act($command); $revision=$account['revision'];
    $check(empty($account['inventory']->skewer) && $account['progress']->flags->picnicSkewerShared, 'Shared skewer persists, with no inventory reward');
    $check($act($command)['replayed'] && $account['revision']===$revision, 'Lost share acknowledgement is idempotent');
    $reject($body('share','overworld','picnic-neighbor'), 'requirements_not_met');
    $reject($body('cook','overworld','picnic-barbecue'), 'requirements_not_met');
    $reject($body('give','overworld','picnic-neighbor'), 'requirements_not_met');
    $check(empty($account['progress']->timers->picnic) && $account['setines']===0, 'No old meal timer or currency reward');
    // A player who opened the former note-only chest can collect its new contents.
    $db->prepare("UPDATE game_accounts SET inventory_json=JSON_REMOVE(inventory_json,'$.oars') WHERE user_id=?")->execute([$user]);
    $account=gameAccountGet($db,$user)['account'];
    $act($body('interact','river-willows','mill-chest'));
    $check($account['inventory']->oars===1 && $account['inventory']->boat===1, 'Old opened chest recovers oars without touching the boat');
    $reject($body('interact','river-willows','mill-chest'),'no_material_action');
    // Earlier Brizno recipients may later solve Avelino: their oars never overflow.
    $db->prepare("UPDATE game_accounts SET progress_json=JSON_REMOVE(progress_json,'$.flags.avelinoChestOpened') WHERE user_id=?")->execute([$user]);
    $account=gameAccountGet($db,$user)['account'];
    $act($body('interact','river-willows','mill-chest'));
    $check($account['inventory']->oars===1 && $account['inventory']->millKey===1, 'Existing oars and reusable key survive first chest opening');
    $fresh = gameAccountGet($db, $user)['account'];
    $check(gameJson($fresh) === gameJson($account), 'Another device reads all persisted progress');
    $check($fresh['setines'] === 0, 'Puzzle never mints construction currency');
} finally {
    if ($db->inTransaction()) $db->rollBack();
    if ($user) {
        $db->prepare('DELETE FROM game_accounts WHERE user_id=?')->execute([$user]);
        $db->prepare("DELETE FROM users WHERE id=? AND name='Local Avelino fixture'")->execute([$user]);
    }
}
echo "PASS Avelino SQL authority: $checks gates, persistent pairs/key/chest, duplicate receipts, cross-device read; fixture removed.\n";
