# MaDacrame – portfolio v2

Tato verze je připravená pro GitHub Pages v repozitáři `madacrame.cz`.

## Obsah
- `index.html` – hlavní stránka s rozcestníkem
- `oblast.html?id=...` – společná šablona samostatných odvětví
- `o-nas.html`, `kontakt.html`, `stranka.html` (dodatečné stránky)
- `content/site.json` – texty a kontakty webu
- `content/sections.json` – rozcestník a obsah odvětví
- `content/projects.json` – portfolio realizací
- `content/pages.json` – vlastní doplňkové stránky
- `.pages.yml` – konfigurace Pages CMS
- `media/` – fotografie nahrávané přes administraci
- `assets/` – pevný vzhled, skripty a ilustrační SVG

## Nahrání na GitHub
1. Otevři repozitář `madacrame.cz`.
2. Nahraj obsah tohoto ZIPu do kořenové složky repozitáře (ne samotnou nadřazenou složku).
3. Nahraď starý `index.html` novým a nahraj všechny ostatní soubory i složky.
4. Potvrď změny tlačítkem **Commit changes**.
5. V Settings → Pages ponech `main` a `/ (root)`.

GitHub Pages pak automaticky publikuje novou verzi. V této verzi se používají relativní cesty, takže funguje i adresa projektu `madacrame.github.io/madacrame.cz/`.

## Administrace přes Pages CMS
1. Otevři https://app.pagescms.org/
2. Přihlas se přes GitHub a povol Pages CMS přístup k repozitáři `madacrame.cz`.
3. Otevři repozitář a větev `main`.
4. Pages CMS načte `.pages.yml`.
5. V levém menu najdeš **Základní nastavení webu**, **Odvětví a rozcestník** a **Portfolio a realizace**.
6. Fotografie nahrávej přes obrazová pole; budou uloženy do `media/`.

Pages CMS je externí administrační služba. Web zůstává hostovaný na GitHub Pages a obsah se ukládá do GitHub repozitáře. Při prvním připojení musíš výslovně povolit GitHub App Pages CMS přístup k repozitáři. Nezadávej nikomu heslo ani osobní přístupový token.

## Důležité
- Ilustrační SVG obrázky jsou zástupná grafika, nikoli fotografie skutečných výrobků.
- Kontaktní údaje jsou předvyplněné podle zadání; před ostrým zveřejněním je zkontroluj.
- Přidávání dalších odvětví se dělá v `content/sections.json` přes CMS. `id` musí být jedinečné a bez mezer; změna již zveřejněného ID změní odkaz na stránku.
- Vzhled, typografie, rozestupy a barvy jsou záměrně pevné. CMS upravuje obsah, ne design.
- Pro testování otevři GitHub Pages URL po dokončení publikace. Po změně souborů může chvíli trvat, než se nová verze zobrazí.

## Omezení první verze
Jde o statické portfolio bez e-shopu, košíku, zákaznických účtů a serverového kontaktního formuláře. Kontakt funguje přes e-mail, telefon a Instagram.
