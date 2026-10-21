// ranking.js — ranking (E4): ogólny / tydzień / dzień, top 10, moje miejsce, liczba graczy. Te same wiersze w dwóch obudowach:
// panel w nakładce (przycisk „Ranking” na karcie końca gry) i karta na stronie licznika (zawsze widoczna, miejsce po Piłeczce).
// Wiersz jak w Piłeczce (d2jsp-licznik/docs/gra.js showRank): 📱/🖥️ przy wyniku, liczba gier w okresie, klik = ekwipunek
// z rekordowego lotu (onRow → POST /ekw w nakladka.js); przy nicku verified / unverified.
// Serwer: POST /ranking {token?} (serwer/ranking.js). Awatar: konto zweryfikowane → D.avatars[uid] ze strony licznika,
// niezweryfikowane (albo brak obrazka) → kółko z pierwszą literą nicku.
const TABS = [['a', 'Ogólny'], ['w', 'Tydzień'], ['d', 'Dzień']];

export const RANKING_CSS = `
.lotnik-rank{position:absolute;left:50%;top:7%;transform:translateX(-50%);width:min(380px,calc(100vw - 24px));max-height:86vh;overflow:auto;background:rgba(15,23,42,.98);border:1px solid rgba(248,250,252,.22);border-radius:16px;padding:14px;color:#f8fafc;box-shadow:0 18px 50px rgba(0,0,0,.55);z-index:4;font:500 12px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.lotnik-rank h3{font-size:15px;margin:0 0 10px;padding-right:34px}
.lotnik-rank .lt-rank-close{position:absolute;right:8px;top:8px;width:30px;height:30px;padding:0;font-size:13px;line-height:1}
.lotnik-rank .lt-rank-tabs{display:flex;gap:6px;margin-bottom:8px}
.lotnik-rank .lt-rank-tabs .lotnik-btn{flex:1;padding:8px 6px;font-size:11px}
.lotnik-rank .lt-rank-tabs .lt-on{background:#fbbf24;border-color:#fbbf24;color:#111827}
.lotnik-rank .lt-r{display:flex;align-items:center;gap:8px;padding:5px 4px;border-top:1px solid rgba(248,250,252,.08)}
.lotnik-rank .lt-r.clk{cursor:pointer;-webkit-tap-highlight-color:transparent}
.lotnik-rank .lt-r.clk:hover .lt-r-nick{text-decoration:underline}
.lotnik-rank .lt-r.me{background:rgba(251,191,36,.14);border-radius:8px}
.lotnik-rank .lt-r-pos{width:26px;text-align:right;font-weight:800;color:#94a3b8;flex:none}
.lotnik-rank .lt-r-av{width:26px;height:26px;border-radius:50%;flex:none;background-color:#334155;background-position:center;background-size:cover;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;color:#fff}
.lotnik-rank .lt-r-pn{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.25}
.lotnik-rank .lt-r-nick{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}
.lotnik-rank .lt-r-vf{font-size:10px;font-weight:700;color:#94a3b8}
.lotnik-rank .lt-r-vf.ok{color:#4ade80}
.lotnik-rank .lt-r-m{font-weight:800;color:#fbbf24;flex:none;text-align:right}
.lotnik-rank .lt-r-dev{font-size:12px;margin-right:5px;font-weight:400}
.lotnik-rank .lt-r-plays{display:block;font-size:10px;color:#94a3b8;font-weight:500}
.lt-r-play{flex:none;width:28px;height:28px;border-radius:50%;border:0;padding:0 0 0 2px;font-size:12px;line-height:28px;cursor:pointer;
  background:#dc2626;color:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35)}
.lt-r-play:hover{background:#ef4444}
.lotnik-rank .lt-r-gap{text-align:center;color:#64748b;padding:2px 0}
.lotnik-rank .lt-rank-note{margin-top:8px;font-size:10px;color:#94a3b8;line-height:1.45;white-space:pre-line}
.lotnik-rank[hidden]{display:none!important}
.lt-prank .lt-prank-tabs{display:flex;gap:4px;margin:0 0 8px}
.lt-prank .lt-prank-tabs button{flex:1;font-size:12px;padding:3px 6px;border-radius:8px}
.lt-prank .lt-prank-hint{font-size:12.5px;line-height:1.4;color:var(--mute);background:rgba(127,127,127,.08);border-radius:8px;padding:6px 9px;margin:0 0 8px}
.lt-prank .lt-prank-list{margin:0;padding:0}
.lt-prank .lt-r{list-style:none;display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--line);font-size:14px}
.lt-prank .lt-r:last-child{border:0}
.lt-prank .lt-r.clk{cursor:pointer;border-radius:6px;margin:0 -8px;padding-left:8px;padding-right:8px}
.lt-prank .lt-r.clk:hover{background:var(--bg)}
.lt-prank .lt-r.me{color:var(--acc);font-weight:700}
.lt-prank .lt-r-pos{width:22px;color:var(--mute);flex:none}
.lt-prank .lt-r-av{width:20px;height:20px;border-radius:50%;flex:none;background:var(--line) center/cover;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#fff}
.lt-prank .lt-r-pn{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.25}
.lt-prank .lt-r-nick{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lt-prank .lt-r-vf{font-size:11px;font-weight:600;color:var(--mute)}
.lt-prank .lt-r-vf.ok{color:#1f9d55}
.lt-prank .lt-r-m{flex:none;text-align:right;font-variant-numeric:tabular-nums}
.lt-prank .lt-r-dev{font-size:12px;margin-right:5px;opacity:.8;font-weight:400}
.lt-prank .lt-r-plays{display:block;font-size:10.5px;color:var(--mute);font-weight:400}
.lt-prank .lt-r-gap{justify-content:center;color:var(--mute);padding:0;border:0;line-height:1}
.lt-prank .lt-rank-note{list-style:none;text-align:center;color:var(--mute);font-size:12px;border:0;padding-top:8px;white-space:pre-line}
`;

const LETTER_BG = ['#7c3aed', '#2563eb', '#0891b2', '#059669', '#ca8a04', '#ea580c', '#dc2626', '#db2777'];
function letterColor(nick) {
  let h = 0;
  for (let i = 0; i < nick.length; i++) h = (h * 31 + nick.charCodeAt(i)) >>> 0;
  return LETTER_BG[h % LETTER_BG.length];
}

// Polska odmiana: 1 gra, 2–4 gry (bez 12–14), reszta gier (jak gra.js).
function games(n) {
  const few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
  return n + ' ' + (n === 1 ? 'gra' : few ? 'gry' : 'gier');
}

// Wspólne dla obu obudów: dane z serwera i rysowanie wierszy jednego okresu.
// apiPost(path, body, ms) → Promise<{ ok, j }>; el(tag, cls, text); token() → token sesji albo null; avatars() → D.avatars;
// onRow(e, watch) → klik w gracza (ekwipunek z rekordu) albo w ▶ (watch = true, nagranie lotu), tylko gdy wpis ma `gid`.
function makeRows(el, token, avatars, onRow) {
  function avatar(e) {
    const a = el('span', 'lt-r-av');
    const url = e.verified && e.uid ? (avatars() || {})[e.uid] : '';
    if (url) {
      a.style.backgroundImage = 'url("' + String(url).replace(/["\\]/g, '') + '")';
    } else {
      const nick = String(e.nick || '?');
      a.textContent = nick.trim().charAt(0).toUpperCase() || '?';
      a.style.backgroundColor = letterColor(nick);
    }
    return a;
  }

  function row(tag, e, me) {
    const clk = !!e.gid;
    const r = el(tag, 'lt-r' + (me ? ' me' : '') + (clk ? ' clk' : ''));
    if (clk) {
      r.title = 'Zobacz ekwipunek';
      r.setAttribute('role', 'button');
      r.tabIndex = 0;
      const go = function (ev) { ev.preventDefault(); ev.stopPropagation(); onRow(e); };
      r.addEventListener('click', go);
      r.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') go(ev); });
    }
    r.appendChild(el('span', 'lt-r-pos', e.rank + '.'));
    r.appendChild(avatar(e));
    const pn = el('span', 'lt-r-pn');
    pn.appendChild(el('span', 'lt-r-nick', e.nick));
    pn.appendChild(el('small', 'lt-r-vf' + (e.verified ? ' ok' : ''), e.verified ? 'verified' : 'unverified'));
    r.appendChild(pn);
    const m = el('b', 'lt-r-m');
    if (e.dev === 'm' || e.dev === 'd') {
      const d = el('span', 'lt-r-dev', e.dev === 'm' ? '📱' : '🖥️');
      d.title = e.dev === 'm' ? 'telefon' : 'komputer';
      m.appendChild(d);
    }
    m.appendChild(document.createTextNode(e.meters + ' m'));
    if (e.plays) m.appendChild(el('small', 'lt-r-plays', games(e.plays)));
    r.appendChild(m);
    if (clk) {   // nagranie rekordowego lotu (odtworzenie z wejść partii)
      const w = el('button', 'lt-r-play', '▶');
      w.type = 'button';
      w.title = 'Obejrzyj lot';
      w.setAttribute('aria-label', 'Obejrzyj rekordowy lot: ' + e.nick);
      w.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); onRow(e, true); });
      r.appendChild(w);
    }
    return r;
  }

  // Wiersze okresu `o` z odpowiedzi /ranking do `box` (tag: 'div' w panelu, 'li' w karcie strony).
  function fill(box, tag, data, o) {
    box.replaceChildren();
    if (!data) return;
    if (data.error) { box.appendChild(el(tag, 'lt-rank-note', data.error)); return; }
    const p = data.okresy[o];
    if (!p || !p.top.length) { box.appendChild(el(tag, 'lt-rank-note', 'Nikt jeszcze nie zapisał wyniku w tym okresie.')); return; }
    const me = p.me;
    let meShown = false;
    p.top.forEach(function (e) {
      const isMe = !!me && !meShown && e.rank === me.rank && e.nick === me.nick && e.meters === me.meters;
      if (isMe) meShown = true;
      box.appendChild(row(tag, e, isMe));
    });
    if (me && !meShown) {
      box.appendChild(el(tag, 'lt-r lt-r-gap', '…'));
      box.appendChild(row(tag, me, true));
    }
    let note = 'Graczy: ' + p.total + '.';
    if (!token()) note += ' Zaloguj się po grze, żeby zobaczyć swoje miejsce.';
    else if (!me) note += ' Nie masz jeszcze wyniku w tym okresie.';
    note += '\nLiczy się najlepszy lot konta. Konto niezweryfikowane znika z rankingu po 3 dniach.';
    box.appendChild(el(tag, 'lt-rank-note', note));
  }

  return { fill: fill };
}

// Pobranie rankingu (wspólne: karta strony i panel). cb(data) z { okresy } albo { error }.
function fetchRanking(apiPost, token, cb) {
  const t = token();
  apiPost('/ranking', t ? { token: t } : {}, 8000).then(function (r) {
    cb(r.ok && r.j.okresy ? r.j : { error: 'Ranking niedostępny: ' + (r.j.error || 'błąd serwera') });
  });
}

// Panel w nakładce.
export function createRanking(apiPost, el, token, avatars, onRow) {
  const rows = makeRows(el, token, avatars, onRow);
  const panel = el('div', 'lotnik-rank');
  panel.hidden = true;
  const close = el('button', 'lotnik-btn lotnik-x lt-rank-close', '✕');
  close.type = 'button';
  close.setAttribute('aria-label', 'Zamknij ranking');
  const tabs = el('div', 'lt-rank-tabs');
  const body = el('div');
  panel.appendChild(el('h3', null, 'Ranking'));
  panel.appendChild(close);
  panel.appendChild(tabs);
  panel.appendChild(body);
  let tab = 'a', data = null, seq = 0;

  function stop(fn) {
    return function (e) { e.preventDefault(); e.stopPropagation(); fn(); };
  }
  const tabBtns = TABS.map(function (t) {
    const b = el('button', 'lotnik-btn', t[1]);
    b.type = 'button';
    b.addEventListener('click', stop(function () { tab = t[0]; render(); }));
    tabs.appendChild(b);
    return b;
  });
  close.addEventListener('click', stop(hide));

  function render() {
    tabBtns.forEach(function (b, i) { b.className = 'lotnik-btn' + (TABS[i][0] === tab ? ' lt-on' : ''); });
    rows.fill(body, 'div', data, tab);
  }

  function open() {
    panel.hidden = false;
    render();
    if (!data) body.appendChild(el('div', 'lt-rank-note', 'Ładowanie…'));
    const my = ++seq;
    fetchRanking(apiPost, token, function (d) {
      if (my !== seq) return;
      data = d;
      render();
    });
  }
  function hide() {
    seq++;
    panel.hidden = true;
  }

  return { node: panel, open: open, hide: hide };
}

// Karta rankingu na stronie licznika: po karcie „Galeria sław” (#fame), jak karta Piłeczki. locked() → true, gdy serwer
// testowy czeka na hasło (wtedy bez zapytania). Zwraca { load } (np. po zalogowaniu hasłem albo po zapisanej partii).
export function mountPageRanking(apiPost, el, token, avatars, onRow, locked) {
  const fame = document.getElementById('fame');
  const after = fame && fame.closest('.card');
  if (!after) return { load: function () {} };
  const rows = makeRows(el, token, avatars, onRow);
  const card = el('div', 'card lt-prank');
  card.appendChild(el('h3', null, 'Lotnik · ranking'));
  const tabs = el('div', 'lt-prank-tabs');
  card.appendChild(tabs);
  card.appendChild(el('div', 'lt-prank-hint', 'Kliknij (na telefonie dotknij) spadający awatar, żeby zagrać.'));
  const list = el('ul', 'lt-prank-list');
  card.appendChild(list);
  after.after(card);
  let tab = 'a', data = null, seq = 0;
  const tabBtns = TABS.map(function (t) {
    const b = el('button', null, t[1]);
    b.type = 'button';
    b.addEventListener('click', function () { tab = t[0]; render(); });
    tabs.appendChild(b);
    return b;
  });

  function render() {
    tabBtns.forEach(function (b, i) { b.className = TABS[i][0] === tab ? 'on' : ''; });
    rows.fill(list, 'li', data, tab);
  }

  function load() {
    tabBtns.forEach(function (b, i) { b.className = TABS[i][0] === tab ? 'on' : ''; });
    if (locked()) {
      list.replaceChildren(el('li', 'lt-rank-note', 'Ranking po zalogowaniu hasłem testera.'));
      return;
    }
    if (!data) list.replaceChildren(el('li', 'lt-rank-note', 'Ładowanie…'));
    const my = ++seq;
    fetchRanking(apiPost, token, function (d) {
      if (my !== seq) return;
      data = d;
      render();
    });
  }
  load();
  return { load: load };
}
