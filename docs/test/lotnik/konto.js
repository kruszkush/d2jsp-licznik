// konto.js — konto gracza w okienku końca gry (E2): po wyniku zapisanym na serwerze nick + hasło
// („Załóż konto” / „Zaloguj” / „Mam kod od admina”), wynik idzie na konto. Nick zalogowanego gracza stoi na górze karty
// (`player`), ramka (`node`) znika przy koncie zweryfikowanym, a komunikaty o zapisie idą do linii statusu (`status`). Konto niezweryfikowane = na czerwono z kodem LOT-xxxx
// i przyciskiem „Zweryfikuj” (E3: post z kodem w temacie forum, licznik zgłasza go serwerowi). Token sesji w localStorage; serwer: serwer/konta.js.
const KEY = 'lotnik.konto';
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
.lotnik-card .lt-av{flex:none;width:26px;height:26px;border-radius:50%;background:#334155 center/cover no-repeat;border:1px solid rgba(248,250,252,.35)}
.lotnik-card .lt-out{margin-top:14px;padding-top:8px;border-top:1px solid rgba(248,250,252,.1)}
.lotnik-card .lt-logout{background:none;border:0;padding:4px 8px;color:#64748b;font:500 11px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;cursor:pointer;text-decoration:underline}
.lotnik-card .lt-logout:hover{color:#cbd5e1}
.lotnik-card .lt-out-ask{font-size:11px;color:#cbd5e1;margin-right:2px}
.lotnik-card .lt-logout-yes{color:#f87171}
.lotnik-card .lt-acc-red{color:#f87171}
.lotnik-card .lt-acc-msg{margin-top:5px;color:#cbd5e1;line-height:1.35;white-space:pre-line}
.lotnik-card .lt-acc-err{color:#fca5a5}
.lotnik-card .lt-acc-kod{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
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
export function createKonto(apiPost, el, avatars, status, onAuth) {
  const auth = function (on) { if (onAuth) onAuth(on); };   // E5: nakladka.js wczytuje/scala ekwipunek
  const box = el('div', 'lt-acc');
  box.hidden = true;
  const player = el('div', 'lt-acc-nick');
  player.hidden = true;
  const out = el('div', 'lt-out');
  out.hidden = true;
  let acc = load();
  let lastR = null;
  let seq = 0;

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
  }

  // Ramka konta tylko dla niezweryfikowanego (kod, „Zweryfikuj”); msg = komunikat weryfikacji w ramce.
  function showAccount(msg, err) {
    box.replaceChildren();
    const k = acc.konto;
    renderPlayer();
    out.hidden = false;
    box.hidden = !!k.verified;
    if (!k.verified) {
      const line = el('div', 'lt-acc-msg lt-acc-red lt-acc-kod', 'Konto niezweryfikowane · kod ' + k.kod + ' ');
      line.appendChild(button('Skopiuj', 'lt-acc-copy', function () {
        showAccount(copyText(k.kod) ? 'Kod ' + k.kod + ' skopiowany.' : 'Nie udało się skopiować, przepisz kod ręcznie.', false);
      }));
      box.appendChild(line);
      box.appendChild(el('div', 'lt-acc-msg',
        '„Zweryfikuj” kopiuje kod i otwiera temat na forum: napisz tam NOWY post z kodem (edycji starego posta nie widać). ' +
        'Nick na d2jsp musi być dokładnie taki jak tu. Sprawdzenie trwa do kilku godzin.\n' +
        'Masz 3 dni od założenia konta, inaczej wynik nie trafi do rankingu.'));
    }
    if (msg) box.appendChild(el('div', 'lt-acc-msg' + (err ? ' lt-acc-err' : ''), msg));
    if (!k.verified) {
      const row = el('div', 'lt-acc-row');
      row.appendChild(button('Zweryfikuj', '', verify));
      box.appendChild(row);
    }
  }

  function showForm(msg, withCode) {
    box.replaceChildren();
    box.hidden = false;
    out.hidden = true;
    renderPlayer();
    box.appendChild(el('div', 'lt-acc-msg', withCode ? 'Kod od admina: wpisz nick, kod i nowe hasło.'
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
          if (r.j.wynik || r.j.wynikBlad) status(r.j.wynik ? '' : r.j.wynikBlad, !!r.j.wynikBlad);
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
  function onResult(res) {
    const my = ++seq;
    lastR = res && res.saved && res.r ? res.r : null;
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
        showAccount();
        status('');   // zapisany: bez komunikatu, nick stoi obok metrów
      } else {
        status('Wynik nie trafił na konto: ' + (r.j.error || 'błąd serwera'), true);
      }
    });
  }

  function hide() {
    seq++;
    lastR = null;
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
  return { node: box, out: out, player: player, onResult: onResult, hide: hide, token: function () { return acc ? acc.token : null; } };
}
