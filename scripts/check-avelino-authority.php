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
    $reject($body('interact', 'overworld', 'mill-chest'), 'no_material_action');
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
    $act($body('interact', 'overworld', 'mill-chest'));
    $check($account['progress']->flags->avelinoChestOpened === true && $account['inventory']->millKey === 1, 'Chest opens and preserves the key');
    $reject($body('interact', 'overworld', 'mill-chest'), 'no_material_action');
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
