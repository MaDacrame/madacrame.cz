#!/bin/sh
# Záloha webu MaDacrame (kód, obsah, fotografie, soukromá data) do jedné .tar.gz.
# Použití: backup.sh /volume1/web/madacrame /volume1/web/madacrame-private /volume1/zalohy-web
# Naplánujte v DSM: Ovládací panel → Plánovač úloh → Vytvořit → Uživatelský skript (např. denně 3:00).
set -eu
WEB="${1:?cesta k webu}"; PRIV="${2:?cesta k soukromé složce}"; OUT="${3:?cílová složka}"
mkdir -p "$OUT"
F="$OUT/madacrame-$(date +%Y%m%d-%H%M).tar.gz"
tar -czf "$F" -C "$(dirname "$WEB")" "$(basename "$WEB")" -C "$(dirname "$PRIV")" "$(basename "$PRIV")" --exclude='*/sessions/*'
chmod 600 "$F"
# ponechat posledních 30 záloh
ls -1t "$OUT"/madacrame-*.tar.gz | tail -n +31 | xargs -r rm -f
echo "OK: $F"
