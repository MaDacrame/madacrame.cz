<?php
require __DIR__ . '/lib.php';
security_headers();
if (!admin_access_ok()) {
    http_response_code(403);
    echo '<!doctype html><meta charset="utf-8"><title>Přístup odepřen</title><body style="font-family:sans-serif;background:#101214;color:#f4f1eb;padding:40px"><h1>403</h1><p>Administrace je dostupná pouze z domácí sítě nebo přes Tailscale.</p>';
    exit;
}
?>
<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#101214">
<title>Administrace — MaDacrame</title>
<link rel="stylesheet" href="assets/admin.css">
</head>
<body><div id="root"><p class="boot">Načítám administraci…</p></div><noscript>Administrace vyžaduje JavaScript.</noscript><script src="assets/admin.js"></script></body>
</html>
