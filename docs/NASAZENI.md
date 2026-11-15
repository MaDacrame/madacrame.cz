# MaDacrame.cz – nasazení na Synology DS216j

## 0. Co je v balíčku
- **Veřejný web**: statické HTML/CSS/JS, obsah čte z `content/*.json`. Nepotřebuje PHP ani databázi.
- **Administrace** `admin/` (PHP ≥ 7.4, bez databáze): obsah se ukládá do JSON, fotografie do `uploads/`.
- **Soukromá data** (hash hesla, zálohy verzí, plná data včetně skrytých položek, session) leží v `madacrame-private/` MIMO webroot.
- Veřejný web funguje i bez PHP; PHP potřebuje jen administrace.

## 1. PHP na DS216j – ověřte PŘED nasazením
Synology uvádí ve Web Station PHP 7.3–8.2, ale **dostupnost pro konkrétní model (ARMv7, DS216j) jsem nemohl ověřit** a PHP 7.4/8.0 jsou podle Synology označeny jako končící. Postup:
1. Centrum balíčků → nainstalujte **Web Station** a PHP **8.2** (jinak 8.1, 8.0, 7.4 – nejnovější, která se nabídne).
2. Web Station → Profil skriptovacího jazyka → vytvořte profil PHP (Nginx) a zaškrtněte rozšíření: **gd, mbstring, fileinfo, exif, session, json**. V „Core settings“ nastavte `upload_max_filesize = 12M`, `post_max_size = 40M`, `memory_limit = 256M`.
3. Kód je psán pro PHP 7.4+ a testován na 8.3. Bez GD administrace funguje, jen se fotky nezmenšují.
4. Po přihlášení do administrace otevřete **Systém a heslo → Diagnostika** – ukáže verzi PHP, rozšíření a oprávnění přímo z NASu.
Pokud PHP pro váš model k dispozici není, napište mi – nabídnu variantu bez PHP (úpravy JSON přes jinou cestu).

## 2. Složky a oprávnění (File Station / SSH)
Struktura ve sdílené složce `web`:
```
web/madacrame/            ← kořen vhostu (obsah ZIPu)
web/madacrame-private/    ← vytvořte prázdnou (mimo vhost)
```
Zapisovat smí uživatel webserveru (`http`, skupina `http`) pouze do: `madacrame/content`, `madacrame/uploads`, `madacrame-private`. Zbytek jen čtení:
```
sudo chown -R root:root /volume1/web/madacrame
sudo chmod -R 755 /volume1/web/madacrame
sudo chown -R http:http /volume1/web/madacrame/content /volume1/web/madacrame/uploads /volume1/web/madacrame-private
sudo chmod -R 775 /volume1/web/madacrame/content /volume1/web/madacrame/uploads
sudo chmod 770 /volume1/web/madacrame-private
```
Do jiných sdílených složek (3D modely) se nezasahuje.

## 3. Záloha před nasazením
Zkopírujte stávající `web/madacrame` jako `web/madacrame_stara_verze` (nebo `tools/backup.sh`). GitHub repozitář zůstává jako záloha a návrat.

## 3a. Přesun z GitHubu na NAS (shrnutí)
1. Rozbalte ZIP do `web/madacrame` (kroky 2–5). GitHub repozitář `MaDacrame/madacrame.cz` ani GitHub Pages zatím nijak neměňte.
2. Otestujte web i administraci na `http://192.168.1.145/madacrame/` a přes Tailscale.
3. Obsah z původní verze je již převeden do nové struktury (`content/*.json`); další úpravy dělejte v administraci, ne na GitHubu.
4. Po úspěšném testu z internetu (krok 8) změňte DNS (krok 9). GitHub nechte jako zálohu; soubor `CNAME` v ZIPu slouží jen GitHub Pages a na NASu je neškodný.
5. Návrat: vrátit původní DNS záznamy (krok 9, bod 5) – GitHub Pages běží dál.

## 4. Web Station
- Webová služba: statická/PHP podle profilu, kořen dokumentů `web/madacrame`, profil PHP z kroku 1.
- Virtuální hostitel: `madacrame.cz` (+ alias `www.madacrame.cz`), HTTP 80, **později HTTPS 443**, backend Nginx.
- Vlastní chybová stránka: profil chybových stránek → 404 → `404.html`.
- **Nepoužívejte reverzní proxy před webem** – administrace rozpoznává původ požadavku podle IP adresy.

## 5. První spuštění
1. Otevřete `http://192.168.1.145/madacrame/admin/` (nebo přes Tailscale `http://100.118.133.46/madacrame/admin/`).
2. Nastavte heslo (min. 10 znaků). Alternativa přes SSH: `php tools/set-password.php`.
3. Zkontrolujte Diagnostiku, nahrajte fotografie, upravte obsah.
Všechny cesty jsou relativní, takže web funguje v podsložce `/madacrame/` i na `madacrame.cz`.

## 6. Zabezpečení administrace
- `admin/config.php`: administrace je dostupná **jen z LAN (192.168/16, 10/8, 172.16/12) a Tailscale (100.64/10)**. Z internetu vrací 403, i když je web publikovaný. Port forwarding zachovává veřejnou IP návštěvníka, takže to funguje spolehlivě.
- Hesla: Argon2id/bcrypt, session cookie `HttpOnly` + `SameSite=Strict` (+ `Secure` na HTTPS), CSRF token, 5 pokusů / 15 min zámek na IP, odhlášení po 2 h nečinnosti.
- Fotografie: jen JPG/PNG/WEBP, kontrola obsahu, překódování GD (odstraní skrytá data), náhodné názvy, limit 8 MB.
- Z internetu nejsou dostupné: hash hesla, zálohy, skrytý obsah (leží v `madacrame-private`).
- Nikdy nepublikujte porty 5000/5001 ani WebDAV.

## 7. Zálohování
- Verze obsahu: automaticky při každém uložení (40 verzí), obnova v administraci → Zálohy.
- Celé: `tools/backup.sh /volume1/web/madacrame /volume1/web/madacrame-private /volume1/zalohy-web` v Plánovači úloh (denně), případně Hyper Backup složek `web/madacrame*`.
- Skript spusťte jako root a zálohu zkopírujte i mimo NAS.

## 8. HTTPS a veřejná dostupnost (dělejte až po úplném otestování)
1. Ověřte, zda NAS není za CGNAT: WAN IP v routeru Zyxel se musí shodovat s veřejnou IP (např. na ifconfig.me). Pokud ne (100.64.x.x / 10.x), přímé publikování nebude fungovat – ozvěte se poskytovateli o veřejnou IP, nebo použijte tunel.
2. Zyxel: přesměrování portů **80 → 192.168.1.145:80** a **443 → 192.168.1.145:443**. Nic dalšího.
3. DSM → Ovládací panel → Zabezpečení → Certifikát → Přidat → **Let's Encrypt**, doména `madacrame.cz`, alternativní název `www.madacrame.cz` (vyžaduje, aby DNS už mířilo na vaši IP a port 80 byl dostupný). Obnova je automatická.
4. Web Station → vhost → zapnout HTTPS, přiřadit certifikát, zapnout přesměrování HTTP→HTTPS.
5. Dynamická IP u ADSL: nastavte DDNS (DSM → Externí přístup) nebo si zjistěte, jak často se IP mění.

## 9. DNS u Webglobe (změna až po testu z internetu)
1. Několik dní předem snižte TTL A záznamů na 300 s.
2. Otestujte z mobilní sítě (ne z domácí Wi-Fi): `http://<veřejná IP>/` s hlavičkou Host, nebo dočasně přes hosts soubor.
3. Změny: smažte 4 A záznamy GitHub Pages pro `@`, přidejte A `@` → veřejná IP; `www` – změňte CNAME `madacrame.github.io` na A → veřejná IP (nebo CNAME na DDNS název).
4. **Nesahejte na MX, SPF, DKIM, DMARC, TXT ani jiné e-mailové záznamy** (e-mail madacrame@email.cz je jinde).
5. Návrat zpět: vraťte původní A záznamy GitHub Pages (185.199.108.153, .109.153, .110.153, .111.153) a CNAME `www`. GitHub Pages ponechte zapnuté do ověření.

## 10. Co je na webu ilustrativní
Obrázky `assets/visuals/*.svg` jsou zástupná grafika a web je označuje „Ilustrace“. Tři ukázkové projekty jsou označeny „Ukázkový obsah · není skutečná realizace“ – nahraďte je vlastními (v administraci smažte nebo přepište a odškrtněte „Ukázkový obsah“).

## 11. Omezení a poznámky
- Stránky se vykreslují JavaScriptem z JSON → náhledy při sdílení na Facebooku nebudou mít obrázek a titulek konkrétního projektu.
- Písma Manrope a DM Mono jsou hostovaná lokálně v `assets/fonts/` (licence SIL OFL), web nevolá žádné externí služby.
- Při ruční úpravě `content/*.json` mimo administraci se změny přepíšou: hlavní data jsou v `madacrame-private/data/`.
- Skrytá položka není vůbec publikována do `content/` (nelze ji najít přímým odkazem).

## 12. Nad rámec zadání – co není implementováno
- Samostatný „náhled před publikováním“ není: nová položka se vytváří jako **skrytá**, po uložení ji zveřejníte přepínačem „Zveřejněno“ (změna je okamžitá a lze ji vrátit ze zálohy).
