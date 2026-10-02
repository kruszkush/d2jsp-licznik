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
- Lokalne liczenie postów z X dni: `E:\Vibe coding\_d2jsp-wiadomosci\dane\licz.mjs`.
- Przed zmianą wytykaj nielogiczne liczby/zasady w prośbie (np. „zestaw” z 1 sztuki). Pytanie „czemu?” = wyjaśnij, nie zmieniaj.

## Gra „Piłeczka” (stan na 1.10.2026)
- Zasady od 2.10.2026 (obie strony, `SUFIT = true` w gra.js): brak sufitu (od 7.8): pełna siła podbicia, za mocno podbita piłeczka wylatuje nad ekran (nie da się kliknąć), wskaźnik „↑ N px”; pierwsze 3 podbicia lekkie; na telefonie bez poświaty; odbicia od dołu za punkty (progi 50, 150, 350, 750…); po odbiciu od dołu wznoszenie hamuje 3 s → zawis → obrót do pionu 1,5 s → dymek :mellow: (docs/mellow.png); Stróża = 3 odbicia; Kapcie 2–4 kliknięcia (pole `bans`, starsze = 1); start prędkości ×1,25 na komputerze; ranking zawsze widoczny: top 10 + Twoje/ostatnie miejsce + liczba graczy (GET ?nick=). `?odbicia=N` tylko na /test/.
- Wydajność: duży mnożnik rysowany 4× mniejszy i skalowany, poświata tylko w pasach przy krawędziach — pełnoekranowe półprzezroczyste warstwy zacinały na 144 Hz u użytkownika. Nie wracać do pełnoekranowych gradientów.
- Kod: `docs/gra.js` (wspólny dla obu stron; `TEST` = ścieżka `/test/`, `EQON = true`), serwer: Cloud Function `gcp/pileczka/main.py` (gen2, us-east1, python312, entry `pileczka`). Funkcje: `pileczka` (prod, kolekcje `pileczka`, `ekwipunek`) i `pileczka-test` (`SUFFIX=_test`). Firestore w tym samym projekcie.
- Wdrożenie (reguły allow są w `E:\Vibe coding\.claude\settings.local.json`): `gcloud functions deploy pileczka-test --gen2 --region=us-east1 --runtime=python312 --entry-point=pileczka --source=<gcp/pileczka> --trigger-http --allow-unauthenticated --update-env-vars SUFFIX=_test --quiet`, prod to samo bez env. Najpierw test; prod gdy użytkownik napisze „daj na official”. Wdrożenia czasem wiszą na DEPLOYING kilkanaście minut (409 „unable to queue” = poczekaj).
- Zmiany robimy najpierw na /test/ (wersja `x.y-test` w `docs/test/index.html`), potem przenosimy na prod (`docs/index.html`). Prod index = test index bez paska „WERSJA TESTOWA”, ścieżki `data.json`/`gra.js` bez `../`.
- Ekwipunek i przedmioty są już na prod; „Narzędzie testowe” (/grant) tylko na /test/ (serwer też odrzuca poza testem).
- Punkty za podbicie = (piłeczka + Łowcy + premia top10 [+ Hełm]) × mnożnik poziomu + przedmioty (implicit, Ostry, zestaw, Serii, nabity Zuchwały). Wynik pokazywany w pełnych liczbach, liczony z ułamkami.
- Piłeczki: 3 rozmiary x1.0 / x1.3 / x1.7; do 9 naraz, nowa co 1,75 s; bez powtórek awatarów. Lider 24 h: 15% szans, może lecieć 2× naraz, złota ramka + korona.
- Premia top 10 z 24 h do mnożnika piłeczki dla wszystkich: 1. +0.6x, 2. +0.4x, 3. +0.3x, 4–10 +0.1x (dopiski w tabeli tylko w widoku 24 h). Strona domyślnie pokazuje 24 h; wykres godzinowy dla zakresu ≤ 2 dni.
- Rzadkości: normalny/magiczny(1 afiks)/rzadki(2)/unikat (+0.3x, 1 boski + 2 losowe + unikatowa cecha). Unikaty tylko: Hełm Weterana (podwaja premię top10, fioletowa korona na plakietce) i Kapcie Moderatora (raz na grę pudło = podbicie). Opisów unikatów NIE pokazywać w legendzie (bez spoilerów).
- Szanse (serwer `R_PTS/M_PTS/U_PTS`, klient `chances()` — muszą być zgodne): rzadki 0.25→1→2→4→6→10→15% przy 15/50/100/200/300/600/1000 pkt, magiczny 14→45%, unikat 0.3% od 50 pkt do 1.8% przy 1000. Drop = wynik/80.
- Klasy afiksów: słaby 55 / dobry 35 / znakomity 7 / boski 3 (waga dzielona na afiksy klasy). Boskie: Ostry, Serii, Stróża (odbicie od dołu). Szczęśliwy 30–60% względnie do szans na rzadki i unikat (max +100%). Wytrwałości: piłeczka przyspiesza 5–15% wolniej. Brak afiksów z minusami (użytkownik nie chce).
- Zestaw (rzadkie/unikaty z awatarem tej samej osoby): 2/3/4 szt. = +0.2/+0.4/+0.6 pkt za podbicie (+ ukryte odbicie przy 4).
- Decyzja o dropie tylko w oknie końca gry (zamknięcie = przepada; normalny bez pytania); normalny przy lepszym założonym odrzucany automatycznie; pending wygasa po 10 min.
- Ranking: najlepsza pojedyncza gra na nick (nie suma), nick min. 3 znaki, emoji urządzenia z rekordu, klik w gracza = ekwipunek z gry rekordowej. Zakładki Ogólny/Tydzień/Dziś (czas polski, tydzień od pon.): `pileczka{SUFFIX}_okres/{dRRRR-MM-DD | wRRRR-TT}/gracze/{skrót nicku}`, zapis w jednej transakcji z ogólnym; GET/POST `okres=d|w`; odpowiedź ma `best` (rekord ogólny → HUD „🏆”, błysk „Nowy rekord!”). Nick chroniony tylko przez konto (niżej).
- Od 11.1-test/8.1 (3.10.2026): telefon startuje grę tapnięciem (pointerup bez przesunięcia), w grze `touch-action:none`; tylko lewy przycisk myszy; Kapcie działają tylko, gdy piłeczka spada w dolnej połowie (🔨 świeci); okno końca: przyciski wyszarzone 0,7 s, „Zamknij”/„Zagraj jeszcze raz” nieaktywne do wyniku dropu (komunikaty „za szybko” = DROP_GAP 15 s, błąd sieci); „Zagraj jeszcze raz” = od razu kilka spadających awatarów u góry (gracz sam wybiera piłeczkę — nie losować za niego); „+N” obok piłeczki; za małe okno w trakcie = normalny koniec z zapisem; przedmioty wczytane w trakcie gry doliczają się (⏳ w HUD); limity afiksów (CAP, BRAV_MAX, ZUCH_MAX) widoczne w opisach. Podpowiedź dla nowych w karcie rankingu (znika po pierwszej grze, flaga `pilStart`; przy wyłączonych awatarach link „Włącz awatary”), w Legendzie sekcja „Jak grać”. Poświata krawędzi wyłączona na stałe (laguje na 144 Hz także w pasach, 3.10.2026).
- Test bez okna: puppeteer-core (node_modules) + Chrome, strona z `python -m http.server 8765 --directory docs` (origin localhost:8765 dopuszczony w CORS funkcji). Test kont: `node out/konta-test.mjs` (komputer + iPhone, pileczka-test; out/ poza repo).
- Konta graczy (od 11.3-test, 3.10.2026; tylko /test/ — klient `KONTA = TEST`, serwer env `KONTA=1` tylko na pileczka-test; prod po „daj na live”): nick + hasło (scrypt n=2^14, min. 6 znaków, lista zbyt łatwych haseł), kolekcje `konta{SUFFIX}` (id = skrót nicku jak w rankingu) i `sesje{SUFFIX}` (id = skrót tokenu; token w localStorage `pilTok`, bez wygasania). Endpointy POST: /register /login /logout /sessions /password /redeem /merge /admin; ekwipunek przyjmuje `token` albo `key`.
  - Nick z kontem: zapis wyniku (ogólny + dzień/tydzień) tylko z tokenem (bez → 403 `need:login`, klient pyta o hasło w oknie końca gry). Zalogowany zapisuje zawsze pod nickiem konta.
  - Rejestracja przypina dokument ekwipunku klucza (`owner`, `ownerTs`); stary klucz jako gość → 403 `konto` (klient: nowy klucz + podpowiedź `eqOwned`). Wyjątek: /equip kluczem dla pending sprzed `ownerTs`.
  - Przejęcie nicku z rankingu od razu tylko z urządzenia `claimEq` — zamrożone przy pierwszym zapisie po wdrożeniu (dawne `eq` = urządzenie rekordu sprzed kont) albo przy założeniu wpisu; NIE z bieżącego `eq`, bo wynik da się podrobić POST-em. Inaczej kod od admina.
  - Logowanie: klucz gościa → `eqKeyOld`, po zamknięciu okna końca gry okno łączenia per slot (domyślnie rzadszy, remis → konto); dokument gościa dostaje `mergedInto`, nic nie kasujemy. Wylogowanie bez łączenia przywraca klucz gościa.
  - Blokada: 5 złych haseł → 15 min (osobny licznik `r…` dla kodów admina). Limit na IP (w pamięci, OSTATNI wpis X-Forwarded-For — pierwszy podaje klient): `RL_PW` prób z hasłem/10 min (domyślnie 20), `RL_REG` kont/dobę (domyślnie 5); na pileczka-test podniesione do 60/40 do testów.
  - Zmiana hasła (bez starego — to ścieżka odzyskania na zalogowanym urządzeniu) i kod admina wylogowują pozostałe urządzenia.
  - Admin (gracz pisze PW na d2jsp): `node scripts/pileczka-admin.mjs kod <nick> [--test]` → kod na 24 h + gotowy tekst PW; `info` = stan konta. Sekret `ADMIN_SECRET` w `E:\Vibe coding\pileczka-admin.env` (poza repo) i w env funkcji. Zwykłe wdrożenie z `--update-env-vars SUFFIX=_test` zachowuje KONTA/ADMIN_SECRET/RL_*. Na live: prod potrzebuje env `KONTA=1` i `ADMIN_SECRET` (przez `--env-vars-file` z pliku w scratchpadzie, żeby sekret nie trafił do wiersza poleceń) i przeniesienia `KONTA = TEST` → `true`.
