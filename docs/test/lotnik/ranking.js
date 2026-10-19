// ranking.js — panel rankingu w nakładce (E4): ogólny / tydzień / dzień, top 10, moje miejsce, liczba graczy.
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
.lotnik-rank .lt-rank-row{display:flex;align-items:center;gap:8px;padding:5px 4px;border-top:1px solid rgba(248,250,252,.08)}
.lotnik-rank a.lt-rank-row{color:inherit;text-decoration:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
.lotnik-rank a.lt-rank-row:hover .lt-rank-nick{text-decoration:underline}
.lotnik-rank .lt-rank-me{background:rgba(251,191,36,.14);border-radius:8px}
.lotnik-rank .lt-rank-pos{width:26px;text-align:right;font-weight:800;color:#94a3b8;flex:none}
.lotnik-rank .lt-rank-av{width:26px;height:26px;border-radius:50%;flex:none;background-color:#334155;background-position:center;background-size:cover;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;color:#fff}
.lotnik-rank .lt-rank-nick{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}
.lotnik-rank .lt-rank-m{font-weight:800;color:#fbbf24;flex:none}
.lotnik-rank .lt-rank-gap{text-align:center;color:#64748b;padding:2px 0}
.lotnik-rank .lt-rank-note{margin-top:8px;font-size:10px;color:#94a3b8;line-height:1.45}
.lotnik-rank[hidden]{display:none!important}
`;

const LETTER_BG = ['#7c3aed', '#2563eb', '#0891b2', '#059669', '#ca8a04', '#ea580c', '#dc2626', '#db2777'];
function letterColor(nick) {
  let h = 0;
  for (let i = 0; i < nick.length; i++) h = (h * 31 + nick.charCodeAt(i)) >>> 0;
  return LETTER_BG[h % LETTER_BG.length];
}

// apiPost(path, body, ms) → Promise<{ ok, j }>; el(tag, cls, text); token() → token sesji albo null; avatars() → D.avatars.
export function createRanking(apiPost, el, token, avatars) {
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

  function avatar(e) {
    const a = el('div', 'lt-rank-av');
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
  // Zweryfikowany gracz: cały wiersz to link do profilu na d2jsp (jak nick w konto.js).
  function row(e, me) {
    const link = e.verified && /^\d{1,12}$/.test(String(e.uid || ''));
    const r = el(link ? 'a' : 'div', 'lt-rank-row' + (me ? ' lt-rank-me' : ''));
    if (link) {
      r.href = 'https://forums.d2jsp.org/user.php?i=' + e.uid;
      r.target = '_blank';
      r.rel = 'noopener';
      r.title = 'Profil na d2jsp';
    }
    r.appendChild(el('div', 'lt-rank-pos', e.rank + '.'));
    r.appendChild(avatar(e));
    r.appendChild(el('div', 'lt-rank-nick', e.nick));
    r.appendChild(el('div', 'lt-rank-m', e.meters + ' m'));
    return r;
  }

  function render() {
    tabBtns.forEach(function (b, i) { b.className = 'lotnik-btn' + (TABS[i][0] === tab ? ' lt-on' : ''); });
    body.replaceChildren();
    if (!data) return;
    if (data.error) { body.appendChild(el('div', 'lt-rank-note', data.error)); return; }
    const o = data.okresy[tab];
    if (!o || !o.top.length) { body.appendChild(el('div', 'lt-rank-note', 'Nikt jeszcze nie zapisał wyniku w tym okresie.')); return; }
    const me = o.me;
    let meShown = false;
    o.top.forEach(function (e) {
      const isMe = !!me && !meShown && e.rank === me.rank && e.nick === me.nick && e.meters === me.meters;
      if (isMe) meShown = true;
      body.appendChild(row(e, isMe));
    });
    if (me && !meShown) {
      body.appendChild(el('div', 'lt-rank-gap', '…'));
      body.appendChild(row(me, true));
    }
    let note = 'Graczy: ' + o.total + '.';
    if (!token()) note += ' Zaloguj się po grze, żeby zobaczyć swoje miejsce.';
    else if (!me) note += ' Nie masz jeszcze wyniku w tym okresie.';
    note += '\nLiczy się najlepszy lot konta. Konto niezweryfikowane znika z rankingu po 3 dniach.';
    const n = el('div', 'lt-rank-note', note);
    n.style.whiteSpace = 'pre-line';
    body.appendChild(n);
  }

  function load() {
    const my = ++seq;
    const t = token();
    apiPost('/ranking', t ? { token: t } : {}, 8000).then(function (r) {
      if (my !== seq) return;
      data = r.ok && r.j.okresy ? r.j : { error: 'Ranking niedostępny: ' + (r.j.error || 'błąd serwera') };
      render();
    });
  }

  function open() {
    panel.hidden = false;
    render();
    if (!data) body.appendChild(el('div', 'lt-rank-note', 'Ładowanie…'));
    load();
  }
  function hide() {
    seq++;
    panel.hidden = true;
  }

  return { node: panel, open: open, hide: hide };
}
