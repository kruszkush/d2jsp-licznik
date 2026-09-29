#!/bin/bash
# Uruchamiane z crona na serwerze Google Cloud co 3 h. Skrypt sam kończy, jeśli w ciągu 20 h była udana aktualizacja.
# Chrome ma trwały profil (~/.chrome-d2jsp), więc zapamiętuje przejście sprawdzenia przeglądarki jak u zwykłego użytkownika.
set -u
cd "$HOME/d2jsp-licznik" || exit 1
exec 9>/tmp/d2jsp.lock; flock -n 9 || exit 0
export TZ=Europe/Warsaw PROFILE="$HOME/.chrome-d2jsp"
git pull -q --rebase -X theirs
timeout 90m xvfb-run -a node scripts/update.mjs 30
code=$?
if ! git diff --quiet docs/data.json; then
  git add docs/data.json
  git commit -qm "Dane: $(date +%F\ %H:%M)"
  git pull -q --rebase -X theirs && git push -q
fi
echo "$(date '+%F %T') wynik=$code"
