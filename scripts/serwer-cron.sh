#!/bin/bash
# Uruchamiane z crona na serwerze Google Cloud (co 2 h o losowej minucie + 21:05). Po blokadzie skrypt sam robi przerwę (state.json).
# Chrome ma trwały profil (~/.chrome-d2jsp), więc zapamiętuje przejście sprawdzenia przeglądarki jak u zwykłego użytkownika.
set -u
cd "$HOME/d2jsp-licznik" || exit 1
# GitHub jest źródłem prawdy: przed przebiegiem serwer dostaje dokładnie to, co w repo (dane, stan, ten skrypt),
# niezależnie od lokalnych śmieci. Potem uruchamiamy świeżą wersję skryptu.
if [ -z "${D2_SYNCED:-}" ]; then
  git fetch -q origin && git reset -q --hard origin/main && git clean -qfd -- docs scripts
  D2_SYNCED=1 exec bash "$0" "$@"
fi
exec 9>/tmp/d2jsp.lock; flock -n 9 || exit 0
export TZ=Europe/Warsaw PROFILE="$HOME/.chrome-d2jsp"
[ "${1:-}" = los ] && sleep $((RANDOM % 1500))
timeout 45m xvfb-run -a node scripts/update.mjs
code=$?
if ! git diff --quiet docs/data.json state.json 2>/dev/null || [ -n "$(git status --porcelain state.json)" ]; then
  git add docs/data.json state.json
  git commit -qm "Dane: $(date +%F\ %H:%M)"
  for i in 1 2 3; do git push -q && break; git pull -q --rebase -X theirs || { git rebase --abort; git reset -q --hard origin/main; break; }; done
fi
echo "$(date '+%F %T') wynik=$code"
