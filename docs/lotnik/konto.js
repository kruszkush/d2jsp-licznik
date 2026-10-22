// konto.js — konto gracza w okienku końca gry (E2): po wyniku zapisanym na serwerze nick + hasło
// („Załóż konto” / „Zaloguj” / „Mam kod od admina”), wynik idzie na konto. Nick zalogowanego gracza stoi na górze karty
// (`player`), ramka (`node`) znika przy koncie zweryfikowanym, a komunikaty o zapisie idą do linii statusu (`status`). Konto niezweryfikowane = na czerwono z kodem LOT-xxxx
// i przyciskiem „Zweryfikuj” (E3: post z kodem w temacie forum, licznik zgłasza go serwerowi). Token sesji w localStorage; serwer: serwer/konta.js.
let KEY = 'lotnik.konto';   // createKonto dokleja przedrostek (prod: „p.”, osobno od /test/ na tej samej domenie)
const VERIFY_URL = 'https://forums.d2jsp.org/topic.php?t=110398796&f=230&v=1';   // temat weryfikacji (ostatnia strona)

export const KONTO_CSS = `
.lotnik-card .lt-acc{margin-top:10px;padding:9px;border:1px solid rgba(248,250,252,.18);border-radius:10px;background:rgba(255,255,255,.05);text-align:left;font-size:11px}
.lotnik-card .lt-acc input{display:block;box-sizing:border-box;width:100%;margin:5px 0 0;padding:8px 9px;border-radius:8px;border:1px solid rgba(248,250,252,.25);background:rgba(2,6,23,.6);color:#f8fafc;font:500 13px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.lotnik-card .lt-acc-row{display:flex;gap:6px;margin-top:7px}
.lotnik-card .lt-acc-row .lotnik-btn{flex:1;padding:9px 6px;font-size:11px}
.lotnik-card .lt-acc-link{background:none;border:0;color:#94a3b8;font:500 10px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:6px 0 0;cursor:pointer;text-decoration:underline}
.lotnik-card .lt-acc-nick{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:8px;font-size:15px;font-weight:800}
.lotnik-card .lt-acc-nick a{color:inherit;text-decoration:none}
.lotnik-card .lt-acc-nick a:hover{text-decoration:underline}
.lotnik-card .lt-ver{flex:none;display:inline-grid;place-items:center;width:16px;height:16px;border-radius:50%;background:#22c55e;color:#052e16;font-size:10px;font-weight:900}
.lotnik-card .lt-av{flex:none;width:26px;height:26px;border-radius:50%;background:#334155 center/cover no-repeat;border:1px solid rgba(248,250,252,.35)}
.lotnik-card .lt-out{margin-top:14px;padding-top:8px;border-top:1px solid rgba(248,250,252,.1)}
.lotnik-card .lt-logout{background:none;border:0;padding:4px 8px;color:#64748b;font:500 11px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;cursor:pointer;text-decoration:underline}
.lotnik-card .lt-logout:hover{color:#cbd5e1}
.lotnik-card .lt-out-ask{font-size:11px;color:#cbd5e1;margin-right:2px}
.lotnik-card .lt-logout-yes{color:#f87171}
.lotnik-card .lt-acc-red{color:#f87171}
.lotnik-card .lt-acc-msg{margin-top:5px;color:#cbd5e1;line-height:1.35;white-space:pre-line}
.lotnik-card .lt-acc-msg.lt-acc-red{color:#f87171}
.lotnik-card .lt-acc-warn{font-weight:700;text-align:center}
.lotnik-card .lt-acc-err{color:#fca5a5}
.lotnik-card .lt-acc-head{text-align:center;font-weight:700;font-size:12px;margin-top:0}
.lotnik-card .lt-acc-code{display:block;margin:7px auto 0;padding:7px 16px;border:2px dashed #f87171;border-radius:10px;background:none;font:800 20px/1.2 ui-monospace,Consolas,monospace;letter-spacing:2px;color:#fecaca;cursor:pointer}
.lotnik-card .lt-acc-code:hover{background:rgba(248,113,113,.12)}
.lotnik-card .lt-acc-go{background:#fbbf24;border-color:#fbbf24;color:#111827;font-weight:800}
.lotnik-card .lt-acc-go:hover{background:#fcd34d}
.lotnik-card .lt-acc-days{color:#fbbf24}
.lotnik-card .lt-acc-wait{text-align:center;font-weight:700;font-size:12px;color:#fbbf24}
.lotnik-card .lt-acc-tip{margin-top:7px;padding:6px 8px;border-radius:8px;background:rgba(248,113,113,.1);color:#fecaca;line-height:1.35}
.lotnik-card .lt-acc-line{display:flex;justify-content:center;align-items:center;gap:6px;flex-wrap:wrap;margin-top:7px;color:#94a3b8}
.lotnik-card .lt-acc-chip{padding:2px 8px;border:1px dashed #f87171;border-radius:6px;background:none;font:700 12px/1.3 ui-monospace,Consolas,monospace;color:#fecaca;cursor:pointer}
.lotnik-card .lt-acc-line .lt-acc-link{padding:0;font-size:11px;color:#93c5fd}
.lotnik-card .lt-acc.lt-acc-green{border-color:rgba(74,222,128,.45);background:rgba(74,222,128,.08)}
.lotnik-card .lt-acc-ok{text-align:center;color:#86efac;font-weight:800;font-size:13px}
.lotnik-card .lt-acc-ok-sub{font-weight:500;font-size:11px;margin-top:3px;color:#bbf7d0}
.lotnik-card .lt-acc-hint{text-align:center;font-size:10px;color:#94a3b8;margin-top:3px}
.lotnik-card .lt-acc-how{text-align:center;margin-top:7px}
.lotnik-card .lt-acc-more{margin-top:7px;color:#cbd5e1}
.lotnik-card .lt-acc-more summary{cursor:pointer;color:#93c5fd;text-align:center;font-size:11px}
.lotnik-card .lt-acc-more ul{margin:5px 0 0;padding-left:16px;line-height:1.35}
.lotnik-card .lt-acc-copy{padding:4px 8px;font-size:10px;line-height:1.2}
.lotnik-card .lt-acc[hidden],.lotnik-card .lt-out[hidden],.lotnik-card .lt-acc-nick[hidden]{display:none!important}
`;

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    return d && typeof d.token === 'string' && d.konto ? d : null;
  } catch (e) { return null; }
}
function store(d) {
  try {
    if (d) localStorage.setItem(KEY, JSON.stringify(d));
    else localStorage.removeItem(KEY);
  } catch (e) { /* tryb prywatny: konto tylko do odświeżenia strony */ }
}

// Kopia do schowka bez pytania o uprawnienia: zaznaczony tekst + execCommand w kliknięciu (navigator.clipboard
// potrafi pytać o zgodę, gdy strona traci fokus). Zwraca true, gdy się udało.
function copyText(text) {
  const t = document.createElement('textarea');
  t.value = text;
  t.setAttribute('readonly', '');
  t.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  document.body.appendChild(t);
  t.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  t.remove();
  return ok;
}

// apiPost(path, body, ms) → Promise<{ ok, j }> (nakladka.js); el(tag, cls, text); avatars() → D.avatars strony;
// status(msg, err) → linia statusu karty. `out` = „Wyloguj” jako cichy link: nakladka.js wstawia go na sam dół karty,
// `player` = nick gracza: nakladka.js wstawia go nad metrami. onAuth(zalogowany) po logowaniu/rejestracji i wylogowaniu.
export function createKonto(apiPost, el, avatars, status, onAuth, lsPrefix) {
  KEY = (lsPrefix || '') + 'lotnik.konto';
  const auth = function (on) { if (onAuth) onAuth(on); };   // E5: nakladka.js wczytuje/scala ekwipunek
  const box = el('div', 'lt-acc');
  box.hidden = true;
  const player = el('div', 'lt-acc-nick');
  player.hidden = true;
  const out = el('div', 'lt-out');
  out.hidden = true;
  let acc = load();
  let lastR = null;
  let savedOn = '';   // nick konta, na które /claim zapisał wynik tej karty (po wylogowaniu wynik zostaje na nim)
  let seq = 0;
  let onWynik = null;   // karta tej partii: rekord konta i miejsce w rankingu z /claim (wynik.rank)
  const bestKey = function () { return (lsPrefix || '') + 'lotnik.best.' + (acc && acc.konto.id); };
  function gotWynik(w, my) {
    if (!w || !w.rank || my !== seq) return;
    try { localStorage.setItem(bestKey(), String(Math.floor(w.rank.best || 0))); } catch (e) { /* ignoruj */ }
    if (onWynik) onWynik(w.rank);
  }
  // Najlepszy wynik konta zapamiętany na tym urządzeniu po ostatnim /claim (null = nieznany, np. nowe urządzenie).
  function best() {
    if (!acc) return null;
    let v = null;
    try { v = localStorage.getItem(bestKey()); } catch (e) { v = null; }
    return v == null ? null : Number(v) || 0;
  }

  function stop(fn) {
    return function (e) { e.preventDefault(); e.stopPropagation(); fn(); };
  }
  function button(text, cls, fn) {
    const b = el('button', 'lotnik-btn' + (cls ? ' ' + cls : ''), text);
    b.type = 'button';
    b.addEventListener('click', stop(fn));
    return b;
  }

  // Zweryfikowane konto: awatar z forum (D.avatars[uid]) i nick jako link do profilu d2jsp.
  function renderPlayer() {
    const row = player;
    row.replaceChildren();
    row.hidden = !acc;
    if (!acc) return;
    const k = acc.konto;
    row.classList.toggle('lt-acc-red', !k.verified);
    const uid = k.verified && /^\d+$/.test(String(k.uid || '')) ? String(k.uid) : '';
    const url = uid ? ((avatars && avatars()) || {})[uid] : '';
    if (url) {
      const av = el('span', 'lt-av');
      av.style.backgroundImage = 'url("' + String(url).replace(/"/g, '%22') + '")';
      row.appendChild(av);
    }
    if (uid) {
      const a = el('a', null, k.nick);
      a.href = 'https://forums.d2jsp.org/user.php?i=' + uid;
      a.target = '_blank';
      a.rel = 'noopener';
      a.title = 'Profil na d2jsp';
      row.appendChild(a);
    } else {
      row.appendChild(el('span', null, k.nick));
    }
    if (k.verified) {
      const v = el('span', 'lt-ver', '✓');
      v.title = 'Konto zweryfikowane';
      row.appendChild(v);
    }
  }

  // Stan weryfikacji na tym urządzeniu (localStorage, per konto): { seen: widziane niezweryfikowane, at: kiedy kliknięto
  // „Zweryfikuj” (0 = jeszcze nie), ok: pokazano „zweryfikowane” }.
  const verKey = function (k) { return (lsPrefix || '') + 'lotnik.wer.' + k.id; };
  function verGet(k) {
    try { return JSON.parse(localStorage.getItem(verKey(k)) || 'null') || {}; } catch (e) { return {}; }
  }
  function verSet(k, v) {
    try { localStorage.setItem(verKey(k), JSON.stringify(v)); } catch (e) { /* tryb prywatny */ }
  }
  // „Zostały 2 dni 14 h” do końca 3 dni od założenia (created z serwera); brak daty = null.
  function timeLeft(k) {
    if (!Number.isFinite(k.created)) return null;
    const s = Math.max(0, k.created + 3 * 86400 - Date.now() / 1000);
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
    return d ? d + (d === 1 ? ' dzień ' : ' dni ') + h + ' h' : h + ' h';
  }
  function daysLine(k, long) {
    const left = timeLeft(k);
    const line = el('div', 'lt-acc-msg lt-acc-how');
    if (left == null) line.textContent = 'Wynik trafi do rankingu po weryfikacji. Masz na nią 3 dni od założenia konta.';
    else if (long) line.append('Wynik trafi do rankingu po weryfikacji. Zostały na nią ', el('b', 'lt-acc-days', left), '.');
    else line.append('Zostały ', el('b', 'lt-acc-days', left), '.');
    return line;
  }
  function copyKod(k) {
    showAccount(copyText(k.kod) ? 'Kod ' + k.kod + ' skopiowany.' : 'Nie udało się skopiować, przepisz kod ręcznie.', false);
  }

  // Ramka konta: niezweryfikowane (przed kliknięciem „Zweryfikuj” pełna, potem mała „w toku”, po 6 h z podpowiedzią),
  // zweryfikowane: raz zielone potwierdzenie, potem bez ramki. msg = komunikat w ramce. Makieta: out/makieta-weryfikacja.html.
  function showAccount(msg, err) {
    box.replaceChildren();
    const k = acc.konto;
    const v = verGet(k);
    renderPlayer();
    out.hidden = false;
    if (k.verified) {
      box.hidden = !v.seen || v.ok;   // potwierdzenie tylko, gdy to urządzenie widziało konto niezweryfikowane
      if (box.hidden) return;
      verSet(k, { seen: true, at: v.at, ok: true });
      const ok = el('div', 'lt-acc-ok', '✓ Konto zweryfikowane');
      ok.appendChild(el('div', 'lt-acc-ok-sub', 'Twoje wyniki są w rankingu, a nick jest zarezerwowany.'));
      box.appendChild(ok);
      box.classList.add('lt-acc-green');
      return;
    }
    box.classList.remove('lt-acc-green');
    box.hidden = false;
    if (!v.seen) verSet(k, { seen: true, at: 0 });   // „widziane niezweryfikowane” → po weryfikacji jedno potwierdzenie
    if (v.at > 0) {
      box.appendChild(el('div', 'lt-acc-wait', '⏳ Weryfikacja w toku'));
      if (Date.now() - v.at > 6 * 3600 * 1000) {
        const tip = el('div', 'lt-acc-tip');
        tip.append('Długo to trwa. Sprawdź, czy nick na d2jsp jest ', el('b', null, 'taki sam'), ' jak tu i czy kod jest w ',
          el('b', null, 'nowym'), ' poście (edycji nie widać).');
        box.appendChild(tip);
      } else {
        const how = el('div', 'lt-acc-msg lt-acc-how');
        how.append('Zwykle trwa około ', el('b', null, '2 godzin'), '. Nic więcej nie musisz robić.');
        box.appendChild(how);
      }
      const row = el('div', 'lt-acc-line');
      row.append('kod ');
      const chip = button(k.kod, 'lt-acc-chip', function () { copyKod(k); });
      chip.title = 'Kliknij, aby skopiować';
      row.appendChild(chip);
      row.appendChild(button('Otwórz temat jeszcze raz', 'lt-acc-link', verify));
      box.appendChild(row);
      if (msg) box.appendChild(el('div', 'lt-acc-msg' + (err ? ' lt-acc-err' : ''), msg));
      box.appendChild(daysLine(k, false));
      return;
    }
    box.appendChild(el('div', 'lt-acc-msg lt-acc-red lt-acc-head', '⚠ Konto niezweryfikowane'));
    // Duży kod w przerywanej ramce: klik kopiuje.
    const code = button(k.kod, 'lt-acc-code', function () { copyKod(k); });
    code.title = 'Kliknij, aby skopiować';
    box.appendChild(code);
    box.appendChild(el('div', 'lt-acc-hint', 'kliknij kod, aby skopiować'));
    const how = el('div', 'lt-acc-msg lt-acc-how');
    how.append('Wklej kod w ', el('b', null, 'nowym poście'), ' w temacie licznika. Sprawdzenie trwa około ',
      el('b', null, '2 godzin'), '.');
    box.appendChild(how);
    if (msg) box.appendChild(el('div', 'lt-acc-msg' + (err ? ' lt-acc-err' : ''), msg));
    box.appendChild(el('div', 'lt-acc-msg lt-acc-red lt-acc-warn', 'NICK MUSI BYĆ TAKI SAM JAK NA D2JSP'));
    const row = el('div', 'lt-acc-row');
    row.appendChild(button('Zweryfikuj', 'lt-acc-go', verify));
    box.appendChild(row);
    box.appendChild(daysLine(k, true));
    const more = el('details', 'lt-acc-more');
    more.appendChild(el('summary', null, 'Jak to działa?'));
    const ul = el('ul');
    ['„Zweryfikuj” kopiuje kod i otwiera temat licznika na forum.', 'Edycji starego posta nie widać, musi być nowy post.'].forEach(function (t) { ul.appendChild(el('li', null, t)); });
    more.appendChild(ul);
    box.appendChild(more);
  }

  function showForm(msg, withCode) {
    box.replaceChildren();
    box.hidden = false;
    out.hidden = true;
    renderPlayer();
    box.appendChild(el('div', 'lt-acc-msg', withCode ? 'Kod od admina: wpisz nick, kod i nowe hasło.'
      : savedOn ? 'Ten wynik jest zapisany na koncie ' + savedOn + '. Zaloguj się albo załóż konto na następne gry.'
      : 'Aby zapisać wynik, zaloguj się albo załóż konto. Nick taki sam jak na d2jsp.'));
    const nick = el('input');
    nick.placeholder = 'Nick (jak na d2jsp)';
    nick.maxLength = 20;
    nick.autocomplete = 'username';
    const code = el('input');
    code.placeholder = 'Kod od admina (XXXX-XXXX)';
    code.maxLength = 12;
    const pw = el('input');
    pw.type = 'password';
    pw.placeholder = withCode ? 'Nowe hasło (min. 6 znaków)' : 'Hasło (min. 6 znaków)';
    pw.maxLength = 200;
    pw.autocomplete = withCode ? 'new-password' : 'current-password';
    box.appendChild(nick);
    if (withCode) box.appendChild(code);
    box.appendChild(pw);
    const err = el('div', 'lt-acc-msg lt-acc-err', msg || '');
    err.hidden = !msg;
    const row = el('div', 'lt-acc-row');
    const send = function (path) {
      return function () {
        const body = { nick: nick.value, password: pw.value };
        if (withCode) body.code = code.value;
        if (lastR) body.r = lastR;
        err.hidden = false;
        err.textContent = 'Chwila…';
        const my = seq;
        apiPost(path, body, 10000).then(function (r) {
          if (!r.ok || typeof r.j.token !== 'string') {
            err.textContent = r.j.error || 'błąd serwera';
            return;
          }
          acc = { token: r.j.token, konto: r.j.konto };
          store(acc);
          auth(true);
          if (r.j.wynik) lastR = null;
          showAccount();
          gotWynik(r.j.wynik, my);
          if (r.j.wynik || r.j.wynikBlad) status(r.j.wynik ? '' : r.j.wynikBlad, !!r.j.wynikBlad);
          else if (savedOn && savedOn !== acc.konto.nick) status('Ten wynik jest zapisany na koncie ' + savedOn + '.');
        });
      };
    };
    if (withCode) {
      row.appendChild(button('Ustaw hasło', 'lt-keep', send('/redeem')));
    } else {
      row.appendChild(button('Załóż konto', 'lt-keep', send('/register')));
      row.appendChild(button('Zaloguj', '', send('/login')));
    }
    box.appendChild(row);
    box.appendChild(err);
    box.appendChild(button(withCode ? 'Wróć' : 'Mam kod od admina', 'lt-acc-link', function () { showForm('', !withCode); }));
  }

  // Kod do schowka, potem temat weryfikacji w nowej karcie (kopia przed otwarciem: karta zabiera fokus stronie).
  function verify() {
    const kod = acc && acc.konto.kod;
    const ok = kod && copyText(kod);
    window.open(VERIFY_URL, '_blank', 'noopener');
    if (kod && !(verGet(acc.konto).at > 0)) verSet(acc.konto, { seen: true, at: Date.now() });   // od teraz mała ramka „w toku”
    if (kod) showAccount(ok ? 'Kod ' + kod + ' skopiowany, wklej go w nowym poście.' : 'Nie udało się skopiować, przepisz kod ' + kod + ' w poście.', !ok);
  }

  function logout() {
    const t = acc && acc.token;
    acc = null;
    store(null);
    if (t) apiPost('/logout', { token: t }, 5000);
    auth(false);
    showForm();
  }

  // Wynik zapisany na serwerze (`r` z /end): zalogowany → na konto, inaczej formularz.
  function onResult(res, cb) {
    const my = ++seq;
    onWynik = cb || null;
    lastR = res && res.saved && res.r ? res.r : null;
    savedOn = '';
    if (!lastR) { box.hidden = true; out.hidden = true; return; }
    if (!acc) { showForm(); return; }
    showAccount();
    status('Zapisywanie wyniku na koncie…');
    apiPost('/claim', { token: acc.token, r: lastR }, 10000).then(function (r) {
      if (my !== seq) return;
      if (r.j.relogin) {
        acc = null;
        store(null);
        showForm('To urządzenie zostało wylogowane, zaloguj się ponownie.');
        return;
      }
      if (r.ok && r.j.konto) {
        acc.konto = r.j.konto;
        store(acc);
        lastR = null;
        savedOn = acc.konto.nick;
        showAccount();
        status('');   // zapisany: bez komunikatu, nick stoi obok metrów
        gotWynik(r.j.wynik, my);
      } else {
        status('Wynik nie trafił na konto: ' + (r.j.error || 'błąd serwera'), true);
      }
    });
  }

  function hide() {
    seq++;
    lastR = null;
    savedOn = '';
    box.hidden = true;
    out.hidden = true;
    outLink(false);
    renderPlayer();
  }

  // „Wyloguj” pyta w tym samym miejscu: „Na pewno wylogować? Tak · Nie” (bez okienka przeglądarki).
  function outLink(ask) {
    out.replaceChildren();
    if (!ask) {
      out.appendChild(button('Wyloguj', 'lt-logout', function () { outLink(true); }));
      return;
    }
    out.appendChild(el('span', 'lt-out-ask', 'Na pewno wylogować?'));
    out.appendChild(button('Tak', 'lt-logout lt-logout-yes', function () { outLink(false); logout(); }));
    out.appendChild(button('Nie', 'lt-logout', function () { outLink(false); }));
  }
  outLink(false);
  return { node: box, out: out, player: player, onResult: onResult, hide: hide, best: best, token: function () { return acc ? acc.token : null; } };
}
