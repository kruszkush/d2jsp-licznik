#!/bin/bash
# Uruchamiane z crona na serwerze Google Cloud (co 2 h o losowej minucie + 21:05). Po blokadzie skrypt sam robi przerwę (state.json).
# Chrome ma trwały profil (~/.chrome-d2jsp), więc zapamiętuje przejście sprawdzenia przeglądarki jak u zwykłego użytkownika.
set -u
cd "$HOME/d2jsp-licznik" || exit 1
# GitHub jest źródłem prawdy: przed przebiegiem serwer dostaje dokładnie to, co w repo (dane, stan, ten skrypt),
# niezależnie od lokalnych śmieci. Potem uruchamiamy świeżą wersję skryptu.
if [ -z "${D2_SYNCED:-}" ]; then
  exec 9>/tmp/d2jsp.lock; flock -n 9 || exit 0
  node scripts/sync.mjs prepare || exit 1
  D2_SYNCED=1 exec bash "$0" "$@"
fi
export TZ=Europe/Warsaw PROFILE="$HOME/.chrome-d2jsp" D2_SOURCE=server
[ "${1:-}" = los ] && sleep $((RANDOM % 1500))
timeout 45m xvfb-run -a node scripts/update.mjs
code=$?
node scripts/sync.mjs publish "Dane: $(date +%F\ %H:%M)" || code=1
echo "$(date '+%F %T') wynik=$code"
exit "$code"
