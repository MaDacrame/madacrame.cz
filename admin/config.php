<?php
// Konfigurace administrace MaDacrame. Neobsahuje žádná hesla.
return [
    // Soukromá složka MIMO webroot (hesla, zálohy, hlavní data, session).
    // null = automaticky "madacrame-private" vedle složky webu (např. web/madacrame-private).
    'private_dir' => null,

    // Z kterých sítí je administrace dostupná. Výchozí: localhost, domácí LAN a Tailscale.
    // Z veřejného internetu je administrace blokována (i když je web publikovaný).
    'allowed_nets' => [
        '127.0.0.0/8', '::1/128',
        '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16',
        '100.64.0.0/10',            // Tailscale (IPv4)
        'fd7a:115c:a1e0::/48',      // Tailscale (IPv6)
        'fe80::/10', 'fc00::/7',
    ],
    // true = povolit přístup odkudkoli (NEDOPORUČENO).
    'allow_public' => false,

    'max_upload_mb'   => 8,      // max. velikost jedné fotografie
    'max_image_px'    => 2200,   // delší strana po optimalizaci
    'thumb_px'        => 800,    // náhled pro karty a galerie
    'jpeg_quality'    => 84,
    'keep_backups'    => 40,     // počet verzí každého souboru
    'session_minutes' => 120,    // nečinnost do odhlášení
    'login_max_fails' => 5,      // pokusů na IP
    'login_lock_min'  => 15,     // délka blokace
];
