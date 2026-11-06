#!/bin/zsh
# A cópia de segurança semanal da base de produção (D1 «nunos-lab»): um .sql por semana em
# docs/copias/ (fora do git) e o ponto do Time Travel desse instante (restaura-se ao minuto
# com «wrangler d1 time-travel restore»). Corre pelo launchd aos domingos às 04:00 depois de
# instalado (ver scripts/launchd/LEIA-ME.md); à mão: scripts/copia-de-seguranca.sh
set -euo pipefail
cd "$(dirname "$0")/../apps/api"
export PATH="/Users/renatovalente/.nvm/versions/node/v22.15.1/bin:/usr/local/bin:/usr/bin:/bin"
pasta="../../docs/copias"
mkdir -p "$pasta"
dia=$(date +%F)
npx wrangler d1 time-travel info nunos-lab > "$pasta/ponto-$dia.txt" 2>&1 || true
npx wrangler d1 export nunos-lab --remote --output "$pasta/nunos-lab-$dia.sql"
# Ficam as últimas oito.
for f in $(ls -t "$pasta"/nunos-lab-*.sql 2>/dev/null | tail -n +9); do rm -f "$f"; done
for f in $(ls -t "$pasta"/ponto-*.txt 2>/dev/null | tail -n +9); do rm -f "$f"; done
echo "$(date '+%F %T') ✔ cópia em $pasta/nunos-lab-$dia.sql"
