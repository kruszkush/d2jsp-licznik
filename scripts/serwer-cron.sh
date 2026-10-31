#!/bin/bash
# Uruchamiane z crona na laptopie (co 30 min o losowej minucie, w nocy jeden przebieg między 1:30 a 5:30, w niedzielę dokładnie o 21:05 „ranking”). Po blokadzie skrypt sam robi przerwę (state.json).
# Chrome ma trwały profil (~/.chrome-d2jsp), więc zapamiętuje przejście sprawdzenia przeglądarki jak u zwykłego użytkownika.
set -u
cd "$HOME/d2jsp-licznik" || exit 1
# Ostatni dzień miesiąca (także roku) kończy się o 21:00 jak niedziela (patrz edge() na stronie): zwykłe przebiegi 20:35 i 21:05 stają się „przed” i „ranking”.
if [ "${1:-}" = los ] && [ "$(TZ=Europe/Warsaw date -d tomorrow +%d)" = 01 ]; then
  case "$(TZ=Europe/Warsaw date +%H:%M)" in
    20:3[5-9]) set -- przed ;;
    21:0[5-9]) set -- ranking ;;
  esac
fi
# Przed przebiegiem pobieramy świeży kod i scalamy lokalny postęp z GitHubem,
# zachowując posty oraz osobne przerwy obu źródeł. Potem uruchamiamy świeży skrypt.
if [ -z "${D2_SYNCED:-}" ]; then
  # „ranking” (niedziela 21:05): przebieg „przed” (20:35) kończy się przed 21:00, więc blokada jest wolna; 5 min zapasu
  # „przed” czeka do 2 min na kończący się przebieg z 20:05; pominięcie zostawia ślad w logu
  exec 9>/tmp/d2jsp.lock; case "${1:-}" in ranking) flock -w 300 9 ;; przed) flock -w 120 9 ;; *) flock -n 9 ;; esac || { echo "$(date '+%F %T') pominięto ${1:-}: poprzedni przebieg jeszcze trwa"; exit 0; }
  node scripts/sync.mjs prepare || exit 1
  D2_SYNCED=1 exec bash "$0" "$@"
fi
export TZ=Europe/Warsaw PROFILE="$HOME/.chrome-d2jsp" D2_SOURCE=server
[ "${1:-}" = los ] && sleep $((RANDOM % 600))   # 0–10 min
[ "${1:-}" = noc ] && sleep $((RANDOM % 14400)) # 0–4 h (1:30–5:30)
LIMIT=40m
# Dzień zamknięcia (niedziela, ostatni dzień miesiąca): przebieg z 20:05 kończy się do 20:32, żeby nie zająć blokady przebiegowi „przed”
if [ "${1:-}" = los ] && { [ "$(date +%u)" = 7 ] || [ "$(date -d tomorrow +%d)" = 01 ]; } && [ "$(date +%H)" = 20 ] && [ "$(date +%-M)" -lt 32 ]; then
  LIMIT=$(( $(date -d 20:32 +%s) - $(date +%s) ))s
fi
# „przed”: niedziela 20:35 bez losowego opóźnienia, twardo do 20:57, żeby 21:05 było wolne
[ "${1:-}" = przed ] && LIMIT=22m
# „ranking”: wyniki tygodnia mają być od razu — szybsze tempo (5–12 s) i jedna próba także w trakcie własnej przerwy po blokadzie
[ "${1:-}" = ranking ] && export FORCE=1 D2_FAST=1 && LIMIT=15m
timeout $LIMIT xvfb-run -a node scripts/update.mjs
code=$?
node scripts/sync.mjs publish "Dane: $(date +%F\ %H:%M)" || code=1
echo "$(date '+%F %T') wynik=$code"
exit "$code"
