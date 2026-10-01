# d2jsp-licznik — kontekst dla Claude

Licznik postów z forum d2jsp (sekcja Polska) + gra „Piłeczka”. Strona: https://kruszkush.github.io/d2jsp-licznik/ (GitHub Pages — repo MUSI zostać publiczne). Bieżący stan zawsze czytaj z repo; liczby poniżej to historia.

## Dwa automaty, dwa foldery
- `E:\Vibe coding\d2jsp-licznik` — kopia robocza (tu edytujemy, commit + push).
- `E:\Vibe coding\d2jsp-licznik-bot` — celowo osobny klon dla zadania Windows `d2jsp-licznik` (`scripts/pc-cron.vbs` → `pc-cron.ps1`); sync przed każdym przebiegiem, nie edytować ręcznie. Log: `E:\Vibe coding\_logi\d2jsp-licznik-bot.log`.
- Serwer GCP: projekt `rich-chimera-344319`, VM `d2jsp`, strefa `us-east1-b`, użytkownik `d2jsp-licznik`, repo `/home/d2jsp-licznik/d2jsp-licznik`, skrypt `scripts/serwer-cron.sh`.
- Oba źródła (`pc`, `server`) publikują do tego samego repo; automat co ok. 2 h.
- PC = główne źródło. Serwer (IP chmury → częste wyzwania Cloudflare) to zapas: `serwer-cron.sh` pomija przebieg, gdy `pcHealthy` (PC bez blokady i `okAt` < 4 h; `scripts/pc-zdrowy.mjs`). `FORCE=1` wymusza. Serwer po blokadzie: stała przerwa 1,5 h.

## Zasady, których nie łamać (naprawy Codexa, 1.10.2026)
- Blokada/backoff/status są osobne per źródło w `state.json.sources` — blokada Cloudflare serwera nie może zatrzymywać PC (wcześniej wspólny stan zatrzymał oba).
- Parser listy tematów: odpowiedzi to `td[0]`, NIE `td[3]` (wyświetlenia). Liczba odpowiedzi trzymana jako tekst (też `8.1k`); przy zaokrąglonych licznikach dodatkowo czas ostatniej aktywności.
- Postęp wewnątrz tematu w `pending`; czytanie od najnowszej strony wstecz do znanej granicy; limit 70 podstron/przebieg, następny przebieg kontynuuje. Limit nie przesuwa granicy tematu.
- `data.complete` przesuwa się tylko po rzeczywiście pełnym przebiegu (dotarcie do niezmienionych, ukończonych tematów starszych niż granica).
- Synchronizacja (`scripts/sync.mjs`) scala posty po ID, metadane i statusy źródeł — nigdy „wygrywa jedna wersja pliku”. Publikacja ponawia przy równoległej zmianie.
- `recoveryAt` — bezpieczne ponowne sprawdzanie (backfill) bez cofania granicy przez sync.
- Komunikat na stronie: pokazuje niepełne pobieranie/opóźnienie/przerwę źródła; „sprawdzanie co ok. 2 h” zamiast obiecanego terminu.
- Przerwy między stronami: PC losowo 3–6 s, serwer 5–12 s. Nie obchodzić blokad Cloudflare.

## Pliki
`scripts/collector.mjs` (zbieranie, zakończenie, statusy, scalanie), `scripts/collector.test.mjs` (9 testów regresji), `scripts/sync.mjs`, `scripts/update.mjs` (parser, tempo), `scripts/pc-cron.ps1/.vbs`, `scripts/serwer-cron.sh`, HTML strony głównej i testowej.

## Inne zasady
- Boty pushują dane co ~2 h: ZAWSZE `git pull --rebase` przed commitem i przed rozpoczęciem pracy.
- Każda zmiana strony: podbij wersję w tytule o 0.1 i podaj ją użytkownikowi.
- Piłeczka: ekwipunek/afiksy tylko na wersji testowej (/test/, pileczka-test); produkcji nie wdrażać bez zgody.
- Lokalne liczenie postów z X dni: `E:\Vibe coding\_d2jsp-wiadomosci\dane\licz.mjs`.
