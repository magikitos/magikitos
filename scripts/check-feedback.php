<?php
/** Private service integration, no network or real email. */
declare(strict_types=1);
$service = dirname(__DIR__, 2) . '/magikitos/src/world-feedback.php';
if (!is_file($service)) { echo "SKIP feedback service: no sibling website checkout\n"; exit; }
require $service;
function check(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
function rejects(callable $action, int $status): void {
    try { $action(); } catch (WorldFeedbackError $e) { check($e->status === $status, 'Expected status ' . $status . ', got ' . $e->status); return; }
    throw new RuntimeException('Expected rejection ' . $status);
}
$body = (object)['text' => "  Una idea <script>alert(1)</script>\n¡Más misterios!  ", 'lang' => 'es',
    'operationId' => 'd09a8d2f-9286-4a9d-bca4-724c24fdd600', 'turnstile_token' => 'fresh-test-token'];
foreach (['text' => '', 'lang' => 'xx', 'operationId' => '../oops'] as $key => $value) {
    $bad = clone $body; $bad->$key = $value; rejects(fn() => worldFeedbackInput($bad), 400);
}
foreach (['', str_repeat('x', 2049)] as $token) {
    $bad = clone $body; $bad->turnstile_token = $token; rejects(fn() => worldFeedbackInput($bad), 403);
}
$bad = clone $body; $bad->to = 'attacker@example.test'; rejects(fn() => worldFeedbackInput($bad), 400);
$bad = clone $body; unset($bad->turnstile_token); rejects(fn() => worldFeedbackInput($bad), 403);
foreach ([str_repeat('x',2001), "abc\0xyz", "\xFFbad"] as $text) {
    $bad = clone $body; $bad->text = $text; rejects(fn() => worldFeedbackInput($bad), 400);
}
foreach ([null, [], ['error-codes'=>['internal-error']]] as $proof) rejects(fn() => worldFeedbackProofResult($proof), 503);
foreach ([['success'=>false], ['success'=>true,'hostname'=>'attacker.test','action'=>'game_feedback'],
    ['success'=>true,'hostname'=>'magikitos.com','action'=>'identity'], ['success'=>true,'hostname'=>'magikitos.com']] as $proof)
    rejects(fn() => worldFeedbackProofResult($proof), 403);
worldFeedbackProofResult(['success'=>true,'hostname'=>'magikitos.com','action'=>'game_feedback']);
$_ENV['TURNSTILE_SECRET_KEY'] = ''; $_ENV['TURNSTILE_SITE_KEY'] = '';
rejects(fn() => worldFeedbackProof('test'), 503);
$dir = sys_get_temp_dir() . '/magikitos-feedback-' . bin2hex(random_bytes(8)); mkdir($dir,0700);
try {
    $count = 0; $verifications = 0;
    $verify = function(string $token) use (&$verifications): void { check($token === 'fresh-test-token','Fresh token required'); $verifications++; };
    $mail = function($to, $subject, $html) use (&$count): string {
        check($to === 'alvaro.nicolas.franz.orozco@gmail.com','Fixed recipient');
        check($subject === 'Magikitos: feedback del juego','Fixed subject');
        check(str_contains($html,'&lt;script&gt;') && !str_contains($html,'<script>'),'Feedback is escaped text');
        $count++; return 'accepted-message';
    };
    $input = worldFeedbackInput($body);
    rejects(fn() => worldFeedbackSend($input,$dir,fn() => throw new WorldFeedbackError('turnstile_failed',403),$mail),403);
    check($count === 0 && count(glob($dir.'/*')) === 0,'Proof failure neither sends nor writes a receipt');
    rejects(fn() => worldFeedbackSend($input,$dir,$verify,fn() => null),503);
    check(worldFeedbackSend($input,$dir,$verify,$mail)['sent'] === true,'Successful mail acknowledged');
    check(worldFeedbackSend($input,$dir,$verify,$mail)['sent'] === true,'Lost-ack retry acknowledged');
    check($count === 1 && $verifications === 3,'Retries never duplicate email; every attempt verifies proof');
    $changed = $input; $changed['text'] = 'Edited';
    rejects(fn() => worldFeedbackSend($changed,$dir,$verify,$mail),409);
    $receipt = file_get_contents(glob($dir.'/*')[0]);
    check(!str_contains($receipt,'fresh-test-token') && !str_contains($receipt,'Una idea') && !str_contains($receipt,'@'),'Receipt contains no message or personal information');
} finally { foreach (glob($dir.'/*') ?: [] as $file) unlink($file); rmdir($dir); }
echo "PASS feedback: strict proof/action/hostname/config, input limits, fixed escaped email, transport failure, retry deduplication and private receipts; no email sent.\n";
