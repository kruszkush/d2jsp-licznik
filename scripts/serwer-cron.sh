#!/bin/bash
# Uruchamiane z crona na serwerze Google Cloud (co 2 h o losowej minucie + 21:05). Po blokadzie skrypt sam robi przerwę (state.json).
# Chrome ma trwały profil (~/.chrome-d2jsp), więc zapamiętuje przejście sprawdzenia przeglądarki jak u zwykłego użytkownika.
set -u
cd "$HOME/d2jsp-licznik" || exit 1
exec 9>/tmp/d2jsp.lock; flock -n 9 || exit 0
export TZ=Europe/Warsaw PROFILE="$HOME/.chrome-d2jsp"
[ "${1:-}" = los ] && sleep $((RANDOM % 1500))
git pull -q --rebase -X theirs
timeout 45m xvfb-run -a node scripts/update.mjs
code=$?
if ! git diff --quiet docs/data.json state.json 2>/dev/null || [ -n "$(git status --porcelain state.json)" ]; then
  git add docs/data.json state.json
  git commit -qm "Dane: $(date +%F\ %H:%M)"
  git pull -q --rebase -X theirs && git push -q
fi
echo "$(date '+%F %T') wynik=$code"
