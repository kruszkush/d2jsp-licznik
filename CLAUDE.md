# d2jsp-licznik — kontekst dla Claude

Licznik postów z forum d2jsp (sekcja Polska) + gra „Lotnik” (kod i serwer w repo `lotnik`, publikacja `sh scripts/publikuj.sh test|podglad|prod` w tamtym repo; stan: `E:\Vibe coding\lotnik\STAN.md`). Strona: https://kruszkush.github.io/d2jsp-licznik/ (GitHub Pages — repo MUSI zostać publiczne). Bieżący stan zawsze czytaj z repo; liczby poniżej to historia.

## Automat i foldery
- `E:\Vibe coding\d2jsp-licznik` — kopia robocza (tu edytujemy, commit + push). Na tym PC nie ma już automatu.
- Automat (od 24.10.2026): drugi laptop z Linuxem w domu (stale włączony, dostęp SSH/RustDesk), cron → `scripts/serwer-cron.sh` w `~/d2jsp-licznik`, źródło `server` w `state.json` (commity „Dane: …”), co ok. 30 min (6:05–0:35, losowo +0–10 min), w nocy raz 1:30–5:30, w niedzielę 20:35 „przed” (bez opóźnienia, kończy się do 20:57) i dokładnie 21:05 „ranking” (koniec rankingu tygodniowego; startuje od razu, tempo 5–12 s, FORCE=1 — jedna próba mimo własnej przerwy). Profil Chrome `~/.chrome-d2jsp` zalogowany na d2jsp (awatary); sekret Lotnika przez `LOTNIK_ENV`. Wylogowanie z d2jsp → ponowne logowanie w tym profilu przez RustDesk.
- Dawny automat PC (zadanie Windows `d2jsp-licznik`, `scripts/pc-cron.ps1/.vbs`, klon `d2jsp-licznik-bot`) wyłączony 24.10.2026, klon usunięty. Źródło `pc` nieaktywne; `serwer-cron.sh` już nie sprawdza PC — laptop pobiera zawsze.
- VM `d2jsp` w GCP usunięta (październik 2026); GCP zostaje tylko dla serwerów gier.

## Zasady, których nie łamać (naprawy Codexa, 1.10.2026)
- Blokada/backoff/status są osobne per źródło w `state.json.sources` — blokada Cloudflare serwera nie może zatrzymywać PC (wcześniej wspólny stan zatrzymał oba).
- Parser listy tematów: odpowiedzi to `td[0]`, NIE `td[3]` (wyświetlenia). Liczba odpowiedzi trzymana jako tekst (też `8.1k`); przy zaokrąglonych licznikach dodatkowo czas ostatniej aktywności.
- Postęp wewnątrz tematu w `pending`; czytanie od najnowszej strony wstecz do znanej granicy; limit 70 podstron/przebieg, następny przebieg kontynuuje. Limit nie przesuwa granicy tematu.
- `data.complete` przesuwa się tylko po rzeczywiście pełnym przebiegu (dotarcie do niezmienionych, ukończonych tematów starszych niż granica).
- Synchronizacja (`scripts/sync.mjs`) scala posty po ID, metadane i statusy źródeł — nigdy „wygrywa jedna wersja pliku”. Publikacja ponawia przy równoległej zmianie.
- `recoveryAt` — bezpieczne ponowne sprawdzanie (backfill) bez cofania granicy przez sync.
- Komunikat na stronie: pokazuje niepełne pobieranie/opóźnienie/przerwę źródła; „sprawdzanie co ok. 2 h” zamiast obiecanego terminu.
- Przerwy między stronami: PC losowo 3–6 s, serwer 20–60 s (max 40 podstron na przebieg). Nie obchodzić blokad Cloudflare.

## Pliki
`scripts/collector.mjs` (zbieranie, zakończenie, statusy, scalanie), `scripts/collector.test.mjs` (9 testów regresji), `scripts/sync.mjs`, `scripts/update.mjs` (parser, tempo), `scripts/pc-cron.ps1/.vbs`, `scripts/serwer-cron.sh`, HTML strony głównej i testowej.

## Inne zasady
- Bot pushuje dane co ~30 min: ZAWSZE `git pull --rebase` przed commitem i przed rozpoczęciem pracy.
- Każda zmiana strony: podbij wersję w tytule o 0.1 i podaj ją użytkownikowi.
- Lokalne liczenie postów z X dni: `E:\Vibe coding\_d2jsp-wiadomosci\dane\licz.mjs`.
- Przed zmianą wytykaj nielogiczne liczby/zasady w prośbie (np. „zestaw” z 1 sztuki). Pytanie „czemu?” = wyjaśnij, nie zmieniaj.

## Gra „Piłeczka” (wyłączona 14.10.2026)
- Gra i ranking zablokowane (`WYLACZONA = True` w `gcp/pileczka/main.py`), dane w Firestore zostają. Pełny opis zasad, serwera, kont, ekwipunku i wdrożenia: `notatki/pileczka.md` (czytaj przed zmianą `gcp/pileczka`; `docs/gra.js` usunięty 20.10, na stronie gra Lotnik).
- Następczyni: gra Lotnik (`E:\Vibe coding\lotnik`), własny serwer na tym samym projekcie GCP.
