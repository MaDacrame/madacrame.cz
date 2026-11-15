<?php
require __DIR__ . '/lib.php';
security_headers();
if (!admin_access_ok()) { fail('Přístup z této sítě není povolen.', 403); }
boot_session();

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
$body = [];
if ($method === 'POST' && stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') === 0) {
    $body = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($body)) { fail('Neplatný požadavek.'); }
}
$ip = client_ip();

// --- bez přihlášení ---
if ($action === 'status') {
    out(['ok' => true, 'auth' => is_auth(), 'csrf' => $_SESSION['csrf'], 'setup' => pw_hash_get() === null]);
}
if ($method !== 'POST' && !in_array($action, ['load', 'media', 'backups', 'diag'], true)) { fail('Povolena je pouze metoda POST.', 405); }
if ($method === 'POST' && !csrf_ok()) { fail('Neplatný bezpečnostní token. Obnovte stránku.', 403); }

if ($action === 'setup') {
    if (pw_hash_get() !== null) { fail('Heslo je již nastaveno.', 403); }
    $pw = (string)($body['password'] ?? '');
    if (strlen($pw) < 10) { fail('Heslo musí mít alespoň 10 znaků.'); }
    if (!pw_hash_set($pw)) { fail('Nelze zapsat do soukromé složky: ' . PRIV . ' (zkontrolujte práva uživatele http).', 500); }
    session_regenerate_id(true); $_SESSION['auth'] = true; $_SESSION['csrf'] = bin2hex(random_bytes(32));
    out(['ok' => true, 'csrf' => $_SESSION['csrf']]);
}
if ($action === 'login') {
    $wait = throttle_locked($ip);
    if ($wait) { fail('Příliš mnoho pokusů. Zkuste to znovu za ' . ceil($wait / 60) . ' min.', 429); }
    $h = pw_hash_get();
    $pw = (string)($body['password'] ?? '');
    if ($h !== null && strlen($pw) < 1024 && password_verify($pw, $h)) {
        throttle_clear($ip);
        session_regenerate_id(true); $_SESSION['auth'] = true; $_SESSION['csrf'] = bin2hex(random_bytes(32));
        if (password_needs_rehash($h, PASSWORD_DEFAULT) && !defined('PASSWORD_ARGON2ID')) { pw_hash_set($pw); }
        out(['ok' => true, 'csrf' => $_SESSION['csrf']]);
    }
    throttle_fail($ip); usleep(600000);
    fail('Nesprávné heslo.', 401);
}

// --- vše níže vyžaduje přihlášení ---
if (!is_auth()) { fail('Nejste přihlášeni.', 401); }

switch ($action) {
    case 'logout':
        $_SESSION = []; session_destroy();
        out(['ok' => true]);

    case 'load':
        $res = [];
        foreach (FILES as $n) { $res[$n] = ['data' => read_master($n), 'rev' => rev_of($n)]; }
        out(['ok' => true, 'files' => $res]);

    case 'save':
        $name = (string)($body['file'] ?? ''); assert_name($name);
        read_master($name); // zajistí vytvoření hlavního souboru
        if (($body['rev'] ?? '') !== rev_of($name)) { fail('Obsah mezitím změnil jiný panel nebo okno. Obnovte administraci, abyste nepřepsali novější verzi.', 409); }
        $clean = sanitize($name, $body['data'] ?? null);
        $err = write_content($name, $clean);
        if ($err) { fail($err, 500); }
        out(['ok' => true, 'data' => $clean, 'rev' => rev_of($name)]);

    case 'upload':
        if (empty($_FILES['files'])) { fail('Žádné soubory.'); }
        $f = $_FILES['files']; $res = []; $errs = [];
        $n = is_array($f['name']) ? count($f['name']) : 0;
        for ($i = 0; $i < min($n, 30); $i++) {
            $nm = (string)$f['name'][$i];
            if ($f['error'][$i] !== UPLOAD_ERR_OK) { $errs[] = $nm . ': nahrání selhalo (kód ' . $f['error'][$i] . ', zkontrolujte upload_max_filesize v PHP).'; continue; }
            if ($f['size'][$i] > $CFG['max_upload_mb'] * 1048576) { $errs[] = $nm . ': soubor je větší než ' . $CFG['max_upload_mb'] . ' MB.'; continue; }
            if (!is_uploaded_file($f['tmp_name'][$i])) { $errs[] = $nm . ': neplatné nahrání.'; continue; }
            $r = store_image($f['tmp_name'][$i], $nm);
            if (isset($r['error'])) { $errs[] = $nm . ': ' . $r['error']; } else { $res[] = $r['path']; }
        }
        out(['ok' => true, 'paths' => $res, 'errors' => $errs]);

    case 'media':
        out(['ok' => true, 'media' => list_media()]);

    case 'media_delete':
        $p = (string)($body['path'] ?? '');
        if (!preg_match('#^uploads/([a-z0-9-]+\.(jpg|png|webp))$#', $p, $m) || preg_match('/-sm\./', $m[1])) { fail('Neplatná cesta.'); }
        if (strpos(used_images(), '"' . $p . '"') !== false) { fail('Fotografie se používá v obsahu. Nejprve ji odeberte z kategorie, projektu nebo stránky.', 409); }
        @unlink(UPLOADS . '/' . $m[1]); @unlink(UPLOADS . '/' . thumb_name($m[1]));
        out(['ok' => true]);

    case 'backups':
        $name = (string)($_GET['file'] ?? ''); assert_name($name);
        $list = glob(backup_dir($name) . '/*.json') ?: []; rsort($list);
        $o = [];
        foreach ($list as $f) { $o[] = ['version' => basename($f), 'time' => filemtime($f), 'size' => filesize($f)]; }
        out(['ok' => true, 'backups' => $o]);

    case 'restore':
        $name = (string)($body['file'] ?? ''); assert_name($name);
        $v = (string)($body['version'] ?? '');
        if (!preg_match('/^[0-9]{8}-[0-9]{6}-[0-9a-f]{6}\.json$/', $v) || !is_file(backup_dir($name) . '/' . $v)) { fail('Verze nenalezena.'); }
        $data = json_decode((string)file_get_contents(backup_dir($name) . '/' . $v), true);
        if (!is_array($data)) { fail('Záloha je poškozená.'); }
        $clean = sanitize($name, $data);
        $err = write_content($name, $clean);
        if ($err) { fail($err, 500); }
        out(['ok' => true, 'data' => $clean, 'rev' => rev_of($name)]);

    case 'password':
        $cur = (string)($body['current'] ?? ''); $new = (string)($body['new'] ?? '');
        if (!password_verify($cur, (string)pw_hash_get())) { fail('Současné heslo není správné.', 403); }
        if (strlen($new) < 10) { fail('Nové heslo musí mít alespoň 10 znaků.'); }
        if (!pw_hash_set($new)) { fail('Heslo se nepodařilo uložit.', 500); }
        out(['ok' => true]);

    case 'diag':
        $w = function ($p) { return is_dir($p) ? is_writable($p) : false; };
        out(['ok' => true, 'diag' => [
            'php' => PHP_VERSION, 'php_ok' => version_compare(PHP_VERSION, '7.4.0', '>='),
            'gd' => extension_loaded('gd'), 'webp' => function_exists('imagewebp'), 'finfo' => function_exists('finfo_open'),
            'mbstring' => extension_loaded('mbstring'), 'exif' => function_exists('exif_read_data'),
            'upload_max' => ini_get('upload_max_filesize'), 'post_max' => ini_get('post_max_size'), 'memory' => ini_get('memory_limit'),
            'https' => is_https(), 'ip' => client_ip(), 'private_dir' => PRIV,
            'private_writable' => $w(PRIV), 'content_writable' => $w(ROOT . '/content'), 'uploads_writable' => $w(UPLOADS),
            'private_in_webroot' => strpos(realpath(PRIV) ?: PRIV, ROOT) === 0,
            'allow_public' => $CFG['allow_public'],
        ]]);
}
fail('Neznámá akce.', 404);
