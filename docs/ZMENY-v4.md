# Verze 4 – vizuální a pohybové dotažení

## Nasazení nové verze na NAS (bez ztráty obsahu)
1. Zálohujte: `tools/backup.sh /volume1/web/madacrame /volume1/web/madacrame-private /volume1/zalohy-web`.
2. Z ZIPu nahrajte do `web/madacrame` všechno **kromě složek `content/` a `uploads/`** (obsahují vaše živá data; tato verze nemění strukturu JSON, takže je není třeba přepisovat).
3. Nové jsou: `assets/fonts/`, `assets/css/fonts.css`, upravené `assets/css/style.css`, `assets/js/site.js`, všechny `*.html` a `404.html`. Administrace (`admin/`, `tools/`) se nezměnila.
4. Po nahrání obnovte stránku s vymazáním cache (Ctrl+F5). Oprávnění zůstávají podle `docs/NASAZENI.md`.
5. Návrat: vrátit soubory ze zálohy z kroku 1.

## Implementováno (vše nativní CSS + JS, bez knihoven)
**Hero:** postupný nástup (eyebrow → slova nadpisu vyjíždějí zpod masky → perex → tlačítka → obrazová karta se odkryje); animovaná mřížka a oranžové záře v pozadí, driftující světlo sledující kurzor; plovoucí geometrické značky s různou hloubkou (pohyb za kurzorem); obrazová karta s jemným 3D náklonem za kurzorem, pomalým zoomem, rotujícím technickým HUD (kruhy, záměrný kříž, pulzující bod), rohovými značkami a živými souřadnicemi X/Y pod kurzorem; slovo „skutečnost“ s pomalým světelným přelivem; indikátor SCROLL (linka), který po rolování zmizí; pás názvů oblastí tvorby (načítá se z dat, ne napevno).
**Scroll reveal:** jeden systém pro celý web (IntersectionObserver). Nadpisy, texty, karty, galerie, statistiky, CTA a patička nastupují se stupňovaným zpožděním; obrázky v hlavičkách stránek nastupují zvětšením; animované linky pod nadpisy sekcí; počítání čísel ve statistikách; položky nad viditelnou oblastí se odhalí hned (bez „děr“ při návratu na kotvu/nahoru).
**Pohyb prvků:** jemný parallax obrázků v hlavičkách podstránek a pozadí hero; spotlight (oranžové světlo) sledující kurzor na kartách; rámeček a zvětšení obrázku na kartách při najetí; šipky a „+“ ikony s mikroanimací; animovaná podtržení odkazů a navigace; světelný přeliv na primárních tlačítkách; rotující technické kruhy v hlavičkách podstránek.
**Navigace:** průhledná → tmavá při rolování; skrývá se při rolování dolů a vrací při rolování nahoru; tenký oranžový ukazatel postupu stránkou; aktivní stránka s podtržením (a `aria-current` styl); mobilní menu s plynulým rozbalením, postupným nástupem položek, animovanou ikonou hamburger → ✕, zavírá se Esc a po kliknutí na odkaz.
**Přechody:** plynulé ztmavení/vyjetí obsahu při přechodu mezi stránkami (včetně správného chování při návratu tlačítkem Zpět); animované filtrování projektů přímo na stránce bez načítání (adresa se aktualizuje, odkaz `?kat=` stále funguje); počítadlo „Zobrazeno X z Y“.
**Lightbox:** plynulé otevření/zavření, přechod mezi fotkami, počítadlo 01 / 12, ovládání šipkami a Esc, přejetí prstem, předčítání sousedních fotek, zamčení rolování pozadí, návrat fokusu, zachycení klávesy Tab.
**Patička:** čtyři sloupce (značka, navigace, oblasti, kontakt jako text + odkazy na sítě), obrysový nápis MaDacrame, tlačítko „Nahoru“.
**Ostatní:** nová 404 (webová i statická), prázdné stavy, načítací indikátor místo textu, číslování karet a sekcí (01 — ROZCESTNÍK …), pevné ohraničení obrázků, výběr textu v oranžové.
**Výkon:** písma hostovaná lokálně (Manrope variabilní + DM Mono, jen latin a latin-ext, ~90 kB, preload) – odpadly externí požadavky na Google; animují se jen `transform` a `opacity`; žádné nové knihovny; scroll a pointer události jsou throttlované přes requestAnimationFrame; parallax a spotlight se vypínají na dotykových zařízeních.
**Přístupnost:** `prefers-reduced-motion` vypne všechny animace a zobrazí vše okamžitě; zachovány focus kruhy; dekorace mají `aria-hidden`; `aria-live` u počítadla filtru.

## Co nebylo implementováno / poznámky
- Vlastní kurzor jsem záměrně nepřidal – na portfoliu by spíš rušil.
- Cross-document View Transitions jsem nepoužil (obsah se vykresluje JavaScriptem); přechod je řešený lehkou animací.
- Obsah webu stále vzniká JavaScriptem z JSON – bez JavaScriptu se zobrazí jen upozornění.
- Ilustrační grafiky a ukázkové projekty zůstávají označené jako ilustrace/ukázkový obsah.

## Co jsem testoval a co ne
Testováno v Chromiu (Playwright, desktop 1280 px a mobil 390 px s dotykem, i s reduced-motion): všechny stránky se načtou bez chyb v konzoli a bez rozbitých obrázků, žádné vodorovné přetékání, všechny reveal prvky se odhalí po projetí stránky, skrývání hlavičky, ukazatel postupu, mobilní menu (otevření, Esc), filtr projektů, přechod mezi stránkami, lightbox, reduced-motion, a znovu celý tok administrace (přihlášení, kategorie, projekt, nahrání fotek, galerie, pořadí, mazání). Syntaxe JS a PHP je zkontrolována, odkazy a cesty k souborům také.
**Netestováno:** Safari/iOS a Firefox, skutečný telefon a tablet, plynulost animací na slabém zařízení, nasazení a běh na DS216j (PHP, oprávnění, HTTPS, DNS). Pokud by animace na starším telefonu drhly, dá se vypnout parallax a spotlight smazáním volání `initHero` a bloku „pars“ v `site.js`.
