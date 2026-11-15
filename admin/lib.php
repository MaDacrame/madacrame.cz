<?php
// Společné funkce administrace. Kompatibilní s PHP 7.4+ (žádná syntaxe z PHP 8).
define('ROOT', realpath(__DIR__ . '/..'));
$CFG = require __DIR__ . '/config.php';
define('PRIV', $CFG['private_dir'] ? rtrim($CFG['private_dir'], '/') : dirname(ROOT) . '/madacrame-private');
define('UPLOADS', ROOT . '/uploads');
const FILES = ['site', 'sections', 'projects', 'pages'];

function ensure_dir($d) { if (!is_dir($d)) { @mkdir($d, 0770, true); } return is_dir($d) && is_writable($d); }

/* ---------- přístup ---------- */
function norm_ip($ip) {
    if (stripos($ip, '::ffff:') === 0 && strpos($ip, '.') !== false) { return substr($ip, 7); }
    return $ip;
}
function ip_in($ip, $cidr) {
    $parts = explode('/', $cidr);
    $a = @inet_pton($ip); $b = @inet_pton($parts[0]);
    if ($a === false || $b === false || strlen($a) !== strlen($b)) { return false; }
    $bits = isset($parts[1]) ? (int)$parts[1] : strlen($a) * 8;
    $bytes = intdiv($bits, 8);
    if ($bytes && substr($a, 0, $bytes) !== substr($b, 0, $bytes)) { return false; }
    $rem = $bits % 8;
    if ($rem) {
        $mask = (0xFF << (8 - $rem)) & 0xFF;
        if ((ord($a[$bytes]) & $mask) !== (ord($b[$bytes]) & $mask)) { return false; }
    }
    return true;
}
function ip_allowed($ip) {
    global $CFG;
    foreach ($CFG['allowed_nets'] as $net) { if (ip_in(norm_ip($ip), $net)) { return true; } }
    return false;
}
function client_ip() { return norm_ip($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'); }
function admin_access_ok() {
    global $CFG;
    if ($CFG['allow_public']) { return true; }
    if (!ip_allowed(client_ip())) { return false; }
    // Obrana do hloubky: pokud požadavek prošel proxy a hlásí cizí adresu, odmítnout.
    foreach (['HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'HTTP_CF_CONNECTING_IP', 'HTTP_FORWARDED'] as $h) {
        if (empty($_SERVER[$h])) { continue; }
        preg_match_all('/[0-9a-fA-F:.]{3,45}/', $_SERVER[$h], $m);
        foreach ($m[0] as $ip) { if (@inet_pton($ip) !== false && !ip_allowed($ip)) { return false; } }
    }
    return true;
}
function is_https() { return !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'; }
function security_headers() {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    header("Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex, nofollow');
}

/* ---------- session + CSRF ---------- */
function boot_session() {
    global $CFG;
    $dir = PRIV . '/sessions';
    ensure_dir($dir);
    if (is_dir($dir) && is_writable($dir)) { session_save_path($dir); }
    session_name('mdc_admin');
    $base = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/') . '/';
    session_set_cookie_params(['lifetime' => 0, 'path' => $base, 'secure' => is_https(), 'httponly' => true, 'samesite' => 'Strict']);
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', (string)($CFG['session_minutes'] * 60));
    session_start();
    if (isset($_SESSION['last']) && time() - $_SESSION['last'] > $CFG['session_minutes'] * 60) {
        $_SESSION = []; session_regenerate_id(true);
    }
    $_SESSION['last'] = time();
    if (empty($_SESSION['csrf'])) { $_SESSION['csrf'] = bin2hex(random_bytes(32)); }
}
function is_auth() { return !empty($_SESSION['auth']); }
function csrf_ok() {
    $t = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    return is_string($t) && $t !== '' && hash_equals($_SESSION['csrf'] ?? '', $t);
}
function out($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function fail($msg, $code = 400) { out(['ok' => false, 'error' => $msg], $code); }

/* ---------- heslo + omezení pokusů ---------- */
function pw_file() { return PRIV . '/admin.json'; }
function pw_hash_get() {
    $j = @json_decode((string)@file_get_contents(pw_file()), true);
    return is_array($j) && !empty($j['hash']) ? $j['hash'] : null;
}
function pw_hash_set($password) {
    if (!ensure_dir(PRIV)) { return false; }
    $algo = defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT;
    $h = @password_hash($password, $algo, defined('PASSWORD_ARGON2ID') ? ['memory_cost' => 16384, 'time_cost' => 3, 'threads' => 1] : []);
    if (!$h) { $h = password_hash($password, PASSWORD_DEFAULT); }
    return atomic_write(pw_file(), json_encode(['hash' => $h, 'changed' => date('c')]), 0660);
}
function throttle_load() {
    $j = @json_decode((string)@file_get_contents(PRIV . '/attempts.json'), true);
    return is_array($j) ? $j : [];
}
function throttle_save($a) { atomic_write(PRIV . '/attempts.json', json_encode($a), 0660); }
function throttle_locked($ip) {
    $a = throttle_load();
    return isset($a[$ip]['until']) && $a[$ip]['until'] > time() ? $a[$ip]['until'] - time() : 0;
}
function throttle_fail($ip) {
    global $CFG;
    $a = throttle_load(); $now = time();
    foreach ($a as $k => $v) { if (($v['last'] ?? 0) < $now - 86400) { unset($a[$k]); } }
    $e = $a[$ip] ?? ['n' => 0];
    $e['n']++; $e['last'] = $now;
    if ($e['n'] >= $CFG['login_max_fails']) { $e['until'] = $now + $CFG['login_lock_min'] * 60; $e['n'] = 0; }
    $a[$ip] = $e; throttle_save($a);
}
function throttle_clear($ip) { $a = throttle_load(); unset($a[$ip]); throttle_save($a); }

/* ---------- soubory ---------- */
function atomic_write($path, $content, $mode = 0664) {
    $tmp = $path . '.tmp' . bin2hex(random_bytes(4));
    if (@file_put_contents($tmp, $content, LOCK_EX) === false) { @unlink($tmp); return false; }
    @chmod($tmp, $mode);
    if (!@rename($tmp, $path)) { @unlink($tmp); return false; }
    return true;
}
function master_path($name) { return PRIV . '/data/' . $name . '.json'; }
function public_path($name) { return ROOT . '/content/' . $name . '.json'; }
function with_lock($fn) {
    ensure_dir(PRIV);
    $fh = fopen(PRIV . '/lock', 'c');
    if (!$fh) { fail('Nelze získat zámek zápisu (zkontrolujte práva soukromé složky).', 500); }
    flock($fh, LOCK_EX);
    try { return $fn(); } finally { flock($fh, LOCK_UN); fclose($fh); }
}
function assert_name($name) { if (!in_array($name, FILES, true)) { fail('Neznámý soubor.'); } }
// Hlavní (plná) data žijí v soukromé složce; při prvním použití se zkopírují z veřejného webu.
function read_master($name) {
    $p = master_path($name);
    if (!is_file($p)) {
        ensure_dir(PRIV . '/data');
        $src = @file_get_contents(public_path($name));
        if ($src === false) { return []; }
        @atomic_write($p, $src, 0660);
    }
    $j = json_decode((string)file_get_contents($p), true);
    return is_array($j) ? $j : [];
}
function rev_of($name) { return is_file(master_path($name)) ? md5_file(master_path($name)) : md5(''); }
function backup_dir($name) { return PRIV . '/backups/' . $name; }
function backup_current($name) {
    global $CFG;
    $p = master_path($name);
    if (!is_file($p)) { return; }
    $d = backup_dir($name);
    if (!ensure_dir($d)) { return; }
    @copy($p, $d . '/' . date('Ymd-His') . '-' . substr(md5_file($p), 0, 6) . '.json');
    $all = glob($d . '/*.json'); sort($all);
    while (count($all) > $CFG['keep_backups']) { @unlink(array_shift($all)); }
}
function public_view($name, $data) {
    if ($name === 'site') { return $data; }
    return array_values(array_filter($data, function ($x) { return ($x['visible'] ?? true) !== false; }));
}
function write_content($name, $data) {
    return with_lock(function () use ($name, $data) {
        ensure_dir(PRIV . '/data');
        backup_current($name);
        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        if (!atomic_write(master_path($name), $json, 0660)) { return 'Nepodařilo se uložit data (práva soukromé složky).'; }
        $pub = json_encode(public_view($name, $data), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        if (!atomic_write(public_path($name), $pub, 0664)) { return 'Data uložena, ale nepodařilo se publikovat do složky content (práva).'; }
        return null;
    });
}

/* ---------- validace obsahu ---------- */
function utf_cut($s, $max) {
    return function_exists('mb_substr') ? mb_substr($s, 0, $max, 'UTF-8') : substr($s, 0, $max);
}
function s_text($v, $max = 300) {
    if (!is_string($v)) { return ''; }
    $v = str_replace("\r", '', $v);
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $v);
    return utf_cut(trim($v), $max);
}
function s_slug($s) {
    $map = ['á'=>'a','č'=>'c','ď'=>'d','é'=>'e','ě'=>'e','í'=>'i','ň'=>'n','ó'=>'o','ř'=>'r','š'=>'s','ť'=>'t','ú'=>'u','ů'=>'u','ý'=>'y','ž'=>'z','ä'=>'a','ö'=>'o','ü'=>'u'];
    $s = function_exists('mb_strtolower') ? mb_strtolower($s, 'UTF-8') : strtolower($s);
    $s = preg_replace('/[^a-z0-9]+/', '-', strtr($s, $map));
    return trim(substr(trim($s, '-'), 0, 60), '-');
}
function s_img($v) {
    if (!is_string($v) || $v === '') { return ''; }
    return preg_match('#^(uploads|assets/visuals)/[A-Za-z0-9][A-Za-z0-9._-]*$#', $v) && strpos($v, '..') === false ? $v : '';
}
function s_url($v) { return is_string($v) && preg_match('#^https?://[^\s<>"\']+$#i', trim($v)) ? trim($v) : ''; }
function s_list($v, $max = 300, $limit = 60) {
    $o = [];
    if (is_array($v)) { foreach ($v as $x) { $t = s_text($x, $max); if ($t !== '') { $o[] = $t; } if (count($o) >= $limit) { break; } } }
    return $o;
}
function s_gallery($v) {
    $o = [];
    if (is_array($v)) { foreach ($v as $g) {
        if (!is_array($g)) { continue; }
        $src = s_img($g['src'] ?? '');
        if ($src !== '') { $o[] = ['src' => $src, 'caption' => s_text($g['caption'] ?? '', 200)]; }
        if (count($o) >= 100) { break; }
    } }
    return $o;
}
function s_bool($v) { return $v === false || $v === 'false' || $v === 0 || $v === '0' ? false : true; }
function s_items($v, $limit, $fn) {
    if (!is_array($v)) { fail('Neplatná data.'); }
    $out = []; $ids = [];
    foreach (array_values($v) as $x) {
        if (!is_array($x)) { continue; }
        $it = $fn($x);
        $base = $it['id'] !== '' ? $it['id'] : s_slug($it['title']);
        if ($base === '') { $base = 'polozka'; }
        $id = $base; $n = 2;
        while (isset($ids[$id])) { $id = $base . '-' . $n++; }
        $it['id'] = $id; $ids[$id] = 1; $out[] = $it;
        if (count($out) >= $limit) { break; }
    }
    return $out;
}
function sanitize($name, $d) {
    if ($name === 'site') {
        if (!is_array($d)) { fail('Neplatná data.'); }
        $short = ['brand','eyebrow','headline','manifesto_title','about_title','contact_title','instagram_label','facebook_label','location_note','footer_note','about_page_title','projects_title','phone'];
        $long = ['intro','manifesto_text','about_text','contact_text','projects_text'];
        $o = [];
        foreach ($short as $k) { $o[$k] = s_text($d[$k] ?? '', 200); }
        foreach ($long as $k) { $o[$k] = s_text($d[$k] ?? '', 1500); }
        $o['hero_image'] = s_img($d['hero_image'] ?? '') ?: 'assets/visuals/hero.svg';
        $em = trim((string)($d['email'] ?? ''));
        $o['email'] = filter_var($em, FILTER_VALIDATE_EMAIL) ? $em : '';
        $o['instagram'] = s_url($d['instagram'] ?? '');
        $o['facebook'] = s_url($d['facebook'] ?? '');
        $o['about_page_body'] = s_list($d['about_page_body'] ?? [], 3000, 20);
        return $o;
    }
    if ($name === 'sections') {
        return s_items($d, 50, function ($x) {
            return ['id' => s_slug($x['id'] ?? ''), 'title' => s_text($x['title'] ?? '', 120), 'kicker' => s_text($x['kicker'] ?? '', 60),
                'description' => s_text($x['description'] ?? '', 400), 'intro' => s_text($x['intro'] ?? '', 1500),
                'body' => s_list($x['body'] ?? [], 4000, 30), 'image' => s_img($x['image'] ?? ''), 'gallery' => s_gallery($x['gallery'] ?? []),
                'owner' => s_text($x['owner'] ?? '', 80), 'visible' => s_bool($x['visible'] ?? true), 'features' => s_list($x['features'] ?? [], 200, 40)];
        });
    }
    if ($name === 'projects') {
        return s_items($d, 500, function ($x) {
            return ['id' => s_slug($x['id'] ?? ''), 'title' => s_text($x['title'] ?? '', 160), 'category' => s_slug($x['category'] ?? ''),
                'description' => s_text($x['description'] ?? '', 600), 'image' => s_img($x['image'] ?? ''),
                'paragraphs' => s_list($x['paragraphs'] ?? [], 6000, 80), 'gallery' => s_gallery($x['gallery'] ?? []),
                'visible' => s_bool($x['visible'] ?? true), 'placeholder' => !empty($x['placeholder']) && $x['placeholder'] !== 'false'];
        });
    }
    return s_items($d, 100, function ($x) { // pages
        return ['id' => s_slug($x['id'] ?? ''), 'title' => s_text($x['title'] ?? '', 120), 'kicker' => s_text($x['kicker'] ?? '', 60),
            'intro' => s_text($x['intro'] ?? '', 800), 'image' => s_img($x['image'] ?? ''), 'body' => s_list($x['body'] ?? [], 6000, 80),
            'gallery' => s_gallery($x['gallery'] ?? []), 'visible' => s_bool($x['visible'] ?? true)];
    });
}

/* ---------- fotografie ---------- */
function thumb_name($file) { return preg_replace('/(\.[a-z]+)$/', '-sm$1', $file); }
function used_images() {
    $all = '';
    foreach (FILES as $n) { $all .= json_encode(read_master($n), JSON_UNESCAPED_SLASHES); }
    return $all;
}
function gd_save($im, $mime, $path, $q) {
    if ($mime === 'image/jpeg') { return imagejpeg($im, $path, $q); }
    if ($mime === 'image/png') { return imagepng($im, $path, 7); }
    return imagewebp($im, $path, $q);
}
function gd_load($tmp, $mime) {
    if ($mime === 'image/jpeg') { return @imagecreatefromjpeg($tmp); }
    if ($mime === 'image/png') { return @imagecreatefrompng($tmp); }
    return function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($tmp) : false;
}
function gd_resize($im, $max) {
    $w = imagesx($im); $h = imagesy($im);
    if (max($w, $h) <= $max) { return $im; }
    $r = $max / max($w, $h);
    $nw = max(1, (int)round($w * $r)); $nh = max(1, (int)round($h * $r));
    $n = imagecreatetruecolor($nw, $nh);
    imagealphablending($n, false); imagesavealpha($n, true);
    imagefill($n, 0, 0, imagecolorallocatealpha($n, 0, 0, 0, 127));
    imagecopyresampled($n, $im, 0, 0, 0, 0, $nw, $nh, $w, $h);
    imagedestroy($im);
    return $n;
}
function store_image($tmp, $origName) {
    global $CFG;
    if (!ensure_dir(UPLOADS)) { return ['error' => 'Složka uploads není zapisovatelná.']; }
    $info = @getimagesize($tmp);
    $types = [IMAGETYPE_JPEG => ['image/jpeg', 'jpg'], IMAGETYPE_PNG => ['image/png', 'png'], IMAGETYPE_WEBP => ['image/webp', 'webp']];
    if (!$info || !isset($types[$info[2]])) { return ['error' => 'Nepodporovaný typ souboru (povoleno JPG, PNG, WEBP).']; }
    list($mime, $ext) = $types[$info[2]];
    if (function_exists('finfo_open')) {
        $fi = finfo_open(FILEINFO_MIME_TYPE); $real = finfo_file($fi, $tmp); finfo_close($fi);
        if ($real !== $mime) { return ['error' => 'Obsah souboru neodpovídá obrázku.']; }
    }
    if ($info[0] * $info[1] > 40000000) { return ['error' => 'Obrázek má příliš mnoho pixelů (max. 40 Mpx).']; }
    $base = s_slug(pathinfo($origName, PATHINFO_FILENAME));
    $base = ($base !== '' ? substr($base, 0, 30) : 'foto') . '-' . bin2hex(random_bytes(3));
    $file = $base . '.' . $ext; $thumb = thumb_name($file);
    $dest = UPLOADS . '/' . $file; $destT = UPLOADS . '/' . $thumb;
    $done = false;
    if (extension_loaded('gd')) {
        @ini_set('memory_limit', '256M');
        $im = gd_load($tmp, $mime);
        if ($im) {
            if ($mime === 'image/jpeg' && function_exists('exif_read_data')) {
                $ex = @exif_read_data($tmp);
                $o = $ex['Orientation'] ?? 1;
                $deg = [3 => 180, 6 => -90, 8 => 90][$o] ?? 0;
                if ($deg) { $r = imagerotate($im, $deg, 0); if ($r) { imagedestroy($im); $im = $r; } }
            }
            if ($mime === 'image/png') { imagealphablending($im, false); imagesavealpha($im, true); }
            $im = gd_resize($im, $CFG['max_image_px']);
            $ok = gd_save($im, $mime, $dest, $CFG['jpeg_quality']);
            $th = gd_resize($im, $CFG['thumb_px']);
            $ok = $ok && gd_save($th, $mime, $destT, 80);
            if ($th !== $im) { imagedestroy($th); }
            imagedestroy($im);
            $done = $ok;
        }
    }
    if (!$done) { // bez GD: uložit ověřený originál
        if (!@copy($tmp, $dest) || !@copy($tmp, $destT)) { return ['error' => 'Soubor se nepodařilo uložit.']; }
    }
    @chmod($dest, 0664); @chmod($destT, 0664);
    return ['path' => 'uploads/' . $file];
}
function list_media() {
    $o = []; $used = used_images();
    foreach (@scandir(UPLOADS) ?: [] as $b) {
        $f = UPLOADS . '/' . $b;
        if (!preg_match('/^[a-z0-9-]+\.(jpg|png|webp)$/', $b)) { continue; }
        if (preg_match('/-sm\.[a-z]+$/', $b)) { continue; }
        $sz = @getimagesize($f);
        $o[] = ['path' => 'uploads/' . $b, 'thumb' => 'uploads/' . (is_file(UPLOADS . '/' . thumb_name($b)) ? thumb_name($b) : $b),
            'size' => filesize($f), 'w' => $sz[0] ?? 0, 'h' => $sz[1] ?? 0, 'time' => filemtime($f),
            'used' => strpos($used, '"uploads/' . $b . '"') !== false];
    }
    usort($o, function ($a, $b) { return $b['time'] <=> $a['time']; });
    return $o;
}
