<?php
// Nastavení / reset hesla správce z příkazové řádky (SSH na NAS):
//   php tools/set-password.php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../admin/lib.php';
echo "Nové heslo (min. 10 znaků): ";
$pw = trim((string)fgets(STDIN));
if (strlen($pw) < 10) { fwrite(STDERR, "Příliš krátké.\n"); exit(1); }
if (!pw_hash_set($pw)) { fwrite(STDERR, "Zápis do " . PRIV . " selhal.\n"); exit(1); }
@unlink(PRIV . '/attempts.json');
echo "Heslo nastaveno.\n";
