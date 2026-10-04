// Spadające awatary + gra w podbijanie awatara. Ranking wspólny (funkcja w Google Cloud).
(() => {
  // Wersja testowa (/test/): osobna funkcja i kolekcje; ekwipunek włączony tylko tam
  const TEST = location.pathname.includes('/test/');
  const SUFIT = true; // zasady od 2.10.2026 (pełna siła podbicia bez sufitu — piłeczka może wylecieć nad ekran, odbicia za punkty, zawis, start ×1,25) — na obu stronach
  const SAFE_HITS = 3; // pierwsze 3 podbicia lekkie (start tuż pod górą nie wyrzuca piłeczki za ekran)
  const TEST_SAVES = TEST ? Math.min(20, Number(new URLSearchParams(location.search).get('odbicia')) || 0) : 0; // test: ?odbicia=3 na start
  const MELLOW = new URL('mellow.png', document.currentScript?.src || location.href).href; // emotka :mellow: z d2jsp (kopia w docs/)
  const EQON = true; // ekwipunek i przedmioty włączone także na oficjalnej stronie (narzędzie testowe tylko na /test/)
  const API = TEST ? 'https://pileczka-test-i3odn44x6q-ue.a.run.app' : 'https://pileczka-i3odn44x6q-ue.a.run.app';
  const COLORS = ['#e0a526', '#5b8def', '#d9667a', '#4fb286', '#9b5de5', '#e07a3f'];
  const KONTA = true; // konta graczy (nick + hasło) na obu stronach; serwer: env KONTA=1 (pileczka i pileczka-test)
  // /test/ i oficjalna strona mają wspólny localStorage (ta sama domena): konto i klucz ekwipunku trzymamy osobno (na /test/ z przedrostkiem „t.”),
  // inaczej rejestracja na teście kasowała klucz ekwipunku oficjalnej strony, a token z testu wylogowywał na oficjalnej
  const PER_ENV = new Set(['pilTok', 'pilAcc', 'eqKey', 'eqKeyOld', 'eqOwned']), lk = (k) => TEST && PER_ENV.has(k) ? 't.' + k : k;
  const ls = { get: (k) => { try { return localStorage.getItem(lk(k)); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(lk(k), v); } catch {} }, del: (k) => { try { localStorage.removeItem(lk(k)); } catch {} } };
  try { if (TEST && !localStorage.getItem('t.mig')) { const k = localStorage.getItem('eqKey'); if (k && !localStorage.getItem('t.eqKey')) localStorage.setItem('t.eqKey', k); localStorage.setItem('t.mig', '1'); } } catch {} // test: dotychczasowy ekwipunek testowy zostaje
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const css = document.createElement('style');
  css.textContent = `
  #snow{position:fixed;inset:0;pointer-events:none;z-index:40;overflow:hidden}
  .flake .badge.b3{left:calc(100% - 18px)}.flake .badge .icr{display:inline-block;margin-left:2px;filter:hue-rotate(235deg) saturate(2.2) brightness(1.1)}
  .flake.leader{border:3px solid #f2c94c;box-shadow:0 0 14px rgba(242,201,76,.8)}.flake .lcrown{position:absolute;top:-27px;left:50%;transform:translateX(-50%);font-size:25px;pointer-events:none}
  .flake{position:absolute;top:0;left:0;border-radius:50%;background:var(--card) center/cover no-repeat;border:2px solid;display:grid;place-items:center;font-weight:700;color:var(--ink);pointer-events:auto;cursor:pointer;user-select:none;opacity:.85;will-change:transform;contain:layout;-webkit-tap-highlight-color:transparent}
  .flake:hover{opacity:1}
  .flake .badge{position:absolute;left:calc(100% - 30px);white-space:nowrap;top:-6px;background:#e0a526;color:#141413;font-weight:800;border-radius:999px;padding:1px 6px;font-size:12px;box-shadow:0 2px 6px rgba(0,0,0,.4);border:2px solid #141413;line-height:1.3;pointer-events:none}
  .flake .b2{background:#ff8a3d}.flake .b3{background:#ff5a3d;color:#fff}.flake .b4{background:#d9264a;color:#fff}
  .flake.ball .badge{display:none}
  .flake.ball{opacity:1;z-index:2}
  @media (pointer:coarse){.flake.ball::before{content:'';position:absolute;inset:calc(-12px - var(--lot,0px));border-radius:50%}} /* telefon: większy obszar trafienia kciukiem */
  @media (pointer:fine){.flake.ball::before{content:'';position:absolute;inset:calc(-8px - var(--lot,0px));border-radius:50%}} /* komputer: trafienie liczy się też kilka pikseli poza piłeczką */
  .eqnote{margin-top:10px;font-size:12px;line-height:1.4;color:var(--mute);background:rgba(127,127,127,.08);border-radius:8px;padding:7px 9px;text-align:left}
  #hud .cnt{font-size:.62em;font-weight:700;opacity:.85;margin-right:10px;padding-right:10px;border-right:1px solid var(--line);vertical-align:.15em}#hud .cnt{pointer-events:auto;cursor:help;position:relative}#hud .cnt:hover::after,#hud .cnt.tip::after{content:attr(data-tip);position:absolute;top:calc(100% + 10px);left:0;width:250px;white-space:normal;font-size:12.5px;font-weight:500;line-height:1.35;background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:7px 9px;box-shadow:0 6px 18px rgba(0,0,0,.35);z-index:61}
  #hud .cnt small{font-size:.8em;opacity:.7;margin-left:3px}
  #hud .cnt.kap.arm{color:#ff7a1a;text-shadow:0 0 8px rgba(255,120,30,.85);opacity:1}
  .pilhint{font-size:12.5px;line-height:1.4;color:var(--mute);background:rgba(127,127,127,.08);border-radius:8px;padding:6px 9px;margin:0 0 8px}.pilhint a{color:var(--acc)}
  .pil-tabs{display:flex;gap:4px;margin:0 0 8px}.pil-tabs button{flex:1;font-size:12px;padding:3px 6px;border-radius:8px}.pil-tabs button.on{background:var(--acc);border-color:var(--acc);color:#fff}
  .pts{position:fixed;z-index:63;pointer-events:none;font-weight:800;font-size:15px;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,.7);font-variant-numeric:tabular-nums;transform:translate(-50%,-100%)}.pts.big{font-size:21px}
  #hud{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:61;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:6px 18px;font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;box-shadow:0 6px 18px rgba(0,0,0,.25);pointer-events:none}
  #hud{white-space:nowrap;max-width:calc(100vw - 24px)}
  @media (pointer:coarse){#hud{top:6px;font-size:17px;padding:3px 12px;opacity:.8}#lvlup{top:40px;font-size:16px}#nad{top:70px}}
  body.playing #snow{z-index:62}
  #hud small{font-size:12px;font-weight:500;color:var(--mute);margin-left:6px}
  #over{position:fixed;inset:0;z-index:70;display:grid;place-items:center;background:rgba(0,0,0,.45)}
  #over .box{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;width:min(320px,calc(100vw - 32px));text-align:center}
  #over h3{margin:0 0 4px;font-size:18px}#over .sc{font-size:44px;font-weight:800;margin:4px 0 12px}
  #over .ball{width:80px;height:80px;border-radius:50%;border:3px solid;margin:6px auto 6px;background:var(--card) center/cover no-repeat;display:grid;place-items:center;font-size:32px;font-weight:800}
  #over .who{font-weight:700;font-size:16px}
  #over .txt{color:var(--mute);font-size:14px;margin-top:2px}
  #over .sc small{font-size:16px;color:var(--mute);font-weight:600}
  #over .eq{display:flex;align-items:center;justify-content:center;gap:6px;margin:-4px 0 14px}
  #over .ch{display:flex;flex-direction:column;align-items:center;border:1px solid var(--line);border-radius:10px;padding:4px 10px;min-width:58px;line-height:1.15}
  #over .ch b{font-size:17px}#over .ch i{font-style:normal;font-size:10.5px;opacity:.8}
  #over .ch.tot{border-color:var(--acc);color:var(--acc)}
  #over .op{color:var(--mute);font-weight:700;font-size:16px}
  #over details.mf summary{cursor:pointer;list-style:none;color:var(--mute)}#over details.mf summary::-webkit-details-marker{display:none}
  #over .mf{font-size:12.5px;color:var(--mute);margin:-6px auto 12px;line-height:1.45;max-width:260px}
  #over .mfh{font-weight:600;color:var(--ink);margin-bottom:3px}
  #over .mfr{display:flex;justify-content:center;gap:6px}#over .mfr span{min-width:70px;text-align:right;font-weight:700}#over .mfr i{font-style:normal;opacity:.6}#over .mfr b{min-width:40px;text-align:left;color:var(--ink)}
  #over .mft{margin-top:6px;color:var(--ink)}#over .mft span{color:var(--mute);font-size:11.5px}#over .mfs{font-size:11.5px}
  #over .closebig{display:block;width:100%;margin-top:14px;padding:10px;font-weight:700;background:var(--acc);border-color:var(--acc);color:#fff;border-radius:12px}
  #over .endrow{display:flex;gap:8px;margin-top:14px}#over .endrow .closebig{margin:0;flex:1}#over .closesm{padding:10px 14px;border-radius:12px}
  #over button:disabled{opacity:.45;cursor:default}#over .box.lock button,#over .box.lock a{pointer-events:none;opacity:.45}
  #over input{width:100%;margin-bottom:10px;text-align:center}
  #over .row{display:flex;gap:8px;justify-content:center}
  #over button.pri{background:var(--acc);border-color:var(--acc);color:#fff}
  #over .msg{font-size:12px;color:var(--mute);min-height:16px;margin-top:8px}
  #mult{will-change:transform,opacity;position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(4);z-index:39;pointer-events:none;font-weight:900;font-size:min(5vw,55px);white-space:nowrap;line-height:1;opacity:0;transition:opacity .4s;font-variant-numeric:tabular-nums;letter-spacing:-.04em}
  #mult.on{opacity:.13}
  #mult .bs{display:inline-block;font-size:.3em;color:#fff;border-radius:999px;padding:.05em .45em;margin-left:.15em;vertical-align:-.1em;letter-spacing:0;opacity:.9}
  
  @keyframes mpulse{0%{opacity:.13;transform:translate(-50%,-50%) scale(1)}25%{opacity:.4;transform:translate(-50%,-50%) scale(1.12)}100%{opacity:.13;transform:translate(-50%,-50%) scale(1)}}
  #edge{position:fixed;inset:0;z-index:38;pointer-events:none}#edge i{position:fixed;display:block;opacity:var(--o,0);transition:opacity .6s;will-change:opacity}#edge .t,#edge .b{left:0;right:0;height:9vh}#edge .l,#edge .r{top:0;bottom:0;width:7vw}#edge .t{top:0;background:linear-gradient(rgba(255,90,20,.4),transparent)}#edge .b{bottom:0;background:linear-gradient(transparent,rgba(255,90,20,.4))}#edge .l{left:0;background:linear-gradient(90deg,rgba(255,90,20,.4),transparent)}#edge .r{right:0;background:linear-gradient(90deg,transparent,rgba(255,90,20,.4))}
  #arenaEdges{display:none;position:fixed;top:0;bottom:0;z-index:38;pointer-events:none;border-left:2px dashed rgba(255,140,60,.25);border-right:2px dashed rgba(255,140,60,.25)}
  #sufit{display:none;position:fixed;left:0;right:0;top:0;height:4px;z-index:38;pointer-events:none;background:repeating-linear-gradient(90deg,#e5484d 0 14px,transparent 14px 24px);box-shadow:0 0 10px rgba(229,72,77,.7)}body.playing #sufit{display:block}
  #nad{position:fixed;top:98px;transform:translateX(-50%);z-index:61;pointer-events:none;background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:999px;padding:2px 9px;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums}#nad[hidden]{display:none}
  .boomfx{position:fixed;z-index:61;pointer-events:none;border-radius:50%;background:radial-gradient(#fff3b0,#ff7a1a 45%,rgba(229,72,77,0) 70%);transform:translate(-50%,-50%);animation:boom .6s ease-out forwards}
  @keyframes boom{from{width:20px;height:20px;opacity:1}to{width:220px;height:220px;opacity:0}}
  .mellow{position:absolute;left:78%;bottom:88%;background:#fff;border:2px solid #141413;border-radius:14px;padding:4px 7px;line-height:0;pointer-events:none;animation:mlw .25s ease-out;transform-origin:0 100%}.mellow::after{content:'';position:absolute;left:8px;bottom:-9px;border:7px solid transparent;border-top-color:#141413;border-bottom:0}.mellow img{width:20px;height:20px;image-rendering:auto}
  @keyframes mlw{from{transform:scale(0)}to{transform:scale(1)}}
  .savefx{position:fixed;left:0;right:0;bottom:0;height:40vh;z-index:61;pointer-events:none;background:linear-gradient(transparent,rgba(199,134,74,.55));animation:svf .9s ease-out forwards}
  @keyframes svf{from{opacity:1}to{opacity:0}}
  #lvlup{position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:60;font-weight:800;font-size:20px;color:#ff7a1a;text-shadow:0 0 10px rgba(255,120,30,.6);opacity:0;pointer-events:none}
  #lvlup{will-change:transform,opacity;width:max-content;max-width:min(620px,90vw);text-align:center}
  @keyframes lvl{0%{opacity:0;transform:translate(-50%,10px) scale(.8)}20%{opacity:1;transform:translate(-50%,0) scale(1.1)}100%{opacity:0;transform:translate(-50%,-18px) scale(1)}}
  #snowBtn{position:fixed;left:12px;bottom:12px;z-index:45;font-size:12px;padding:4px 10px;opacity:.75}
  body.playing{user-select:none;-webkit-user-select:none;touch-action:none;-webkit-touch-callout:none}
  html:has(body.playing){touch-action:none;overscroll-behavior:none} /* w trakcie gry: bez przewijania, przybliżania i odświeżania pociągnięciem */
  body.playing .wrap{pointer-events:none}
  .pil li{list-style:none;display:flex;gap:8px;padding:5px 0;border-bottom:1px solid var(--line);font-size:14px}
  .pil .pn{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.25}
  .pil .pn>span,.pil .pn small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .pil .pn small{color:var(--mute);font-size:11.5px;display:flex;align-items:center;gap:4px}
  .pil .pn small i{width:14px;height:14px;border-radius:50%;background:center/cover;flex:none}
  .pil .dev{font-size:12px;margin-right:5px;opacity:.8;font-weight:400}
  .pil .plays{display:block;font-size:10.5px;color:var(--mute);font-weight:400;text-align:right}
  .pil li:last-child{border:0}.pil{margin:0;padding:0}.pil .me{color:var(--acc);font-weight:700}.pil .gap{justify-content:center;color:var(--mute);padding:0;border:0;line-height:1}.pil .total{justify-content:center;color:var(--mute);font-size:12px;border:0;padding-top:8px}`;
  document.head.appendChild(css);

  const snow = document.createElement('div'); snow.id = 'snow'; document.body.appendChild(snow);
  const btn = document.createElement('button'); btn.id = 'snowBtn'; document.body.appendChild(btn);
  let on = ls.get('snieg') !== '0' && !reduce;
  const setBtn = () => { btn.textContent = on ? '❄ wyłącz awatary' : '❄ włącz awatary'; };
  btn.onclick = () => { on = !on; ls.set('snieg', on ? '1' : '0'); setBtn(); if (!on && !game) clearFlakes(); drawHint(); };
  setBtn();

  // Karta rankingu pod galerią sław: widoczna dopiero dla kogoś, kto już zagrał
  const fameCard = document.getElementById('fame')?.closest('.card');
  const card = document.createElement('div'); card.className = 'card'; card.hidden = true;
  // ranking ogólny + tygodnia i dnia (czas polski; tydzień od poniedziałku) — wybór zapamiętany w przeglądarce
  const OKRESY = { a: 'Ogólny', w: 'Tydzień', d: 'Dziś' };
  let okres = OKRESY[ls.get('pilOkres')] ? ls.get('pilOkres') : 'a', myBest = 0, rankSeq = 0; // myBest: Twój rekord ogólny (do HUD w trakcie gry)
  card.innerHTML = `<h3 style="display:flex;justify-content:space-between;align-items:center">Piłeczka · ranking${EQON ? '<a href="#" id="pilLeg" style="font-size:11px;letter-spacing:0;text-transform:none;color:var(--acc)">Legenda</a>' : ''}</h3><div class="pil-tabs">${Object.entries(OKRESY).map(([k, v]) => `<button data-o="${k}"${k === okres ? ' class="on"' : ''}>${v}</button>`).join('')}</div><div class="pilhint" hidden></div><ul class="pil" id="pil"><li class="empty">Ładowanie…</li></ul>`;
  if (EQON) card.querySelector('#pilLeg').onclick = (e) => { e.preventDefault(); openLegend(); };
  card.querySelectorAll('.pil-tabs button').forEach((b) => b.onclick = () => {
    okres = b.dataset.o; ls.set('pilOkres', okres);
    card.querySelectorAll('.pil-tabs button').forEach((x) => x.classList.toggle('on', x === b));
    document.getElementById('pil').innerHTML = '<li class="empty">Ładowanie…</li>'; loadRank();
  });
  fameCard?.after(card);
  // podpowiedź dla nowych (znika po pierwszej grze); przy wyłączonych awatarach (np. systemowe ograniczenie animacji) — jak je włączyć
  function drawHint() {
    const h = card.querySelector('.pilhint');
    h.hidden = !!(ls.get('pilStart') || ls.get('pilGral') || ls.get('pilNick'));
    h.innerHTML = on ? '👉 Kliknij (na telefonie dotknij) spadający awatar, żeby zagrać — podbijaj go, zanim spadnie na dół ekranu. Zasady w „Legendzie”.' : '👉 Grą są spadające awatary, a teraz są wyłączone. <a href="#" data-a="on">Włącz awatary</a>, żeby zagrać.';
    h.querySelector('[data-a="on"]')?.addEventListener('click', (e) => { e.preventDefault(); btn.click(); });
  }
  drawHint();
  const ballAv = (r) => { const a = r.ballUid && D?.avatars?.[r.ballUid]; return a ? `<i style="background-image:url('${esc(a)}')"></i>` : ''; };
  // j: { top, total?, last?, you? } (nowy serwer: top 10 + ostatnie miejsce + Twoje miejsce) albo sama tablica (stary serwer)
  function showRank(j) {
    card.hidden = false;
    if (typeof j.best === 'number') myBest = j.best; else if (j.you && (j.okres || 'a') === 'a') myBest = j.you.score;
    if (j.okres && j.okres !== okres) return; // odpowiedź dla innej zakładki (np. zapis wyniku po przełączeniu)
    const top = Array.isArray(j) ? j : j.top || [], me = (ls.get('pilNick') || '').toLowerCase();
    const li = (r, i) => `<li class="${r.nick.toLowerCase() === me ? 'me' : ''}${EQON && r.eq ? ' clk' : ''}"${EQON && r.eq ? ` data-eq="${esc(r.eq)}" data-nick="${esc(r.nick)}" data-dev="${r.dev || ''}" title="Zobacz ekwipunek"` : ''}><span style="width:22px;color:var(--mute)">${i + 1}.</span><span class="pn"><span>${esc(r.nick)}</span>${r.hits ? `<small>${ballAv(r)}${r.hits}× ${esc(r.ball || '')}</small>` : ''}</span><b>${r.dev ? `<span class="dev" title="${r.dev === 'm' ? 'telefon' : 'komputer'}">${r.dev === 'm' ? '📱' : '🖥️'}</span>` : ''}${r.score}${EQON && r.plays ? `<small class="plays">${r.plays} ${r.plays === 1 ? 'gra' : r.plays % 10 >= 2 && r.plays % 10 <= 4 && (r.plays % 100 < 12 || r.plays % 100 > 14) ? 'gry' : 'gier'}</small>` : ''}</b></li>`;
    const gap = '<li class="gap">…</li>', rows = top.map((r, i) => li(r, i));
    const inTop = (x) => top.some((r) => r.nick === x.nick);
    if (j.you && !inTop(j.you)) rows.push(gap, li(j.you, j.you.rank - 1));
    if (j.last && !inTop(j.last) && j.last.nick !== j.you?.nick) rows.push(j.you && !inTop(j.you) && j.last.rank === j.you.rank + 1 ? '' : gap, li(j.last, j.last.rank - 1));
    const when = { a: 'łącznie', w: 'w tym tygodniu', d: 'dziś' }[okres];
    document.getElementById('pil').innerHTML = rows.length ? rows.join('') + (j.total ? `<li class="total">Zagrało ${when}: <b>${j.total}</b> ${j.total === 1 ? 'osoba' : j.total % 10 >= 2 && j.total % 10 <= 4 && (j.total % 100 < 12 || j.total % 100 > 14) ? 'osoby' : 'osób'}</li>` : '') : `<li class="empty">${{ a: 'Jeszcze nikt nie zagrał.', w: 'W tym tygodniu jeszcze nikt nie zagrał.', d: 'Dziś jeszcze nikt nie zagrał.' }[okres]}</li>`;
  }
  const loadRank = (n = 0) => {
    const q = new URLSearchParams(), seq = ++rankSeq; if (ls.get('pilNick')) q.set('nick', ls.get('pilNick')); if (okres !== 'a') q.set('okres', okres);
    return fetch(API + (q.toString() ? '?' + q : '')).then((r) => { if (!r.ok) throw 0; return r.json(); }).then((j) => { if (seq === rankSeq) showRank(j); })
      .catch(() => { if (seq !== rankSeq) return; card.hidden = false; document.getElementById('pil').innerHTML = '<li class="empty">Ranking chwilowo niedostępny, ponawiam…</li>'; if (n < 5) setTimeout(() => { if (seq === rankSeq) loadRank(n + 1); }, 15000); });
  };
  loadRank(); // ranking widoczny zawsze, także przed pierwszą grą

  // --- płatki ---
  const flakes = new Set();
  let game = null, W = innerWidth, H = innerHeight;
  addEventListener('resize', () => { W = innerWidth; H = innerHeight; });
  const pickUser = () => {
    const withAv = Object.keys(D.avatars || {}).filter((u) => D.users[u]);
    const pool = withAv.length ? withAv : Object.keys(D.users || {});
    // bez powtórek: pomijamy awatary, które już lecą; lider dnia (tylko test) wypada w 15% przypadków, reszta po równo
    const onScreen = new Set([...flakes].map((f) => f.u)), free = pool.filter((u) => !onScreen.has(u));
    const lead = window.dayLeader?.();
    if (lead && [...flakes].filter((f) => f.u === lead).length < 2 && pool.includes(lead) && Math.random() < .15) return lead; // lider może lecieć w 2 egzemplarzach naraz
    const rest = free.filter((u) => u !== lead);
    return rest.length ? rest[Math.floor(Math.random() * rest.length)] : free[0];
  };
  function makeEl(u, size) {
    const el = document.createElement('div'); el.className = 'flake';
    const av = D.avatars?.[u], col = COLORS[Math.floor(Math.random() * COLORS.length)];
    el.style.cssText = `width:${size}px;height:${size}px;border-color:${col};font-size:${size * .42}px;${av ? `background-image:url('${esc(av)}')` : ''}`;
    if (!av) el.textContent = (D.users[u] || '?')[0].toUpperCase();
    el.title = D.users[u] || '';
    snow.appendChild(el); return el;
  }
  function spawn() {
    if (!on || game || document.hidden || flakes.size >= 9 || !D?.users) return;
    const u = pickUser(); if (u) flakes.add(newFlake(u));
  }
  // Start gry: myszka od razu po wciśnięciu (tylko lewy przycisk); palec dopiero po tapnięciu bez przesuwania — przewijanie strony nie odpala gry
  let tapStart = null;
  function flakeDown(f, e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    if (game) { if (!e.isTrusted) { game.untr++; return; } game.clicks++; if (tooFast(game)) return; hit(f, e); return; }
    if (e.pointerType === 'touch') { tapStart = { f, id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() }; return; }
    startGame(f, e);
  }
  addEventListener('pointerup', (e) => {
    const s = tapStart; tapStart = null;
    if (!s || s.id !== e.pointerId || game || !flakes.has(s.f) || Math.hypot(e.clientX - s.x, e.clientY - s.y) > 12 || performance.now() - s.t > 600) return;
    startGame(s.f, e);
  });
  addEventListener('pointercancel', (e) => { if (tapStart?.id === e.pointerId) tapStart = null; });
  function newFlake(u) {
    const kind = pickKind(), size = Math.round(80 * kind.p * scaleK() * (TOUCH ? 1.2 : 1) * (1 + B.olb)); // na telefonie o 20% większe
    const f = { u, size, x: (TOUCH ? 0 : arena().l) + Math.random() * ((TOUCH ? W : arena().r - arena().l) - size), y: -size - 10, vy: (28 + Math.random() * 30) * scaleK(), sway: 20 + Math.random() * 30, ph: Math.random() * 6.28, rot: 0, vr: (Math.random() - .5) * 40 };
    f.el = makeEl(u, size); f.base = kind.m; f.top = window.crownOf ? window.crownOf(u) : 0; // premia za miejsce właściciela awatara w top 10 z 24 h (dla wszystkich)
    if (window.dayLeader?.() === u) { f.el.classList.add('leader'); const c = document.createElement('span'); c.className = 'lcrown'; c.textContent = '👑'; f.el.appendChild(c); }
    // z Koroną Króla Forum plakietka pokazuje mnożnik piłeczki już z premią za miejsce właściciela awatara w top 10 z 24 h
    const cr = B.korona ? f.top : 0, bm = Math.round((kind.m + f.top + cr) * 10) / 10; // Hełm Weterana podwaja premię
    if (bm > 1) { const b = document.createElement('span'); b.className = 'badge ' + (kind.m > 1 ? kind.cls : ''); b.innerHTML = 'x' + bm + (cr ? '<span class="icr">👑</span>' : ''); if (cr) b.title = `z Hełmem Weterana: +${cr}x`; f.el.appendChild(b); }
    f.el.addEventListener('pointerdown', (e) => flakeDown(f, e));
    return f;
  }
  const clearFlakes = () => { for (const f of flakes) f.el.remove(); flakes.clear(); };

  // --- gra ---
  // Co 8 podbić poziom w górę: awatar leci szybciej (cały ruch przyspiesza), a mnożnik punktów rośnie o 0,1
  // Rozmiar i fizyka liczone względem wielkości okna — przybliżenie strony (Ctrl +) nie ułatwia gry
  // Rozmiary piłeczek: mniejsza = trudniej, ale większy mnożnik bazowy (mnoży się z mnożnikiem poziomu)
  const KINDS = [{ p: 1.15, m: 1, w: 34 }, { p: 1, m: 1.3, w: 33, cls: 'b2' }, { p: .8, m: 1.7, w: 33, cls: 'b3' }];
  const pickKind = () => { let r = Math.random() * 100; for (const k of KINDS) { if ((r -= k.w) < 0) return k; } return KINDS[0]; };
  const BADGE = { 1.3: '#ff8a3d', 1.7: '#ff5a3d', 2.2: '#d9264a' }; // kolory jak plakietki na piłeczkach
  // Bonusy z założonych przedmiotów (tylko TEST; bez przedmiotów wszystko jest zerem i gra liczy jak dotąd)
  const zeroB = () => ({ setN: 0, setUid: '', setMult: 0, impl: 0, ostry: 0, stlum: 0, ciezki: 0, zreczny: 0, rozp: 0, wytrw: 0, olb: 0, mrozu: 0, lowcy: 0, serii: 0, brawur: 0, zuch: 0, echa: 0, guardian: 0, lucky: 0, korona: 0, kapcie: 0, lotny: 0, wzn: 0, mar: 0, rytm: 0, kryt: 0, zlota: 0 });
  let B = zeroB(), eqReady = !EQON, eqFailed = false; // eqReady: przedmioty wczytane z serwera
  const r3 =(x) => Math.round(x * 1000) / 1000;
  const CAP = { stlum: .3, ciezki: .25, zreczny: .6, olb: .25, rozp: .6, lowcy: 1.5, lucky: 100, wytrw: .3, brawur: .5, zuch: .08, echa: .25, lotny: 10, wzn: .08, mar: .3, rytm: 6, kryt: .3, zlota: .06 };
  // afiks → limit łączny jako tekst (np. „30%”, „+1.5x”)
  const CAPK = { stlumiony: 'stlum', ciezki: 'ciezki', zreczny: 'zreczny', olbrzyma: 'olb', rozpedzony: 'rozp', lowcy: 'lowcy', szczesliwy: 'lucky', wytrwalosci: 'wytrw', brawurowy: 'brawur', zuchwaly: 'zuch', echa: 'echa', lotny: 'lotny', wznoszacy: 'wzn', maratonczyka: 'mar', rytmu: 'rytm', krytyczny: 'kryt', zlota: 'zlota' };
  const capTxt = (id) => { const k = CAPK[id]; if (!k) return ''; const v = CAP[k]; return k === 'lucky' ? '+100%' : k === 'lowcy' ? '+1.5x' : k === 'brawur' || k === 'zuch' || k === 'wzn' || k === 'mar' ? `+${v.toFixed(2)}x` : k === 'lotny' ? `+${v} px` : k === 'rytm' ? `+${v} pkt` : Math.round(v * 100) + '%'; };
  function calcB(slots) {
    const b = zeroB();
    for (const it of Object.values(slots || {})) {
      if (!it) continue;
      b.impl += it.implicit?.mult || 0;
      if (it.rarity === 'u' && it.slot === 'helm') b.korona = 1; // Hełm Weterana
      if (it.rarity === 'u' && it.slot === 'boots') b.kapcie = it.bans || 1; // Kapcie Moderatora (nowe: 2–4, starsze: 1)
      for (const a of it.affixes || []) {
        const v = a.v || 0;
        if (a.id === 'ostry') b.ostry += v; else if (a.id === 'stlumiony') b.stlum += v / 100; else if (a.id === 'ciezki') b.ciezki += v / 100;
        else if (a.id === 'zreczny') b.zreczny += v / 100; else if (a.id === 'szczesliwy') b.lucky += v; else if (a.id === 'rozpedzony') b.rozp += v / 100;
        else if (a.id === 'wytrwalosci') b.wytrw += v / 100; else if (a.id === 'olbrzyma') b.olb += v / 100;
        else if (a.id === 'mrozu') b.mrozu += v; else if (a.id === 'lowcy') b.lowcy += v; else if (a.id === 'serii') b.serii += v;
        else if (a.id === 'brawurowy') b.brawur += v; else if (a.id === 'zuchwaly') b.zuch += v; else if (a.id === 'echa') b.echa += v / 100; else if (a.id === 'stroza') b.guardian += v * (SUFIT ? 3 : 1); // test: Stróża = 3 odbicia
        else if (a.id === 'lotny') b.lotny += v; else if (a.id === 'wznoszacy') b.wzn += v; else if (a.id === 'maratonczyka') b.mar += v; else if (a.id === 'rytmu') b.rytm += v; else if (a.id === 'krytyczny') b.kryt += v / 100; else if (a.id === 'zlota') b.zlota += v / 100;
      }
    }
    // zestaw: przedmioty z awatarem tej samej osoby — +0.2 pkt za sztukę, przy 4 szt. dodatkowo jedno odbicie od dołu
    const cnt = {}; for (const it of Object.values(slots || {})) if (it?.uid) if (it.rarity === 'r' || it.rarity === 'u') cnt[it.uid] = (cnt[it.uid] || 0) + 1; // do zestawu liczą się tylko rzadkie i unikaty
    const top = Object.entries(cnt).sort((a, c) => c[1] - a[1])[0];
    b.setN = top && top[1] >= 2 ? top[1] : 0; b.setUid = b.setN ? top[0] : '';
    b.setMult = b.setN ? r3((b.setN - 1) * .2) : 0; // zestaw od 2 szt.: 2 → 0.2, 3 → 0.4, 4 → 0.6 pkt
    if (b.setN === 4) b.guardian++; // pełny zestaw: dodatkowe odbicie od dołu
    for (const k of Object.keys(b)) if (typeof b[k] === 'number') b[k] = r3(b[k]);
    // limity łączne (afiksy mogą się powtarzać, ale suma ma sufit) — pokazywane w opisach przedmiotów i w „Łącznych bonusach”
    b.capped = {};
    for (const k in CAP) if (b[k] > CAP[k]) { b[k] = CAP[k]; b.capped[k] = 1; }
    return b;
  }
  const RP = 100; // dokładność mnożnika 0.01 (przedmioty dają ułamki)
  const fm = (n) => { const r = Math.round(n * 100) / 100; return Math.abs(r * 10 - Math.round(r * 10)) < 1e-9 ? r.toFixed(1) : r.toFixed(2); };
  // (piłeczka + łowcy gdy mniejsza niż duża) × mnożnik poziomu (start 1 + rozpędzony) + przedmioty (implicit + ostry + seria × floor(podbicia/10))
  const partsOf = (g) => {
    const b = g.base + (g.base > 1 ? g.B.lowcy : 0) + (g.topB || 0) + (g.crown || 0), lv = multOf(g.lvl, g.B), items = r3(g.B.impl + g.B.ostry + g.B.setMult + (g.zuchAcc || 0) + g.B.serii * Math.floor(g.hits / 10) + g.B.wzn * g.lvl + g.B.mar * (g.marN || 0)); // Wznoszący: za każdy osiągnięty poziom; Maratończyka: za każde pełne 30 s gry
    return { b, lv, items, total: Math.round((b * lv + items) * RP) / RP };
  };
  const totalMult = () => game ? partsOf(game).total : 1;
  // liczone od wysokości okna: na telefonie (wąski, wysoki ekran) awatary nie są malutkie, a wysokość podbicia jest proporcjonalna
  const scaleK = () => Math.max(.5, Math.min(1.4, innerHeight / 950));
  const G = 1500, JUMP = 610, PER_LEVEL = 8;
  const TOUCH = matchMedia('(pointer: coarse)').matches; // telefon: większe piłeczki, mocniejsze podbicie i większy obszar trafienia
  // test: na komputerze start od ×1,25 (początek był za wolny); na telefonie bez zmian (tam i tak +20%)
  const speedOf = (lvl, w = 0) => (1 + lvl * (TOUCH ? 0.045 : 0.07) * (1 - w) + (SUFIT && !TOUCH ? .25 : 0)) * (TOUCH ? 1.2 : 1), // telefon: +20% prędkości (z większym obszarem trafienia i mocniejszym podbiciem) // Wytrwałości: wolniejszy przyrost prędkości
    multOf = (lvl, b = B) => Math.round((1 + b.rozp + lvl * 0.1) * 100) / 100;
  const hud = document.createElement('div'); hud.id = 'hud'; hud.hidden = true; document.body.appendChild(hud);
  const multEl = document.createElement('div'); multEl.id = 'mult'; document.body.appendChild(multEl);
  const edgeEl = document.createElement('div'); edgeEl.id = 'edge'; edgeEl.innerHTML = '<i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i>'; // poświata tylko w pasach przy krawędziach (pełnoekranowa warstwa zacinała na 144 Hz)
  // poświata wyłączona: nawet w pasach przy krawędziach laguje na 144 Hz (sprawdzone 3.10.2026) — edgeEl nie trafia na stronę
  // Duży, półprzezroczysty mnożnik w tle + poświata na brzegach ekranu rosnąca z poziomem
  function showMult(lvl, pulse) {
    const m = totalMult(), heat = Math.min(1, (m - 1) / 3);
    const lv = fm(multOf(lvl, game ? game.B : B)), b = game ? game.base : 1, bEff = game ? partsOf(game).b : 1;
    const html = `<span class="lv">x${lv}</span>` + (bEff > 1 ? `<span class="bs" style="background:${BADGE[b] || '#d9264a'}">×${fm(bEff)}</span>` : ''); if (multEl.innerHTML !== html) multEl.innerHTML = html; // bez zbędnego przerysowania dużego napisu
    multEl.style.color = `hsl(${45 - heat * 45}, 95%, ${60 - heat * 10}%)`;
    if (!TOUCH) { const A = arena(), css = `display:block;left:${A.l}px;width:${A.r - A.l}px`; if (edgesEl.style.cssText !== css) edgesEl.style.cssText = css; }
    multEl.classList.add('on'); edgeEl.style.setProperty('--o', TOUCH ? '0' : String(heat * .9)); // telefon: bez poświaty (lagowała)
    // animacje przez Web Animations (bez wymuszania przeliczenia układu strony w trakcie gry)
    if (pulse) multEl.animate([{ opacity: .13, transform: 'translate(-50%,-50%) scale(4)' }, { opacity: .4, transform: 'translate(-50%,-50%) scale(4.48)', offset: .25 }, { opacity: .13, transform: 'translate(-50%,-50%) scale(4)' }], { duration: 900, easing: 'ease-out' });
  }
  const edgesEl = document.createElement('div'); edgesEl.id = 'arenaEdges'; document.body.appendChild(edgesEl);
  const hideMult = () => { edgesEl.style.display = 'none'; multEl.classList.remove('on', 'pulse'); edgeEl.style.setProperty('--o', '0'); };
  // błysk przy zużyciu odbicia od dołu
  const sufitEl = document.createElement('div'); sufitEl.id = 'sufit'; sufitEl.title = 'Sufit — dotknięcie wysadza piłeczkę'; 
  const nadEl = document.createElement('div'); nadEl.id = 'nad'; nadEl.hidden = true; document.body.appendChild(nadEl);
  function boomFx(x, y) { const e = document.createElement('div'); e.className = 'boomfx'; e.style.left = x + 'px'; e.style.top = y + 'px'; document.body.appendChild(e); setTimeout(() => e.remove(), 700); }
  function saveFx() { const e = document.createElement('div'); e.className = 'savefx'; document.body.appendChild(e); setTimeout(() => e.remove(), 900); }
  const flashEl = document.createElement('div'); flashEl.id = 'lvlup'; document.body.appendChild(flashEl);
  let lastFlash = 0; const BRAV_MAX = 1.5, ZUCH_MAX = 0.6; // sufity premii z serii Brawurowego i nabitego Zuchwałego
  function flash(t, dur = 1100) { lastFlash = performance.now(); flashEl.textContent = t; flashEl.animate([{ opacity: 0, transform: 'translate(-50%,10px) scale(.8)' }, { opacity: 1, transform: 'translate(-50%,0) scale(1.1)', offset: Math.min(.2, 220 / dur) }, { opacity: 1, transform: 'translate(-50%,0) scale(1.1)', offset: Math.max(.2, 1 - 880 / dur) }, { opacity: 0, transform: 'translate(-50%,-18px) scale(1)' }], { duration: dur, easing: 'ease-out' }); }
  // pływające „+N” nad piłeczką przy każdym podbiciu (kolor jak duży mnożnik; większe przy Echu i Brawurze)
  function ptsFx(f, pts, big, tag = '') {
    const e = document.createElement('div'), heat = Math.min(1, (pts - 1) / 3);
    e.className = 'pts' + (big ? ' big' : ''); e.textContent = '+' + (pts < 10 ? pts.toFixed(1) : Math.round(pts)) + (tag ? ' ' + tag : '');
    const side = f.x + f.size / 2 > W - 90 ? -1 : 1; // obok piłeczki (ona po podbiciu leci w górę i zasłaniałaby napis); przy prawej krawędzi z lewej strony
    e.style.cssText = `left:${f.x + f.size / 2 + side * (f.size / 2 + 22)}px;top:${f.y + f.size / 2}px;color:hsl(${45 - heat * 45},95%,62%)`;
    document.body.appendChild(e);
    e.animate([{ opacity: 1, transform: 'translate(-50%,-100%)' }, { opacity: 0, transform: 'translate(-50%,-100%) translateY(-40px)' }], { duration: 750, easing: 'ease-out' }).onfinish = () => e.remove();
  }
  // Na komputerze gra tylko w dużym oknie — w małym/wąskim oknie jest dużo łatwiej (mało miejsca na ucieczkę piłeczki)
  // Pole gry ma stałe proporcje (szerokość = 1,5 × wysokość, wyśrodkowane), więc na każdym monitorze jest tak samo trudno
  const ASPECT = 1.5, MIN_H = 600;
  const arena = () => { const aw = Math.min(W, H * ASPECT); return { l: (W - aw) / 2, r: (W + aw) / 2 }; };
  const tooSmall = () => !TOUCH && (innerHeight < MIN_H || innerWidth < innerHeight * ASPECT);
  // e = kliknięcie startujące; bez e („Zagraj jeszcze raz”) piłeczka wisi i czeka na pierwsze kliknięcie
  function startGame(f, e) {
    if (tooSmall()) {
      flash(innerHeight < MIN_H ? `Okno za niskie do gry: potrzeba min. ${MIN_H} px wysokości (masz ${innerHeight}) — powiększ okno` : `Okno za wąskie do gry: szerokość musi być co najmniej 1,5 × wysokość (masz ${innerWidth}×${innerHeight}) — zmniejsz wysokość okna albo je poszerz`, 4500);
      return false;
    }
    for (const o of flakes) if (o !== f) o.el.remove();
    flakes.clear(); flakes.add(f);
    // bez przeskoku w bok: bieżące kołysanie spadającego awatara zostaje w pozycji piłeczki
    const A = TOUCH ? { l: 0, r: W } : arena(); f.x = Math.max(A.l, Math.min(A.r - f.size, f.x + Math.sin(f.ph) * f.sway)); f.sway = 0;
    game = { f, score: 0, hits: 0, lvl: 0, k: scaleK(), base: f.base || 1, B, per: PER_LEVEL, saves: B.guardian + TEST_SAVES, lowRun: 0, zuchAcc: 0, bans: B.kapcie, saveGap: 50, nextSave: SUFIT ? 50 : Infinity, topB: f.top || 0, crown: B.korona ? f.top || 0 : 0, best: myBest, bWait: EQON && !eqReady && !eqFailed }; f.el.classList.add('ball'); showMult(0, false);
    document.body.classList.add('playing'); getSelection()?.removeAllRanges(); const pie = document.getElementById('pie'); if (pie) pie.hidden = true; f.vx = 0; f.vy = 0; tapStart = null;
    ls.set('pilStart', '1'); card.querySelector('.pilhint').hidden = true; // podpowiedź dla nowych już niepotrzebna
    if (EQON && eqFailed) flash('Nie udało się wczytać przedmiotów — ta gra bez nich', 2500);
    // weryfikacja: bilet gry z serwera (w tle), log podbić [ms od startu, punkty] i statystyki kliknięć do /end
    game.t0 = performance.now(); game.log = []; game.sim = 0; game.clicks = e ? 1 : 0; game.misses = 0; game.untr = 0; if (e) game.lastClick = game.t0;
    game.emu = TOUCH && (outerWidth - innerWidth > 100 || outerHeight - innerHeight > 250); // tryb telefonu w narzędziach przeglądarki na komputerze
    game.ticket = getTicket(); const gm = game; game.ticket.then((t) => { if (t && game === gm) { gm.seed = t.s; drawHud(); } }); // do przyjścia biletu (seeda) szanse za podbicia nie działają
    applyLotny();
    if (e) hit(f, e); else { game.hover = performance.now(); game.rot0 = f.rot; game.rotTo = Math.round(f.rot / 360) * 360; drawHud(); }
    return true;
  }
  // „Zagraj jeszcze raz”: od razu kilka spadających awatarów w górnej części ekranu (bez czekania) — piłeczkę wybiera gracz
  function replay() {
    if (!D?.users) return;
    for (let n = 0; flakes.size < 7; n++) {
      const u = pickUser(); if (!u) break;
      const f = newFlake(u); f.y = -f.size * .3 + n * H * .065 + Math.random() * H * .04; flakes.add(f);
    }
    acc = 0;
  }
  // Lotny: większy obszar trafienia piłeczki (px dodane do marginesu ::before)
  const applyLotny = () => game?.f.el.style.setProperty('--lot', (game.B.lotny || 0) + 'px');
  // przedmioty wczytane już w trakcie gry (wolny serwer): bonusy działają od tej chwili
  function lateB() {
    const g = game; g.bWait = false; g.B = B; applyLotny(); g.saves += B.guardian; g.bans = B.kapcie; g.crown = B.korona ? g.topB : 0;
    drawHud(); flash('Przedmioty wczytane');
  }
  // Kapcie Moderatora: pudło liczy się jako podbicie — tylko gdy piłeczka spada w dolnej połowie ekranu (🔨 w HUD wtedy świeci)
  const kapArmed = (g) => !g.hover && !g.rise && g.f.vy > 0 && g.f.y + g.f.size / 2 > H / 2;
  document.addEventListener('pointerdown', (e) => {
    const cnt = e.target.closest?.('#hud .cnt'); if (cnt) { const on = !cnt.classList.contains('tip'); hud.querySelectorAll('.cnt.tip').forEach((x) => x.classList.remove('tip')); if (on) cnt.classList.add('tip'); return; }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!game || e.target.closest?.('.ball, button, a, input, #over')) return;
    if (!e.isTrusted) { game.untr++; return; }
    game.clicks++; game.misses++;
    if (tooFast(game) || !game.bans || !kapArmed(game)) return;
    game.bans--; flash('🔨 Ban! Kapcie Moderatora uratowały piłeczkę'); hit(game.f, { clientX: game.f.el.getBoundingClientRect().left + game.f.size / 2 });
  });
  // limit klików: w trakcie gry klik szybciej niż CLICK_GAP ms po poprzednim (w piłeczkę lub obok) nie liczy się
  const CLICK_GAP = 100;
  function tooFast(g) {
    const now = performance.now(), fast = now - (g.lastClick || 0) < CLICK_GAP;
    g.lastClick = now; return fast;
  }
  // w trakcie gry prawy przycisk nie otwiera menu, a środkowy nie włącza autoprzewijania
  addEventListener('contextmenu', (e) => { if (game) e.preventDefault(); });
  addEventListener('mousedown', (e) => { if (game && e.button === 1) e.preventDefault(); });
  function hit(f, e) {
    if (!game || game.f !== f) return;
    // po zawisie/hamowaniu tempo wraca stopniowo przez 2 s
    if (game.hover || game.rise) { game.warm = performance.now(); game.hover = 0; game.rise = null; game.bubble?.remove(); game.bubble = null; }
    game.hits++;
    const up = game.hits % game.per === 0 && game.hits > 0;
    // Brawurowy: podbicie w dolnych 15% ekranu daje dodatkowy mnożnik; Echa: szansa, że podbicie liczy się podwójnie
    // podbicie tuż nad dołem (dolne 15%): Brawurowy — premia rosnąca z każdym kolejnym takim podbiciem z rzędu (wyższe podbicie zeruje serię),
    // Zuchwały — stały przyrost mnożnika do końca gry; Echa — szansa, że punkty za podbicie liczą się podwójnie
    const low = (game.B.brawur || game.B.zuch) && f.y + f.size / 2 > H * .85;
    // szanse z seeda biletu (i = numer podbicia od 1); bez seeda (bilet jeszcze nie przyszedł) — bez szans, serwer liczy tak samo
    const sd = game.seed, hi = game.hits, echo = sd != null && game.B.echa > 0 && roll(sd, 1, hi) < game.B.echa, crit = sd != null && game.B.kryt > 0 && roll(sd, 2, hi) < game.B.kryt, gold = sd != null && game.B.zlota > 0 && roll(sd, 3, hi) < game.B.zlota;
    const ms = Math.round(performance.now() - game.t0); game.marN = Math.floor(ms / 30000); // Maratończyka: pełne 30 s gry (jak na serwerze, z czasu w logu)
    game.lowRun = low ? game.lowRun + 1 : 0;
    const brav = low ? Math.min(BRAV_MAX, game.B.brawur * game.lowRun) : 0;
    const rytm = game.B.rytm && hi % 5 === 0 ? game.B.rytm : 0; // Rytmu: stała premia co 5. podbicie (poza mnożnikami szans)
    const mulX = (echo ? 2 : 1) * (crit ? 3 : 1) * (gold ? 10 : 1);
    const pts = (totalMult() + brav) * mulX + rytm;
    game.score += pts; game.log.push([ms, pts]); ptsFx(f, pts, mulX > 1 || brav > 0, gold ? '×10' : crit ? 'KRYT ×3' : '');
    if (gold) f.el.animate([{ boxShadow: '0 0 0 0 rgba(255,215,0,0)', filter: 'none' }, { boxShadow: '0 0 34px 14px rgba(255,215,0,.95)', filter: 'sepia(1) saturate(4) brightness(1.15)', offset: .25 }, { boxShadow: '0 0 0 0 rgba(255,215,0,0)', filter: 'none' }], { duration: 700, easing: 'ease-out' });
    // test: odbicie od dołu za punkty — odstępy rosną 50, 100, 200, 400, 800… (progi 50, 150, 350, 750, 1550…)
    while (game.score >= game.nextSave) { game.saves++; game.saveGap *= 2; game.nextSave += game.saveGap; flash('🛡 +1 odbicie od dołu!'); lastFlash = performance.now() + 800; }
    if (low && game.B.zuch && game.lvl > 0) game.zuchAcc = r3(Math.min(ZUCH_MAX, game.zuchAcc + game.B.zuch));
    if (!up && performance.now() - lastFlash > 1200) if (gold) flash('✨ Złota Piłka! ×10'); else if (crit) flash('Krytyk! ×3'); else if (echo) flash('Echo! x2'); else if (rytm) flash(`Rytm! +${rytm} pkt`); else if (brav) flash(`Brawura x${game.lowRun}! +${fm(brav)}x`);
    if (up) { game.lvl++; flash(`Szybciej! x${fm(totalMult())}`); showMult(game.lvl, true); }
    if (game.best && !game.rec && Math.round(game.score) > game.best) { game.rec = true; flash('🏆 Nowy rekord!', 1600); lastFlash = performance.now() + 800; } // przebicie rekordu ogólnego
    const r = f.el.getBoundingClientRect(), off = ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) || 0;
    // podbicie nie wyrzuca ponad górną krawędź: siła ograniczona tak, żeby szczyt lotu był ok. 12 px pod górą ekranu
    const room = Math.max(0, f.y - 12), vMax = Math.sqrt(2 * G * (1 - game.B.ciezki) * game.k * room), jump = JUMP * (1 - stlumNow(game.B.stlum, game.score)) * (TOUCH ? 1.3 : 1); // telefon: podbicie ~1,7× wyżej (dłuższy lot, mniej gorączkowe klikanie)
    f.vy = SUFIT && game.hits > SAFE_HITS ? -jump * game.k : -Math.max(jump * game.k * .3, Math.min(jump * game.k, vMax)); // test: pełna siła, sufit = wybuch (poza pierwszymi SAFE_HITS podbiciami)
    f.vx = Math.max(-420, Math.min(420, -off * 320 + (Math.random() - .5) * 120)) * game.k * (1 - game.B.zreczny);
    f.vr = -off * 360;
    drawHud();
  }
  function drawHud() {
    const P = partsOf(game), best = game.best ? (game.rec ? ' · <b style="color:var(--acc)">🏆 nowy rekord!</b>' : ` · 🏆 ${game.best}`) : '';
    hud.hidden = false; hud.innerHTML = `${game.saves || SUFIT ? `<span class="cnt" data-tip="🛡 Odbicia od dołu: gdy piłeczka spadnie, odbije się wysoko zamiast końca gry. Masz ${game.saves}.${SUFIT ? ` Kolejne dostaniesz przy ${game.nextSave} pkt.` : ''}">🛡${game.saves}${SUFIT ? `<small>→${game.nextSave}</small>` : ''}</span>` : ''}${game.bans ? `<span class="cnt kap${game.armed ? ' arm' : ''}" data-tip="🔨 Kapcie Moderatora: pudło, gdy piłeczka spada w dolnej połowie ekranu, liczy się jako podbicie (🔨 wtedy świeci). Zostało: ${game.bans}.">🔨${game.bans}</span>` : ''}${Math.round(game.score)}<small>pkt${TOUCH ? ` · x${fm(P.total)}` : ` · ${P.b > 1 ? `x${fm(P.b)} more · ` : ''}+${Math.round((P.lv - 1) * 100)}% increased${P.items ? ` + ${fm(P.items)} przedmioty` : ''} = x${fm(P.total)} · ${game.hits} podbić`}${best}${game.bWait ? ' · ⏳ wczytuję przedmioty…' : ''}</small>`;
  }
  function endGame() {
    nadEl.hidden = true;
    const vg = { ticket: game.ticket, log: game.log, st: { dur: Math.round(performance.now() - game.t0), sim: Math.round(game.sim), clicks: game.clicks, misses: game.misses, untr: game.untr, emu: game.emu } };
    const boom = game.boom, small = game.small, gLvlN = game.lvl + 1, score = Math.round(game.score), f = game.f, gHits = game.hits, gZuch = game.zuchAcc || 0, P = partsOf(game); game = null; document.body.classList.remove('playing'); hideMult();
    f.el.remove(); flakes.clear(); hud.hidden = true;
    const ov = document.createElement('div'); ov.id = 'over';
    const av = D.avatars?.[f.u], who = D.users[f.u] || '?', hits = gHits;
    ov.innerHTML = `<div class="box lock"><h3>${boom ? '💥 Piłeczka uderzyła w sufit!' : small ? 'Okno za małe — koniec gry' : 'Koniec gry!'}</h3>
      <div class="ball" style="border-color:${f.el.style.borderColor};${av ? `background-image:url('${esc(av)}')` : ''}">${av ? '' : esc(who[0].toUpperCase())}</div>
      <div class="txt">${(tok() ? accNick() : ls.get('pilNick')) ? `<b style="color:var(--ink)">${esc(tok() ? accNick() : ls.get('pilNick'))}</b>, podbiłeś` : 'Podbiłeś'} <b style="color:var(--ink)">${esc(who)}</b> ${hits} ${hits === 1 ? 'raz' : 'razy'}</div>
      <div class="sc">${score}<small> pkt</small></div>
      <div class="eq">${P.b > 1 ? `<span class="ch" style="background:${BADGE[f.base] || '#d9264a'};color:#fff"><b>×${fm(P.b)}</b><i>piłeczka</i></span><span class="op">×</span>` : ''}<span class="ch"><b>×${fm(P.lv)}</b><i>poziom ${gLvlN}</i></span>${P.items ? `<span class="op">+</span><span class="ch"><b>+${fm(P.items)}${gZuch ? `<sup class="zsup" title="w tym nabite podbiciami tuż nad dołem ekranu">+${fm(gZuch)}</sup>` : ''}</b><i>przedmioty</i></span>` : ''}<span class="op">=</span><span class="ch tot"><b>×${fm(P.total)}</b><i>na koniec</i></span></div>
      ${EQON ? chancesHtml(score) : ''}
      <input id="pilNick" minlength="3" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Twój nick" value="${esc(ls.get('pilNick') || '')}">
      <div class="row"><button class="pri" id="pilSave">Zapisz wynik</button></div><div class="msg" id="pilMsg"></div><div id="pilAccF"></div>${KONTA && !tok() ? '<div class="acclink">🔒 <a href="#" data-a="login">Zaloguj się</a> albo <a href="#" data-a="reg">załóż konto</a> — nick chroniony hasłem i ten sam ekwipunek na każdym urządzeniu</div>' : ''}<div id="pilDrop"></div><div class="endrow"><button id="pilAgain" class="closebig">▶ Zagraj jeszcze raz</button><button id="pilClose" class="closesm">Zamknij</button></div></div>`;
    document.body.appendChild(ov);
    setTimeout(() => ov.querySelector('.box').classList.remove('lock'), 700); // klikanie z rozpędu tuż po końcu gry nie trafia w przyciski (przez 0,7 s są wyszarzone)
    // decyzja o przedmiocie tylko tutaj: zamknięcie okna bez wyboru = przedmiot przepada (nie da się odłożyć i porównać później)
    let pendId = null, pendN = false; // pendN: normalny przedmiot — zamknięcie bez pytania
    // ekwipunek tej gry ustalony w chwili końca: logowanie/rejestracja w trakcie decyzji o dropie nie przekieruje jej do innego ekwipunku
    const auth0 = EQON ? eqAuth() : {};
    const close = () => {
      if (dropOpen && pendId) { if (!pendN && !confirm('Nie wybrałeś — nowy przedmiot przepadnie. Zamknąć?')) return false; eqPost('/equip', { ...auth0, id: pendId, action: 'discard' }); }
      ov.remove(); if (KONTA) setTimeout(checkMerge, 300); return true;
    };
    let dropOpen = false; // nierozstrzygnięty przedmiot: okno zamyka się tylko przyciskiem
    const closeB = ov.querySelector('#pilClose'), againB = ov.querySelector('#pilAgain'), dropEl = ov.querySelector('#pilDrop');
    const setWait = (w) => { closeB.disabled = againB.disabled = w; }; // dopóki serwer losuje przedmiot, okna nie da się zamknąć (inaczej przedmiot przepadłby niezauważony)
    const verP = verify(vg, auth0); // zweryfikowany wynik (bilet r) dla dropu i zapisu
    if (EQON && score >= 15) { // drop idzie od razu, niezależnie od zapisu wyniku
      setWait(true); dropEl.innerHTML = '<div class="msg">Losuję przedmiot…</div>';
      const slow = setTimeout(() => { setWait(false); dropEl.innerHTML = '<div class="msg">Serwer długo nie odpowiada — przedmiot pokaże się tutaj, jeśli poczekasz.</div>'; }, 12000);
      verP.then((v) => v.r ? eqPost('/drop', { ...auth0, r: v.r, ballUid: /^\d+$/.test(f.u) ? f.u : '', ballNick: D.users[f.u] || '' }) : { ok: true, j: { drop: null, reason: '' } })
        .then((r) => {
          clearTimeout(slow); setWait(false); if (!r.ok) throw 0;
          if (r.j.drop) { pendId = r.j.autoDiscard ? null : r.j.drop.id; pendN = r.j.drop.rarity === 'n'; ov.querySelector('.box').classList.add('wide'); showDrop(dropEl, r.j, (o) => { dropOpen = o; }, auth0); }
          else dropEl.innerHTML = `<div class="msg">${r.j.reason === 'pech' ? `Tym razem nic nie wypadło (szansa ${r.j.chance}%).` : r.j.reason === 'za szybko' ? 'Nic nie wypadło: od poprzedniego przedmiotu minęło mniej niż 15 s.' : r.j.reason && r.j.reason !== 'ta gra już była' ? esc(r.j.reason) : 'Tym razem nic nie wypadło.'}</div>`;
        }).catch(() => { clearTimeout(slow); setWait(false); dropEl.innerHTML = '<div class="msg">Nie udało się wylosować przedmiotu (błąd sieci lub serwera).</div>'; });
    }
    closeB.onclick = close;
    againB.onclick = () => { if (close()) replay(); };
    const nickEl = ov.querySelector('#pilNick'), saveB = ov.querySelector('#pilSave'), msgEl = ov.querySelector('#pilMsg'), accF = ov.querySelector('#pilAccF');
    ov.querySelectorAll('.acclink a').forEach((a) => a.onclick = (e) => { e.preventDefault(); openInv({ konto: a.dataset.a, nick: tok() ? '' : nickEl.value.trim() || ls.get('pilNick') || '' }); });
    const chgNick = () => { msgEl.textContent = ''; accF.innerHTML = ''; nickEl.style.display = ''; saveB.style.display = ''; saveB.textContent = 'Zapisz pod nowym nickiem'; nickEl.value = ''; nickEl.focus(); };
    // nick z kontem: logowanie w oknie końca gry, potem ponowny zapis (wynik nie przepada)
    const loginForm = (nick, why) => {
      nickEl.style.display = 'none'; saveB.style.display = 'none'; msgEl.textContent = ''; ov.querySelector('.acclink')?.remove();
      accF.innerHTML = `<form class="accf"><div class="accwhy">${why}</div><input type="text" name="username" autocomplete="username" value="${esc(nick)}" hidden><input type="password" name="password" autocomplete="current-password" placeholder="Hasło" required><button class="pri" type="submit">Zaloguj i zapisz</button><div class="msg"></div><div class="accsm">Nie pamiętasz hasła? Zmień je na urządzeniu, na którym jesteś zalogowany (Ekwipunek → Konto), albo napisz PW do kruszkush na d2jsp po jednorazowy kod. · <a href="#" data-a="other">Zapisz pod innym nickiem</a></div></form>`;
      const fm = accF.querySelector('form'), pw = fm.querySelector('[type=password]'), m = fm.querySelector('.msg');
      fm.onsubmit = (e) => {
        e.preventDefault(); m.textContent = 'Loguję…';
        accPost('/login', { nick, password: pw.value }).then((r) => { if (!r.ok) { m.textContent = r.j?.error || 'Błąd logowania.'; return; } accF.innerHTML = ''; accDone(r.j); save(); })
          .catch(() => { m.textContent = 'Błąd sieci, spróbuj jeszcze raz.'; });
      };
      fm.querySelector('[data-a="other"]').onclick = (e) => { e.preventDefault(); ls.del('pilNick'); chgNick(); };
      setTimeout(() => pw.focus(), 50);
    };
    const save = () => {
      const nick = tok() ? accNick() : nickEl.value.trim(); // zalogowany zawsze zapisuje pod nickiem konta
      if (nick.length < 3) { msgEl.textContent = 'Nick musi mieć co najmniej 3 znaki.'; return; }
      ls.set('pilNick', nick); ls.set('pilGral', '1');
      msgEl.textContent = 'Zapisuję…';
      verP.then((v) => v.r ? fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nick, r: v.r, dev: TOUCH ? 'm' : 'd', ball: D.users[f.u] || '', ballUid: /^\d+$/.test(f.u) ? f.u : '', okres, ...(EQON ? (tok() ? { token: tok() } : { key: getKey() }) : {}) }) }).then((r) => r.json()) : { error: v.error })
        .then((j) => {
          if (KONTA && j.need === 'login') { loginForm(j.nick || nick, `🔒 Nick <b>${esc(j.nick || nick)}</b> ma konto. Zaloguj się, żeby zapisać wynik na tym urządzeniu:`); return; }
          if (KONTA && j.relogin) { const n = dropSession() || nick; loginForm(n, `To urządzenie zostało wylogowane. Zaloguj się ponownie, żeby zapisać wynik jako <b>${esc(n)}</b>:`); return; }
          if (j.top) {
            if (j.me?.best) myBest = j.me.best; showRank(j); const m = j.me;
            if (EQON && m) {
              msgEl.innerHTML = `✔ <b>${esc(nick)}</b>${m.konto ? ' <span title="nick chroniony hasłem">🔒</span>' : ''} · ${m.record ? '<b style="color:var(--acc)">nowy rekord!</b>' : `rekord ${m.best}`} · gra nr ${m.plays}${m.konto ? '' : ' · <a href="#" data-a="chg">zmień nick</a>'}`;
              const ch = msgEl.querySelector('[data-a="chg"]'); if (ch) ch.onclick = (e) => { e.preventDefault(); chgNick(); };
              if (m.claim) addNudge(msgEl, `🔒 Nick <b>${esc(nick)}</b> nie jest chroniony — każdy może zapisać wynik pod nim. Konto daje hasło do nicku i ten sam ekwipunek na każdym urządzeniu.`, nick);
              return;
            }
            if (dropOpen) msgEl.textContent = 'Wynik zapisany. Rozstrzygnij przedmiot poniżej.'; else { close(); card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
          } else msgEl.textContent = j.error || 'Błąd zapisu.';
        })
        .catch(() => { msgEl.textContent = 'Nie udało się zapisać, spróbuj jeszcze raz.'; });
    };
    saveB.onclick = save;
    nickEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    // zapamiętany nick (albo konto) → zapis automatyczny (serwer i tak trzyma najlepszy wynik), z opcją zmiany nicku
    const saved = tok() ? accNick() : ls.get('pilNick');
    if (EQON && saved) {
      nickEl.style.display = 'none'; saveB.style.display = 'none';
      save();
    } else setTimeout(() => nickEl.focus(), 50);
  }

  // --- ekwipunek (tylko wersja testowa: /test/) ---
  const COL = { n: '#c8c8c8', m: '#6c8cff', r: '#f2d24b', u: '#c7864a' }, RAR = { n: 'Normalny', m: 'Magiczny', r: 'Rzadki', u: 'Unikat' };
  const SLOT = { helm: ['Hełm', 0, 'hełm'], armor: ['Zbroja', 1, 'zbroja'], gloves: ['Rękawice', 2, 'rękawice'], boots: ['Buty', 2, 'buty'] }; // nazwa, rodzaj (m/ż/lm), etykieta pustego slotu
  const UNIQ = { helm: 'Hełm Weterana', armor: 'Zbroja Anioła Stróża', gloves: 'Rękawice Anioła Stróża', boots: 'Kapcie Moderatora' };
  // Stłumiony: pełne działanie do 300 pkt, słabnie do 0 przy 400 pkt, dalej odwrotnie (mocniejsze podbicie) aż do połowy wartości przy 450 pkt
  const STLUM_FROM = 300, STLUM_ZERO = 400, STLUM_REV = .5;
  const stlumNow = (v, score) => v * Math.max(-STLUM_REV, Math.min(1, (STLUM_ZERO - score) / (STLUM_ZERO - STLUM_FROM)));
  const stlumNote = () => `; od ${STLUM_FROM} pkt słabnie, od ${STLUM_ZERO} pkt leci wyżej (odwrotne działanie)`;
  const lowerPct = (v) => Math.round((1 - (1 - v / 100) ** 2) * 100); // słabsze podbicie o v% → wysokość lotu niższa o tyle %
  const kapTxt = (n) => `${n > 1 ? `${n} razy` : 'Raz'} na grę: pudło, gdy piłeczka spada w dolnej połowie ekranu, liczy się jako podbicie`;
  // afiksy: [typ p/s, nazwa, min, max, krok, przymiotnik m/ż/lm albo dopełniacz, opis(v)]
  const AFF = {
    ostry: ['p', 'Ostry', 0.4, 1.0, 0.1, ['Ostry', 'Ostra', 'Ostre'], (v) => `+${v.toFixed(1)}x mnożnika`],
    stlumiony: ['p', 'Stłumiony', 5, 15, 1, ['Stłumiony', 'Stłumiona', 'Stłumione'], (v) => `Piłeczka odbija się ${lowerPct(v)}% niżej${stlumNote()}`],
    ciezki: ['p', 'Ciężki', 5, 10, 1, ['Ciężki', 'Ciężka', 'Ciężkie'], (v) => `Grawitacja słabsza o ${v}%`],
    zreczny: ['p', 'Zręczny', 10, 30, 1, ['Zręczny', 'Zręczna', 'Zręczne'], (v) => `Odbicie w bok mniejsze o ${v}%`],
    szczesliwy: ['p', 'Szczęśliwy', 30, 60, 1, ['Szczęśliwy', 'Szczęśliwa', 'Szczęśliwe'], (v) => `+${v}% magic find (sumuje się z magic find z punktów)`],
    brawurowy: ['p', 'Brawurowy', 0.15, 0.25, 0.01, ['Brawurowy', 'Brawurowa', 'Brawurowe'], (v) => `+${v.toFixed(2)}x mnożnika za każde kolejne podbicie z rzędu tuż nad dołem ekranu (seria maks. +${BRAV_MAX}x)`],
    zuchwaly: ['p', 'Zuchwały', 0.02, 0.04, 0.01, ['Zuchwały', 'Zuchwała', 'Zuchwałe'], (v) => `+${v.toFixed(2)}x mnożnika na stałe za każde podbicie tuż nad dołem ekranu (od 2. poziomu, nabija się maks. do +${ZUCH_MAX}x)`],
    rozpedzony: ['p', 'Rozpędzony', 10, 20, 1, ['Rozpędzony', 'Rozpędzona', 'Rozpędzone'], (v) => `Rozpocznij z mnożnikiem ogólnym zwiększonym o ${v}%`],
    wytrwalosci: ['s', 'Wytrwałości', 5, 15, 1, 'Wytrwałości', (v) => `Piłeczka przyspiesza o ${v}% wolniej`],
    olbrzyma: ['s', 'Olbrzyma', 5, 10, 1, 'Olbrzyma', (v) => `Większa piłeczka o ${v}%`],
    lowcy: ['s', 'Łowcy', 0.2, 0.5, 0.1, 'Łowcy', (v) => `+${v.toFixed(1)}x do mnożnika małych i średnich piłeczek (x1.3, x1.7)`],
    echa: ['s', 'Echa', 10, 20, 1, 'Echa', (v) => `+${v}% szansy na podwójne punkty za podbicie`],
    stroza: ['s', 'Stróża', 1, 1, 1, 'Stróża', () => SUFIT ? '3 razy na grę: odbicie od dołu zamiast końca gry' : 'Raz na grę: odbicie od dołu zamiast końca gry'],
    serii: ['s', 'Serii', 0.10, 0.25, 0.01, 'Serii', (v) => `+${v.toFixed(2)}x mnożnika za każde 10 podbić`],
    lotny: ['p', 'Lotny', 2, 5, 1, ['Lotny', 'Lotna', 'Lotne'], (v) => `Obszar trafienia piłeczki większy o ${v} px`],
    wznoszacy: ['p', 'Wznoszący', 0.02, 0.04, 0.01, ['Wznoszący', 'Wznosząca', 'Wznoszące'], (v) => `+${v.toFixed(2)}x mnożnika za każdy osiągnięty poziom (dodawane do części „przedmioty”)`],
    krytyczny: ['p', 'Krytyczny', 3, 10, 1, ['Krytyczny', 'Krytyczna', 'Krytyczne'], (v) => `+${v}% szansy na potrójne punkty za podbicie (napis „KRYT ×3”)`],
    maratonczyka: ['s', 'Maratończyka', 0.05, 0.15, 0.01, 'Maratończyka', (v) => `+${v.toFixed(2)}x mnożnika za każde pełne 30 s gry (dodawane do części „przedmioty”)`],
    rytmu: ['s', 'Rytmu', 1, 3, 1, 'Rytmu', (v) => `+${v} pkt za co 5. podbicie (5., 10., 15. …)`],
    zlota: ['s', 'Złotej Piłki', 1, 3, 1, 'Złotej Piłki', (v) => `+${v}% szansy na dziesięciokrotne punkty za podbicie (piłeczka błyska na złoto, napis „×10”)`],
  };
  const itemName = (it) => {
    const s = SLOT[it.slot]; if (it.rarity === 'u') return UNIQ[it.slot];
    const af = (it.affixes || []).filter((a) => AFF[a.id]);
    return [...af.filter((a) => AFF[a.id][0] === 'p').map((a) => AFF[a.id][5][s[1]]), s[0], ...af.filter((a) => AFF[a.id][0] === 's').map((a) => AFF[a.id][5])].join(' ');
  };
  const coloured = (it) => `<b style="color:${COL[it.rarity]}">${esc(itemName(it))}</b>`;
  // Dymek w stylu D2 (najechanie; na telefonie dotknięcie pokazuje/ukrywa)
  const ITEMS = {};
  // klasa afiksu (jak na serwerze): im wyższa, tym rzadsza
  const TIER = { stlumiony: 'slaby', zreczny: 'slaby', olbrzyma: 'slaby', lowcy: 'dobry',  ciezki: 'dobry', wytrwalosci: 'dobry', rozpedzony: 'znakomity', szczesliwy: 'dobry', brawurowy: 'znakomity', zuchwaly: 'znakomity', echa: 'znakomity', lotny: 'znakomity', wznoszacy: 'znakomity', krytyczny: 'znakomity', maratonczyka: 'znakomity', rytmu: 'znakomity', ostry: 'boski', serii: 'boski', stroza: 'boski', zlota: 'boski' };
  const TIERN = { slaby: 'słaby', dobry: 'dobry', znakomity: 'znakomity', boski: 'boski' };
  // zakres rolla afiksu w nawiasie (min–max), żeby było widać, jak blisko maksimum jest przedmiot
  const rng = (id) => { const [, , lo, hi, st] = AFF[id]; if (lo === hi) return ''; const f = (v) => st >= 1 ? v : v.toFixed(st < .1 ? 2 : 1); return ` <span class="rng">(${f(lo)}–${f(hi)})</span>`; };
  const tipHtml = (it) => `<div class="tn" style="color:${COL[it.rarity]}">${esc(itemName(it))}</div><div class="ts">${SLOT[it.slot][0]} · ${RAR[it.rarity]}</div><div class="ts">Poziom przedmiotu: ${it.ilvl ?? 0}</div>
    <div class="tg">+${(it.implicit?.mult ?? 0.1).toFixed(1)}x mnożnika</div>${(it.affixes || []).filter((a) => AFF[a.id]).map((a) => `<div class="tb">${esc(AFF[a.id][6](a.v))}${rng(a.id)}<small class="tier t-${TIER[a.id]}">(${TIERN[TIER[a.id]]}${capTxt(a.id) ? ` · łącznie maks. ${capTxt(a.id)}` : ''})</small></div>`).join('')}${it.rarity === 'u' && it.slot === 'boots' ? `<div class="tb">${kapTxt(it.bans || 1)} (🔨 w grze wtedy świeci)</div>` : ''}${it.rarity === 'u' && it.slot === 'helm' ? '<div class="tb">Podwaja premię piłeczek osób, którymi grasz, z top 10 z ostatnich 24 godzin</div>' : ''}`;
  const sumHtml = (b) => {
    const L = [], pct = (x) => Math.round(x * 100), c = (k) => b.capped?.[k] ? ' (limit łączny)' : '';
    const mult = r3(b.impl + b.ostry); if (mult) L.push(`+${fm(mult)}x mnożnika`);
    if (b.setN) L.push(`Zestaw ${D.users[b.setUid] || ''} (${b.setN}/4): +${fm(b.setMult)} pkt za każde podbicie piłeczki${b.setN === 4 ? ' i odbicie od dołu' : ''}`);
    if (b.serii) L.push(`+${b.serii.toFixed(2)}x za każde 10 podbić`);
    if (b.brawur) L.push(`+${b.brawur.toFixed(2)}x mnożnika za każde kolejne podbicie z rzędu tuż nad dołem ekranu (seria maks. +${BRAV_MAX}x)${c('brawur')}`);
    if (b.zuch) L.push(`+${b.zuch.toFixed(2)}x mnożnika na stałe za każde podbicie tuż nad dołem ekranu (od 2. poziomu, nabija się maks. do +${ZUCH_MAX}x)${c('zuch')}`);
    if (b.wzn) L.push(`+${b.wzn.toFixed(2)}x mnożnika za każdy osiągnięty poziom${c('wzn')}`);
    if (b.mar) L.push(`+${b.mar.toFixed(2)}x mnożnika za każde pełne 30 s gry${c('mar')}`);
    if (b.rytm) L.push(`+${b.rytm} pkt za co 5. podbicie${c('rytm')}`);
    if (b.kryt) L.push(`+${pct(b.kryt)}% szansy na potrójne punkty za podbicie${c('kryt')}`);
    if (b.zlota) L.push(`+${pct(b.zlota)}% szansy na dziesięciokrotne punkty za podbicie${c('zlota')}`);
    if (b.lotny) L.push(`Obszar trafienia piłeczki większy o ${b.lotny} px${c('lotny')}`);
    if (b.echa) L.push(`+${pct(b.echa)}% szansy na podwójne punkty za podbicie${c('echa')}`);
    if (b.lowcy) L.push(`+${b.lowcy.toFixed(1)}x do mnożnika małych i średnich piłeczek (x1.3, x1.7)${c('lowcy')}`);
    if (b.rozp) L.push(`Rozpocznij z mnożnikiem ogólnym zwiększonym o ${pct(b.rozp)}%${c('rozp')}`);
    if (b.wytrw) L.push(`Piłeczka przyspiesza o ${Math.round(b.wytrw * 100)}% wolniej${c('wytrw')}`);
    if (b.stlum) L.push(`Piłeczka odbija się ${lowerPct(pct(b.stlum))}% niżej${c('stlum')}${stlumNote()}`);
    if (b.ciezki) L.push(`Grawitacja słabsza o ${pct(b.ciezki)}%${c('ciezki')}`);
    if (b.zreczny) L.push(`Odbicie w bok mniejsze o ${pct(b.zreczny)}%${c('zreczny')}`);
    if (b.olb) L.push(`Większa piłeczka o ${pct(b.olb)}%${c('olb')}`);
    if (b.lucky) L.push(`+${b.lucky}% magic find${c('lucky')}`);
    if (b.kapcie) L.push(`Kapcie Moderatora: ${kapTxt(b.kapcie).replace(/^R/, 'r')}`);
    if (b.korona) L.push('Hełm Weterana: podwaja premię piłeczek osób, którymi grasz, z top 10 z ostatnich 24 godzin');
    if (b.guardian) L.push(`Anioł Stróż: ${b.guardian}× ratunek na grę`);
    return `<div class="eqsum"><h4>Łączne bonusy</h4>${L.length ? L.map((x) => `<div>${esc(x)}</div>`).join('') : '<div class="mute">brak</div>'}</div>`;
  };
  // Szanse na przedmiot (kopia wzoru z serwera): płynny wzrost, powyżej 1000 pkt dalej tempem ostatniego odcinka (bez limitu); szczęśliwy przesuwa % z Normalnego (70% → M, 30% → R)
  function chances(score, luck = 0) {
    const cv = (P) => { const x = Math.max(P[0][0], score), Z = P.length - 1; if (x > P[Z][0]) return P[Z][1] + (P[Z][1] - P[Z - 1][1]) * (x - P[Z][0]) / (P[Z][0] - P[Z - 1][0]); for (let i = 1; i < P.length; i++) if (x <= P[i][0]) return P[i - 1][1] + (P[i][1] - P[i - 1][1]) * (x - P[i - 1][0]) / (P[i][0] - P[i - 1][0]); return P[P.length - 1][1]; };
    const r0 = .25 + 3 * (cv([[15, .25], [50, 1], [100, 2], [200, 4], [300, 6], [600, 10], [1000, 15]]) - .25), m0 = 14 + 3 * (cv([[15, 14], [50, 22], [100, 30], [200, 38], [300, 42], [600, 45], [1000, 45]]) - 14); // magic find z punktów ×3 (PTS_MF_MULT w main.py)
    const n0 = Math.max(5, 100 - (m0 - 14) / 3 - 14 - (r0 - .25) / 3 - .25); // normalne z krzywych bez mnożnika — znikają powoli
    const L = Math.min(luck, 100) / (100 + Math.max(0, m0 + r0 - 14.25)), x = Math.min(n0, r0 * L), n = n0 - x, m = m0, r = r0 + x, u = (score < 50 ? 0 : cv([[50, .3], [150, .8], [300, 1.1], [600, 1.5], [1000, 1.8]])) * (1 + L), k = (100 - u) / (n + m + r);
    return { n: n * k, m: m * k, r: r * k, u, mfPts: m0 + r0 - 14.25 };
  }
  function chancesHtml(score) {
    if (score < 15) return `<div class="mf">Przedmiot wypada od 15 pkt — im więcej punktów, tym większa szansa na rzadszy.</div>`;
    const L0 = Math.min(B.lucky || 0, 100) / (100 + Math.max(0, chances(score, 0).mfPts)), c = chances(score, B.lucky || 0), c0 = chances(score, 0), p = (v) => v < 10 ? v.toFixed(1) : Math.round(v);
    const mfPts = Math.round(c0.mfPts), mfIt = Math.min(B.lucky || 0, 100); // magic find: zwykła suma — z punktów + z przedmiotów
    const row = (k, name, v) => `<div class="mfr"><span style="color:${COL[k]}">${name}</span><i>·</i><b>${p(v)}%</b></div>`;
    return `<details class="mf"><summary>Magic find <b>+${mfPts + mfIt}%</b> ▾</summary>
      <div class="mfr"><span>Szansa na drop</span><i>·</i><b>${Math.round(Math.min(1, score / 80) * 100)}%</b></div>
      ${row('n', 'Normalny', c.n)}${row('m', 'Magiczny', c.m)}${row('r', 'Rzadki', c.r)}${c.u ? row('u', 'Unikat', c.u) : ''}
      ${mfIt ? `<div class="mft"><span>+${mfPts}% z punktów + ${mfIt}% z przedmiotów; przedmioty podnoszą rzadkie i unikaty o ${Math.round(L0 * 100)}%</span></div>` : ''}</details>`;
  }
  const rndHex = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  const getKey = () => { let k = ls.get('eqKey'); if (!/^[0-9a-f]{32}$/.test(k || '')) { k = rndHex(); ls.set('eqKey', k); } return k; };
  // konto: token sesji tego urządzenia (pilTok) zamiast klucza gościa (eqKey); eqKeyOld = klucz gościa czekający na połączenie z kontem
  const tok = () => KONTA ? ls.get('pilTok') : null, accNick = () => ls.get('pilAcc') || '';
  // bilet gry z /start (ponawiany; krótka gra może skończyć się przed odpowiedzią serwera) i weryfikacja w /end — raz na grę
  // rzuty szans za podbicia (Echa k=1, Krytyczny k=2, Złotej Piłki k=3) liczone z seeda z biletu — serwer w /end liczy te same rzuty (kopia: roll() w main.py)
  // wersja zasad punktacji: podbij razem z GRA_MIN_VER w main.py przy każdej zmianie, którą sprawdza serwer (punkty, szanse) — stara karta przeładuje się sama zamiast dostać odrzucony wynik
  const GRA_VER = 1;
  const staleReload = () => { if (game) { flash('Nowa wersja gry — przeładowuję…', 2000); game = null; } setTimeout(() => location.reload(), 1200); };
  const roll = (seed, k, i) => { let x = (seed ^ Math.imul(k, 0x9E3779B1) ^ Math.imul(i, 0x85EBCA77)) >>> 0; x ^= x >>> 16; x = Math.imul(x, 0x85EBCA6B) >>> 0; x ^= x >>> 13; x = Math.imul(x, 0xC2B2AE35) >>> 0; x ^= x >>> 16; return (x >>> 0) / 2 ** 32; };
  const getTicket = () => { const go = (n) => fetch(API + '/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ver: GRA_VER }) }).then((r) => r.json()).then((j) => { if (j.stale) { staleReload(); return null; } if (!j.g || !Number.isInteger(j.s)) throw 0; return { g: j.g, s: j.s }; }).catch(() => n > 0 ? new Promise((ok) => setTimeout(ok, 1500)).then(() => go(n - 1)) : null); return go(3); };
  const verify = (vg, auth) => vg.log.length ? Promise.resolve(vg.ticket).then((t) => t ? fetch(API + '/end', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...auth, g: t.g, log: vg.log, st: vg.st }) }).then((r) => r.json()) : { error: 'Brak połączenia z serwerem gry — wynik nie może być zapisany.' }).catch(() => ({ error: 'Błąd sieci przy sprawdzaniu wyniku.' })) : Promise.resolve({ error: 'Brak podbić.' });
  const eqAuth = () => tok() ? { token: tok() } : { key: getKey() };
  const eqPost = (path, body) => fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => r.json().then((j) => {
      if (KONTA && r.status === 401 && j?.relogin && body.token) dropSession('To urządzenie zostało wylogowane (z innego urządzenia albo po zmianie hasła).');
      // bonusy liczymy tylko z ekwipunku, którym gra to urządzenie (nie z podglądu ekwipunku gościa przy łączeniu)
      if (path !== '/view' && j && j.slots && (body.token || !tok())) { B = calcB(j.slots); eqReady = true; if (game?.bWait) lateB(); }
      return { ok: r.ok, status: r.status, j };
    }));
  const accPost = (path, body) => eqPost(path, { ...body, dev: TOUCH ? 'm' : 'd' });
  const snoozed = () => +(ls.get('pilKontoNie') || 0) > Date.now();
  // zachęta do konta (po zapisie wyniku pod wolnym nickiem, po dropie magicznego+); „Nie teraz” chowa na 7 dni
  const nudgeHtml = (txt) => `<div class="accnudge">${txt} <a href="#" data-a="reg">Załóż konto</a> · <a href="#" data-a="login">Zaloguj się</a> · <a href="#" data-a="later">Nie teraz</a></div>`;
  function addNudge(host, txt, nick) {
    const ov = host.closest('#over') || host;
    if (!KONTA || tok() || snoozed() || ov.querySelector('.accnudge')) return;
    host.insertAdjacentHTML('beforeend', nudgeHtml(txt));
    const n = host.querySelector('.accnudge');
    n.querySelector('[data-a="reg"]').onclick = (e) => { e.preventDefault(); openInv({ konto: 'reg', nick }); };
    n.querySelector('[data-a="login"]').onclick = (e) => { e.preventDefault(); openInv({ konto: 'login', nick }); };
    ov.querySelector('.acclink')?.remove(); // zachęta zastępuje krótki link
    n.querySelector('[data-a="later"]').onclick = (e) => { e.preventDefault(); ls.set('pilKontoNie', String(Date.now() + 7 * 864e5)); n.remove(); };
  }
  // po rejestracji / logowaniu / kodzie od admina (j = { token, nick, bound })
  function accDone(j) {
    const old = ls.get('eqKey');
    ls.set('pilTok', j.token); ls.set('pilAcc', j.nick); ls.set('pilNick', j.nick); ls.set('pilGral', '1'); ls.del('eqOwned');
    // rejestracja przypina ekwipunek klucza do konta (bound) — klucz gościa znika; przy logowaniu czeka na połączenie
    if (old) { if (!j.bound) ls.set('eqKeyOld', old); ls.del('eqKey'); }
    document.querySelectorAll('.accnudge, .acclink').forEach((x) => x.remove());
    eqPost('/inv', eqAuth()).catch(() => {});
    loadRank(); accRedraw(); accBtnDraw();
    if (!document.getElementById('over')) checkMerge();
  }
  // wylogowanie lokalne (przycisk albo sesja usunięta z innego urządzenia); zwraca nick konta
  function dropSession(msg) {
    const nick = accNick(), old = ls.get('eqKeyOld');
    ls.del('pilTok'); ls.del('pilAcc'); ls.del('pilNick');
    if (old) { ls.set('eqKey', old); ls.del('eqKeyOld'); } // niepołączony ekwipunek gościa wraca; po rejestracji — nowy, pusty klucz
    B = zeroB(); eqReady = true;
    eqPost('/inv', eqAuth()).catch(() => {});
    if (msg) flash(msg, 3500);
    loadRank(); accRedraw(); accBtnDraw();
    return nick;
  }
  let accRedraw = () => {}, accBtnDraw = () => {}; // odświeża sekcję „Konto” (gdy Ekwipunek jest otwarty) i przycisk konta pod rankingiem
  // Łączenie: ekwipunek gościa z tego urządzenia + ekwipunek konta → okno wyboru per slot (domyślnie rzadszy, remis → konto)
  const RANK = { n: 0, m: 1, r: 2, u: 3 };
  let merging = false;
  async function checkMerge() {
    const old = ls.get('eqKeyOld');
    if (!KONTA || !tok() || !old || merging || document.getElementById('over') || document.querySelector('.eqmerge')) return;
    merging = true;
    try {
      const g = await eqPost('/inv', { key: old });
      const gs = g.ok ? g.j.slots || {} : null;
      if (!gs || !Object.values(gs).some(Boolean)) { if (g.ok || g.status === 403) ls.del('eqKeyOld'); return; } // pusty albo już przypięty do konta
      const a = await eqPost('/inv', eqAuth()); if (!a.ok) return;
      const as = a.j.slots || {}, pick = {}, clash = [];
      for (const s of Object.keys(SLOT)) {
        const x = as[s], y = gs[s];
        if (!y || (x && x.id === y.id)) pick[s] = 'acc'; else if (!x) pick[s] = 'dev';
        else { clash.push(s); pick[s] = RANK[y.rarity] > RANK[x.rarity] ? 'dev' : 'acc'; }
      }
      if (!clash.length) { // bez kolizji (konto puste tam, gdzie gość ma przedmiot) — łączymy bez pytania
        const m = await eqPost('/merge', { ...eqAuth(), key: old, pick });
        if (m.ok || m.status === 409) ls.del('eqKeyOld');
        if (m.ok) flash('Przedmioty z tego urządzenia dodane do konta', 2500);
        return;
      }
      openMerge(as, gs, pick, clash, old);
    } catch {} finally { merging = false; }
  }
  function openMerge(as, gs, pick, clash, old) {
    const ov = document.createElement('div'); ov.className = 'eqo eqmerge';
    const opt = (s, v, it, tag) => `<label class="mopt"><input type="radio" name="m-${s}" value="${v}"${pick[s] === v ? ' checked' : ''}><span class="tag">${tag}</span>${itemEl(it)}<span class="eqname" style="color:${COL[it.rarity]}">${esc(itemName(it))}</span></label>`;
    const auto = Object.keys(SLOT).filter((s) => !clash.includes(s) && pick[s] === 'dev');
    ov.innerHTML = `<div class="eqbox" style="width:min(400px,calc(100vw - 32px))"><h3 style="margin:0 0 6px">Połącz ekwipunek</h3>
      <div class="eqnote" style="margin:0 0 10px">Na tym urządzeniu są przedmioty z gry bez konta. W każdym slocie wybierz, który przedmiot zostaje na koncie <b>${esc(accNick())}</b> — niewybrany zniknie z gry.${auto.length ? ` Do pustych slotów konta trafią: ${auto.map((s) => coloured(gs[s])).join(', ')}.` : ''}</div>
      ${clash.map((s) => `<div class="mrow"><div class="mslot">${SLOT[s][0]}</div>${opt(s, 'acc', as[s], 'na koncie')}${opt(s, 'dev', gs[s], 'z tego urządzenia')}</div>`).join('')}
      <div class="row" style="margin-top:12px"><button class="pri" data-a="ok">Połącz</button><button data-a="later">Później</button></div><div class="msg" style="text-align:center"></div></div>`;
    document.body.appendChild(ov);
    const msg = ov.querySelector('.msg');
    ov.querySelector('[data-a="later"]').onclick = () => ov.remove(); // zapyta znowu przy następnym wejściu
    ov.querySelector('[data-a="ok"]').onclick = (e) => {
      for (const s of clash) pick[s] = ov.querySelector(`input[name="m-${s}"]:checked`)?.value || 'acc';
      e.target.disabled = true; msg.textContent = 'Łączę…';
      eqPost('/merge', { ...eqAuth(), key: old, pick }).then((r) => {
        if (r.ok || r.status === 409) { ls.del('eqKeyOld'); ov.remove(); flash(r.ok ? 'Ekwipunek połączony' : 'Ten ekwipunek należy już do innego konta', 2500); }
        else { msg.textContent = r.j?.error || 'Błąd, spróbuj jeszcze raz.'; e.target.disabled = false; }
      }).catch(() => { msg.textContent = 'Błąd sieci, spróbuj jeszcze raz.'; e.target.disabled = false; });
    };
  }
  // Przedmiot = awatar podbitej osoby + nakładka slotu w kolorze rzadkości
  function itemEl(it) {
    const av = it.uid && D?.avatars?.[it.uid];
    ITEMS[it.id] = it;
    return `<div class="eqit q-${it.rarity}" data-tid="${esc(it.id)}"><div class="eqav" style="${av ? `background-image:url('${esc(av)}')` : ''}">${av ? '' : esc((it.unick || '?')[0].toUpperCase())}</div><svg class="eqov" style="color:${COL[it.rarity]}"><use href="#eq-${it.slot}"/></svg></div>`;
  }
  // Porównanie „założone → nowy” z przyciskami; done(stan) po rozstrzygnięciu (albo done(null) gdy przedmiot już przepadł)
  function decideUI(host, item, cur, done, auth = eqAuth()) {
    host.innerHTML = `<div class="eqcmp">${cur ? `<div class="eqc q-${cur.rarity}"><span class="tag">założone</span>${itemEl(cur)}<div class="eqname" style="color:${COL[cur.rarity]}">${esc(itemName(cur))}</div></div><div class="arr">→</div>` : ''}<div class="eqc q-${item.rarity}"><span class="tag">nowy</span>${itemEl(item)}<div class="eqname" style="color:${COL[item.rarity]}">${esc(itemName(item))}</div></div></div>
      <div class="row"><button class="pri" data-a="equip">Załóż nowy</button><button data-a="discard">Zostaw stary</button></div><div class="msg"></div>`;
    const msg = host.querySelector('.msg');
    host.querySelectorAll('button').forEach((b) => b.onclick = () => {
      const a = b.dataset.a;
      if (a === 'equip' && cur && !confirm(`Po zamianie ${itemName(cur)} przepadnie na zawsze. Na pewno?`)) return;
      host.querySelectorAll('button').forEach((x) => x.disabled = true);
      eqPost('/equip', { ...auth, id: item.id, action: a }).then((r) => {
        if (r.status === 409) { host.innerHTML = '<div class="msg">Ten przedmiot już przepadł.</div>'; done(null); }
        else if (r.ok) { host.innerHTML = `<div class="eqres">${a === 'equip' ? 'Założono' : cur ? 'Zostawiono stary' : 'Odrzucono'}: ${coloured(a === 'equip' || !cur ? item : cur)}</div>`; done(r.j); }
        else throw 0;
      }).catch(() => { msg.textContent = 'Błąd sieci, spróbuj jeszcze raz.'; host.querySelectorAll('button').forEach((x) => x.disabled = false); });
    });
  }
  // Sekcja dropu w oknie końca gry; setOpen(true) dopóki czeka na decyzję (okno się wtedy nie zamyka po zapisie wyniku)
  function showDrop(host, j, setOpen, auth) {
    const it = j.drop;
    host.innerHTML = `<div class="eqdrop">${j.equipped || j.autoDiscard ? '' : `<div>Wypadł przedmiot! <b style="color:${COL[it.rarity]}">${RAR[it.rarity]}</b></div>`}<div class="eqbody"></div><a href="#" data-a="seeinv" class="seeinv">Ekwipunek ›</a></div>`;
    host.querySelector('[data-a="seeinv"]').onclick = (e) => { e.preventDefault(); openInv(); };
    const body = host.querySelector('.eqbody');
    if (it.rarity !== 'n') addNudge(host.querySelector('.eqdrop'), '💾 Przedmioty są zapisane tylko w tej przeglądarce. Z kontem nie zginą i będą na każdym urządzeniu.', ls.get('pilNick') || '');
    if (j.autoDiscard) { body.innerHTML = `<div class="eqres">${itemEl(it)}<span>Wypadł ${coloured(it)} (normalny)<br><small style="color:var(--mute)">gorszy od założonego — odrzucony</small></span></div>`; setOpen(false); return; }
    if (j.equipped) { body.innerHTML = `<div class="eqres">${itemEl(it)}<span>Nowy przedmiot: ${coloured(it)}<br><small style="color:var(--mute)">założony</small></span></div>`; setOpen(false); return; }
    setOpen(true);
    decideUI(body, it, j.current, () => setOpen(false), auth);
  }
  const SLOT_POS = { helm: 'left:160px;top:46px;width:100px;height:100px', armor: 'left:150px;top:186px;width:120px;height:150px', gloves: 'left:22px;top:252px;width:100px;height:100px', boots: 'left:298px;top:252px;width:100px;height:100px' };
  function invPanel(st, title = 'EKWIPUNEK') {
    const bb = calcB(st.slots);
    return `<div class="eqinv"><h3>${esc(title)}</h3>${Object.keys(SLOT).map((s) => { const it = st.slots?.[s]; return `<div class="eqslot ${it ? 'q-' + it.rarity : 'empty'}${it && bb.setN && it.uid === bb.setUid ? ' setg' : ''}" data-l="${SLOT[s][2]}" style="${SLOT_POS[s]}">${it ? `${itemEl(it)}<div class="eqname" data-tid="${esc(it.id)}" style="color:${COL[it.rarity]}">${esc(itemName(it))}</div>` : ''}</div>`; }).join('')}</div>${sumHtml(calcB(st.slots))}`;
  }
  // Podgląd cudzego ekwipunku (z rankingu): tylko do oglądania
  function openView(eq, nick, dev) {
    const ov = document.createElement('div'); ov.className = 'eqo';
    const z = Math.min(1, (innerWidth - 48) / 420);
    ov.innerHTML = `<div class="eqbox" style="width:${Math.round(420 * z)}px"><div class="eqz" style="zoom:${z}"><div class="eqmain">Ładowanie…</div></div>${`<div class="eqnote">Ekwipunek z urządzenia, na którym padł rekord${dev ? ` (${dev === 'm' ? '📱 telefon' : '🖥️ komputer'})` : ''}. ${KONTA ? 'Bez konta każde urządzenie ma osobny ekwipunek — konto (Ekwipunek → Konto) daje ten sam wszędzie.' : 'Każde urządzenie ma osobny ekwipunek — żeby mieć wszędzie ten sam, w „Ekwipunek” skopiuj <b>Kod przenoszenia</b> i wczytaj go na drugim urządzeniu.'}</div>`}<div class="row" style="margin-top:12px"><button data-a="close">Zamknij</button></div></div>`;
    document.body.appendChild(ov);
    ov.onclick = (e) => { if (e.target === ov || e.target.dataset?.a === 'close') ov.remove(); };
    eqPost('/view', { eq }).then((r) => { if (!r.ok) throw 0; ov.querySelector('.eqmain').innerHTML = invPanel(r.j, 'Ekwipunek: ' + nick); })
      .catch(() => { ov.querySelector('.eqmain').textContent = 'Nie udało się pobrać ekwipunku.'; });
  }
  // Legenda gry: rzadkości przedmiotów i klas afiksów (bez listy samych afiksów)
  function openLegend() {
    const ov = document.createElement('div'); ov.className = 'eqo';
    const r = (c, n, d) => `<div class="lgr"><b style="color:${c}">${n}</b><span>${d}</span></div>`;
    ov.innerHTML = `<div class="eqbox" style="width:min(380px,calc(100vw - 32px))"><h3 style="margin:0 0 10px">Legenda</h3>
      <h4>Jak grać</h4><div class="lgr"><span>Kliknij (na telefonie dotknij) spadający awatar — staje się piłeczką. Podbijaj ją, zanim spadnie na dół ekranu. Kliknięcie z boku odbija ją w przeciwną stronę.</span></div>
      <div class="lgr"><span>Każde podbicie daje tyle punktów, ile wynosi mnożnik (u góry ekranu). Co 8 podbić piłeczka leci szybciej, a mnożnik rośnie o 0.1x.</span></div>
      <div class="lgr"><span>Mniejsza piłeczka = trudniej, ale większy mnożnik (plakietka x1.3 lub x1.7). Awatary osób z top 10 forum z ostatnich 24 h dają premię: 1. +0.6x, 2. +0.4x, 3. +0.3x, 4.–10. +0.1x; lider dnia ma złotą ramkę z koroną.</span></div>
      <div class="lgr"><span>Pierwsze 3 podbicia są lekkie. Na komputerze pole gry ma proporcje 1,5 : 1 (przerywane linie). Telefon ma większe piłeczki, mocniejsze podbicie i inne tempo — w rankingu widać, na czym padł wynik (📱/🖥️).</span></div>
      <div class="lgr"><span>W rankingu liczy się Twoja najlepsza pojedyncza gra: ogólnie, w tym tygodniu i dziś.</span></div>
      ${KONTA ? '<div class="lgr"><span>Konto (Ekwipunek → Konto): nick chroniony hasłem — wynik pod nim zapiszesz tylko na zalogowanym urządzeniu — i ten sam ekwipunek na każdym urządzeniu.</span></div>' : ''}
      <h4>Rzadkość przedmiotów</h4>
      ${r(COL.n, 'Normalny', '+0.1x mnożnika')}${r(COL.m, 'Magiczny', '+0.1x mnożnika i 1 afiks')}${r(COL.r, 'Rzadki', '+0.1x mnożnika i 2 afiksy')}${r(COL.u, 'Unikat', '+0.3x mnożnika, 3 losowe afiksy (w tym gwarantowany boski) i unikatowa cecha')}
      <h4>Klasy afiksów</h4>
      <div class="lgr"><b class="t-slaby">słaby</b><span>55%</span></div><div class="lgr"><b class="t-dobry">dobry</b><span>35%</span></div><div class="lgr"><b class="t-znakomity">znakomity</b><span>7%</span></div><div class="lgr"><b class="t-boski">boski</b><span>3%</span></div>
      ${SUFIT ? '<h4>Odbicia za punkty</h4><div class="lgr"><span>Za punkty zdobywasz odbicia od dołu (🛡): przy 50, 150, 350, 750, 1550… pkt — każdy kolejny odstęp jest dwa razy większy. Gdy piłeczka spadnie, odbicie podnosi ją wysoko (mniej więcej na górną ⅓ ekranu), tam piłeczka zatrzymuje się i czeka na Twoje kliknięcie — możesz chwilę odpocząć. Po kliknięciu przez 2 s rozpędza się od wolniejszego tempa.</span></div><h4>Nad ekranem</h4><div class="lgr"><span>Za mocno podbita piłeczka wylatuje nad ekran — wtedy nie da się jej kliknąć, trzeba poczekać, aż spadnie. Wskaźnik u góry pokazuje, ile pikseli nad ekranem jest.</span></div>' : ''}<h4>Zestaw</h4><div class="lgr"><span>Rzadkie lub unikaty z awatarem tej samej osoby — punkty za każde podbicie piłeczki:</span></div><div class="lgr"><b style="color:#3fd13f">2 szt.</b><span>+0.2 pkt</span></div><div class="lgr"><b style="color:#3fd13f">3 szt.</b><span>+0.4 pkt</span></div><div class="lgr"><b style="color:#3fd13f">4 szt.</b><span>+0.6 pkt · pełny zestaw</span></div>
      <h4>Magic find</h4><div class="lgr"><span>Zwiększa szansę na magiczne i rzadkie kosztem normalnych. Rośnie z wynikiem gry. Afiks Szczęśliwy dodaje magic find, który sumuje się z tym z punktów: rzadkie i unikaty × (100 + MF łączny) / (100 + MF z punktów). Im wyższy wynik, tym mniejszy wpływ przedmiotów.</span></div>
      <p class="mute" style="font-size:12px;margin:10px 0 0">Przedmiot może wypaść po grze od 15 pkt (najwyżej raz na 15 s) — im więcej punktów, tym częściej i tym rzadszy.</p>
      <div class="row" style="margin-top:12px"><button data-a="close">Zamknij</button></div></div>`;
    document.body.appendChild(ov);
    ov.onclick = (e) => { if (e.target === ov || e.target.dataset?.a === 'close') ov.remove(); };
  }
  const fmtKey = (k) => k.match(/.{4}/g).join('-');
  // Sekcja „Konto” w Ekwipunku. o.konto: 'reg' | 'login' | 'code' — tryb startowy (np. z zachęty po grze), o.nick — wpisany nick
  function accSection(host, o, onChange) {
    let mode = ['reg', 'login', 'code'].includes(o.konto) ? o.konto : 'reg', devs = null;
    const fmtD = (t) => t ? new Date(t * 1000).toLocaleDateString('pl-PL', { day: 'numeric', month: 'numeric', year: new Date(t * 1000).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }) : '?';
    const draw = () => {
      if (!document.body.contains(host)) return;
      if (tok()) {
        host.innerHTML = `<h4>Konto</h4><div>Zalogowany jako <b>${esc(accNick())}</b> 🔒 — ten sam ekwipunek na każdym urządzeniu, na którym się zalogujesz.</div>
          <ul class="accdev">${devs ? devs.map((d) => `<li><span>${d.dev === 'm' ? '📱' : '🖥️'} ${esc(d.label || 'urządzenie')} <small>· od ${fmtD(d.created)}${d.me ? ' · <b>to urządzenie</b>' : ` · ostatnio ${fmtD(d.seen)}`}</small></span>${d.me ? '' : `<button data-sid="${esc(d.sid)}">Wyloguj</button>`}</li>`).join('') : '<li><span>Ładowanie listy urządzeń…</span></li>'}</ul>
          <form class="accf"><input type="text" name="username" autocomplete="username" value="${esc(accNick())}" hidden><input type="password" name="new-password" autocomplete="new-password" placeholder="Nowe hasło (min. 6 znaków)" minlength="6" required><button type="submit">Zmień hasło</button><div class="accsm">Zmiana hasła wyloguje pozostałe urządzenia. ⚠ Nie używaj hasła z d2jsp ani z innych stron.</div><div class="msg"></div></form>
          <div class="row" style="margin-top:8px"><button data-a="logout">Wyloguj to urządzenie</button></div>`;
        const fm = host.querySelector('form'), m = fm.querySelector('.msg');
        fm.onsubmit = (e) => {
          e.preventDefault(); m.textContent = 'Zapisuję…';
          accPost('/password', { token: tok(), password: fm.querySelector('[type=password]').value }).then((r) => {
            if (!r.ok) { m.textContent = r.j?.error || 'Błąd.'; return; }
            fm.querySelector('[type=password]').value = ''; m.textContent = `Hasło zmienione${r.j.loggedOut ? ` · wylogowano urządzenia: ${r.j.loggedOut}` : ''}.`; loadDevs();
          }).catch(() => { m.textContent = 'Błąd sieci.'; });
        };
        host.querySelectorAll('button[data-sid]').forEach((b) => b.onclick = () => {
          b.disabled = true;
          accPost('/logout', { token: tok(), sid: b.dataset.sid }).then((r) => { if (r.ok) { devs = r.j.sessions; draw(); } else b.disabled = false; }).catch(() => { b.disabled = false; });
        });
        host.querySelector('[data-a="logout"]').onclick = () => {
          if (!confirm('Wylogować to urządzenie? Tutaj zaczniesz z pustym ekwipunkiem gościa — Twoje przedmioty zostają na koncie.')) return;
          const t = tok();
          accPost('/logout', { token: t }).catch(() => {}).finally(() => { if (tok() === t) dropSession('Wylogowano'); onChange(); });
        };
        if (o.konto) { o.konto = null; setTimeout(() => host.scrollIntoView({ block: 'center' }), 50); }
        if (!devs) loadDevs();
        return;
      }
      const owned = ls.get('eqOwned');
      const T = { reg: ['Załóż konto', 'new-password', 'Hasło (min. 6 znaków)'], login: ['Zaloguj się', 'current-password', 'Hasło'], code: ['Ustaw nowe hasło', 'new-password', 'Nowe hasło (min. 6 znaków)'] }[mode];
      host.innerHTML = `<h4>Konto</h4>${owned ? `<div class="warn" style="margin-bottom:6px">Ekwipunek, który był na tym urządzeniu, jest na koncie <b>${esc(owned)}</b> — zaloguj się, żeby go używać.</div>` : ''}
        <div class="accsm" style="font-size:12.5px">Konto chroni Twój nick hasłem (nikt inny nie zapisze pod nim wyniku) i daje ten sam ekwipunek na każdym urządzeniu. Bez e-maila.</div>
        <div class="acctabs">${[['reg', 'Załóż konto'], ['login', 'Zaloguj się'], ['code', 'Mam kod od admina']].map(([k, t]) => `<button type="button" data-m="${k}"${k === mode ? ' class="on"' : ''}>${t}</button>`).join('')}</div>
        <form class="accf"><input type="text" name="username" autocomplete="username" placeholder="Nick" minlength="3" maxlength="20" autocapitalize="off" spellcheck="false" required value="${esc(o.nick || ls.get('pilNick') || '')}">
          ${mode === 'code' ? '<input type="text" name="code" autocomplete="one-time-code" placeholder="Kod od admina (np. ABCD-EFGH)" maxlength="12" autocapitalize="characters" spellcheck="false" required>' : ''}
          <input type="password" name="password" autocomplete="${T[1]}" placeholder="${T[2]}" ${mode === 'login' ? '' : 'minlength="6" '}required>
          <button class="pri" type="submit">${T[0]}</button>
          ${mode !== 'login' ? '<div class="warn">⚠ Nie używaj hasła z d2jsp ani z innych stron.</div>' : ''}
          <div class="msg"></div>
          <div class="accsm">${mode === 'reg' ? 'Ekwipunek z tego urządzenia przejdzie na konto. Nick, który jest już w rankingu, zarejestrujesz na urządzeniu, na którym padł jego rekord — inaczej napisz PW do kruszkush na d2jsp. Zapomniane hasło zmienisz na urządzeniu, na którym jesteś zalogowany, albo dostaniesz od admina jednorazowy kod.'
            : mode === 'login' ? 'Nie pamiętasz hasła? Zmień je na urządzeniu, na którym jesteś zalogowany (Ekwipunek → Konto), albo napisz PW do kruszkush na d2jsp po jednorazowy kod.'
            : 'Kod dostajesz od admina (PW do kruszkush na d2jsp), działa 24 h. Ustawia nowe hasło i wylogowuje wszystkie inne urządzenia tego konta.'}</div></form>`;
      host.querySelectorAll('[data-m]').forEach((b) => b.onclick = () => { o.nick = host.querySelector('[name=username]').value; mode = b.dataset.m; draw(); });
      const fm = host.querySelector('form'), m = fm.querySelector('.msg'), v = (n) => fm.querySelector(`[name=${n}]`)?.value || '';
      fm.onsubmit = (e) => {
        e.preventDefault(); m.textContent = mode === 'login' ? 'Loguję…' : 'Zapisuję…';
        const body = { nick: v('username').trim(), password: v('password'), key: getKey(), ...(mode === 'code' ? { code: v('code') } : {}) };
        accPost({ reg: '/register', login: '/login', code: '/redeem' }[mode], body).then((r) => {
          if (!r.ok) { m.textContent = r.j?.error || 'Błąd.'; return; }
          accDone(r.j); devs = null; draw(); onChange();
          flash(mode === 'reg' ? `Konto ${r.j.nick} założone` : `Zalogowano jako ${r.j.nick}`, 2200);
        }).catch(() => { m.textContent = 'Błąd sieci, spróbuj jeszcze raz.'; });
      };
      if (o.konto) setTimeout(() => { host.scrollIntoView({ block: 'center' }); (v('username') ? fm.querySelector('[name=password]') : fm.querySelector('[name=username]')).focus(); }, 50);
    };
    const loadDevs = () => accPost('/sessions', { token: tok() }).then((r) => { if (r.ok) { devs = r.j.sessions; draw(); } else if (!tok()) { draw(); onChange(); } }).catch(() => {});
    draw();
    return draw;
  }
  function openInv(opts) {
    const o = opts && opts.konto ? opts : {};
    const ov = document.createElement('div'); ov.className = 'eqo';
    const z = Math.min(1, (innerWidth - 48) / 420);
    ov.innerHTML = `<div class="eqbox" style="width:${Math.round(420 * z)}px"><div class="eqz" style="zoom:${z}"><div class="eqmain">Ładowanie…</div></div>
      <div class="eqpend"></div>
      ${KONTA ? '<div class="eqacc"></div>' : ''}
      <div class="eqtool"><h4>Narzędzie testowe</h4></div>
      <div class="eqcode"><h4>Kod przenoszenia</h4><div class="kc"><code></code><button data-a="copy">Kopiuj</button></div>
      <div class="warn">Nie pokazuj nikomu — kto zna kod, ma Twój ekwipunek. Wyczyszczenie przeglądarki bez zapisanego kodu = utrata.</div>
      <div class="kc"><input autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Wklej kod z innego urządzenia" maxlength="60"><button data-a="load">Wczytaj</button></div><div class="msg"></div></div>
      <div class="row"><button data-a="close">Zamknij</button></div></div>`;
    document.body.appendChild(ov);
    const $q = (s) => ov.querySelector(s), msg = $q('.eqcode .msg'); let state = null;
    const show = (st) => {
      state = st; $q('.eqmain').innerHTML = invPanel(st);
      $q('.eqcode').hidden = !!tok(); // kod przenoszenia tylko dla gościa — z kontem ekwipunek jest wszędzie po zalogowaniu
      if (!tok()) { const k = fmtKey(getKey()), h = Math.ceil(k.length / 2); $q('.eqcode code').textContent = k.slice(0, h) + k.slice(h).replace(/[0-9a-f]/g, '•'); } // druga połowa ukryta; „Kopiuj” kopiuje całość
      const pe = $q('.eqpend');
      pe.innerHTML = ''; // nierozstrzygnięty przedmiot nie trafia do ekwipunku — decyzja tylko w oknie końca gry
    };
    let prevKey = null; // kod przenoszenia należący do konta: wracamy do poprzedniego klucza
    const load = () => eqPost('/inv', eqAuth()).then((r) => {
      if (KONTA && r.status === 403 && r.j?.konto !== undefined && prevKey) { ls.set('eqKey', prevKey); prevKey = null; msg.innerHTML = `Ten kod należy do konta <b>${esc(r.j.konto)}</b> — zaloguj się w sekcji Konto.`; return load(); }
      if (KONTA && r.status === 401 && !tok()) return load(); // sesja usunięta — już jako gość
      if (!r.ok) throw 0; prevKey = null; show(r.j);
    }).catch(() => { $q('.eqmain').textContent = 'Nie udało się pobrać ekwipunku.'; });
    load();
    if (KONTA) { const redraw = accSection($q('.eqacc'), o, () => { $q('.eqmain').textContent = 'Ładowanie…'; load(); }); accRedraw = () => { redraw(); }; }
    // narzędzie testowe: zakłada dowolny przedmiot (endpoint /grant działa tylko na funkcji testowej)
    const tool = $q('.eqtool'), opt = (v, t) => `<option value="${v}">${esc(t)}</option>`;
    if (!TEST) tool.remove(); // poza /test/ bez narzędzia testowego
    const affOpts = Object.entries(AFF).map(([id, a]) => opt(id, `${a[0] === 'p' ? 'prefiks' : 'sufiks'}: ${a[1]}`)).join('');
    const valOpts = (id) => { const [, , lo, hi, st] = AFF[id]; let o = ''; for (let i = 0, n = Math.round((hi - lo) / st); i <= n; i++) { const v = +(lo + i * st).toFixed(2); o += opt(v, String(v)); } return o; };
    tool.insertAdjacentHTML('beforeend', `<div class="kc"><select data-t="slot">${Object.entries(SLOT).map(([k, v]) => opt(k, v[0])).join('')}</select><select data-t="rar">${Object.entries(RAR).map(([k, v]) => opt(k, v)).join('')}</select></div>
      ${[1, 2].map((n) => `<div class="kc" data-r="${n}"><select data-t="a${n}">${affOpts}</select><select data-t="v${n}"></select></div>`).join('')}
      <div class="kc"><button data-t="go">Załóż</button></div><div class="msg"></div>`);
    const tq = (k) => tool.querySelector(`[data-t="${k}"]`), nAff = () => ({ n: 0, m: 1, r: 2, u: 0 }[tq('rar').value]);
    const syncTool = () => { tool.querySelectorAll('[data-r]').forEach((r) => { r.hidden = +r.dataset.r > nAff(); }); };
    [1, 2].forEach((n) => { tq('a' + n).onchange = () => { tq('v' + n).innerHTML = valOpts(tq('a' + n).value); }; tq('a' + n).value = n === 1 ? 'ostry' : 'serii'; tq('a' + n).onchange(); });
    tq('rar').onchange = syncTool; syncTool();
    tq('go').onclick = () => {
      const affixes = [1, 2].slice(0, nAff()).map((n) => ({ id: tq('a' + n).value, v: +tq('v' + n).value }));
      if (new Set(affixes.map((a) => a.id)).size < affixes.length) { tool.querySelector('.msg').textContent = 'Afiksy muszą być różne.'; return; }
      tool.querySelector('.msg').textContent = 'Zakładam…';
      eqPost('/grant', { ...eqAuth(), slot: tq('slot').value, rarity: tq('rar').value, affixes })
        .then((r) => { if (!r.ok) throw r.j?.error || 0; tool.querySelector('.msg').textContent = 'Założono.'; show(r.j); }).catch((e) => { tool.querySelector('.msg').textContent = typeof e === 'string' ? e : 'Błąd sieci.'; });
    };
    const shut = () => { ov.remove(); accRedraw = () => {}; if (KONTA) checkMerge(); };
    ov.onclick = (e) => { if (e.target === ov) shut(); };
    ov.querySelectorAll('button[data-a]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.a === 'close') shut();
      else if (b.dataset.a === 'copy') { navigator.clipboard?.writeText(fmtKey(getKey())).then(() => msg.textContent = 'Skopiowano.', () => msg.textContent = 'Nie udało się skopiować — zaznacz kod ręcznie.'); }
      else if (b.dataset.a === 'load') {
        const k = $q('.eqcode input').value.toLowerCase().replace(/[\s-]/g, '');
        if (!/^[0-9a-f]{32}$/.test(k)) { msg.textContent = 'Zły kod (32 znaki 0-9, a-f).'; return; }
        if (k === getKey()) { msg.textContent = 'To już ten sam kod.'; return; }
        if (state && (state.pending || Object.values(state.slots || {}).some(Boolean)) && !confirm('Ten ekwipunek ma przedmioty — po wczytaniu kodu przepadną (chyba że masz zapisany jego kod). Na pewno?')) return;
        prevKey = getKey(); ls.set('eqKey', k); $q('.eqcode input').value = ''; msg.textContent = 'Wczytano.'; $q('.eqmain').textContent = 'Ładowanie…'; load();
      }
    }));
  }
  if (EQON) {
    const eqCss = document.createElement('style');
    eqCss.textContent = `
    #over .box.wide{width:min(380px,calc(100vw - 32px));max-height:calc(100vh - 16px);overflow:auto}
    .eqdrop{margin-top:14px;padding-top:12px;border-top:1px solid var(--line);font-size:14px}.eqdrop .eqbody{margin-top:6px}
    .seeinv{display:inline-block;margin-top:4px;font-size:12.5px;color:var(--acc)}
    .eqres{display:flex;align-items:center;justify-content:center;gap:8px;margin:6px 0;font-size:14px}.eqres .eqit{width:54px;height:54px}
    .eqit{position:relative;width:78px;height:78px}
    .eqav{position:absolute;inset:8%;border-radius:50%;background:#222 center/cover;border:3px solid;display:grid;place-items:center;font-weight:800;color:#ecebe6}
    .eqit .eqav{border-color:#c8c8c8}.eqit.q-m .eqav{border-color:#6c8cff;box-shadow:0 0 10px rgba(108,140,255,.6)}.eqit.q-r .eqav{border-color:#f2d24b;box-shadow:0 0 12px rgba(242,210,75,.7)}
    .eqov{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible}
    .eqname{font-size:11.5px;font-weight:700;text-align:center;line-height:1.2}
    .eqcmp{display:flex;gap:10px;align-items:center;justify-content:center;margin:8px 0 12px}.eqcmp .arr{font-size:22px;color:var(--mute)}
    .eqc{background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:8px;display:flex;flex-direction:column;align-items:center;width:120px}
    .eqc .tag{font-size:10.5px;color:var(--mute);margin-bottom:4px}
    .eqdrop .row,.eqbox>.row{display:flex;gap:8px;justify-content:center}
    .eqdrop .pri{background:var(--acc);border-color:var(--acc);color:#fff}
    .eqdrop .msg,.eqcode .msg{font-size:12px;color:var(--mute);min-height:16px;margin-top:6px;text-align:center}
    .eqo{position:fixed;inset:0;z-index:71;display:grid;place-items:center;background:rgba(0,0,0,.45);overflow:auto}
    .eqbox{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;max-width:calc(100vw - 34px);max-height:calc(100vh - 34px);overflow:auto;box-sizing:content-box}
    .eqbox .eqpend{margin-bottom:6px}
    .eqcode{margin:14px 0 12px;font-size:13px}.eqcode h4{margin:0 0 6px;font-size:13px;color:var(--mute);text-transform:uppercase;letter-spacing:.05em}
    .eqcode .kc{display:flex;gap:6px;align-items:center;margin:6px 0}.eqcode code{flex:1;min-width:0;font-size:13px;user-select:all;word-break:break-all;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:5px 8px}
    .eqcode input{flex:1;min-width:0}
    .eqcode .warn{font-size:12px;color:#e0764f}
    .eqinv{position:relative;width:420px;height:400px;border-radius:6px;background:radial-gradient(ellipse at 30% 20%,rgba(255,255,255,.05),transparent 60%),repeating-linear-gradient(115deg,rgba(255,255,255,.015) 0 2px,transparent 2px 7px),linear-gradient(#3a3835,#2a2826);border:3px solid #56514a;box-shadow:inset 0 0 0 2px #1b1a18,inset 0 0 40px rgba(0,0,0,.6);box-sizing:border-box;color:#ecebe6}
    .eqinv h3{margin:0;padding:12px 0 6px;text-align:center;font:600 20px Georgia,'Times New Roman',serif;letter-spacing:.28em;color:#c9b98f;text-shadow:0 1px 0 #000}
    .lgr{display:flex;gap:10px;align-items:baseline;padding:3px 0;font-size:13px}.lgr b{min-width:80px}.lgr span{color:var(--mute)}.eqbox h4{margin:12px 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--mute)}
    .zsup{font-size:.55em;margin-left:2px;color:#8fb3ff;vertical-align:super}.rng{opacity:.55;font-size:.9em}.tier{display:block;font-size:10px;opacity:.85;margin:-1px 0 3px}.t-slaby{color:#9a9892}.t-dobry{color:#8fb3ff}.t-znakomity{color:#c38bff;text-shadow:0 0 6px rgba(160,90,255,.9)}.t-boski{color:#ff5a4a;text-shadow:0 0 7px rgba(255,40,30,.95)}
    .eqslot.setg{outline:2px solid #3fd13f;outline-offset:2px;box-shadow:inset 0 0 0 2px #000,0 0 14px rgba(63,209,63,.7)!important}
    .eqslot{position:absolute;box-sizing:border-box;background:#0d0d0c;border:2px solid #4a463f;box-shadow:inset 0 0 0 2px #000,inset 0 0 18px rgba(0,0,0,.9);display:grid;place-items:center}
    .eqslot .eqit{width:86px;height:86px}
    .eqslot .eqname{position:absolute;top:100%;margin-top:3px;left:50%;transform:translateX(-50%);width:130px;text-shadow:0 1px 2px #000}
    .eqslot.empty::after{content:attr(data-l);color:#5a564f;font:12px Georgia,serif;letter-spacing:.1em}
    .eqit.q-u .eqav{border-color:#c7864a;box-shadow:0 0 12px rgba(199,134,74,.75)}
    .eqslot.q-u{border-color:#a8692f;box-shadow:inset 0 0 0 2px #000,inset 0 0 22px rgba(199,134,74,.28)}
    .eqsum{margin-top:10px;padding:8px 12px;border:1px solid var(--line);border-radius:10px;font-size:12.5px;background:var(--bg)}.eqsum h4,.eqtool h4{margin:0 0 4px;font-size:12px;color:var(--mute);text-transform:uppercase;letter-spacing:.05em}.eqsum .mute{color:var(--mute)}
    .eqtool{margin:12px 0;font-size:13px}.eqtool .kc{display:flex;gap:6px;margin:5px 0}.eqtool select{flex:1;min-width:0;font:inherit;padding:4px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink)}.eqtool .msg{font-size:12px;color:var(--mute);min-height:16px}
    .pil li.clk{cursor:pointer;border-radius:6px;margin:0 -8px;padding-left:8px;padding-right:8px}.pil li.clk:hover{background:var(--bg)}
    #eqtip{position:fixed;z-index:95;pointer-events:none;background:rgba(10,10,9,.95);border:1px solid #56514a;border-radius:4px;padding:8px 12px;font-size:12.5px;line-height:1.4;color:#ecebe6;max-width:260px;text-align:center;box-shadow:0 4px 16px rgba(0,0,0,.6)}
    #eqtip .tn{font:700 14px Georgia,serif}#eqtip .ts{color:#9a9892}#eqtip .tg{color:#9a9892;margin-top:4px}#eqtip .tb{color:#8f9bff}
    .eqacc{margin:14px 0 12px;font-size:13px}.eqacc h4{margin:0 0 6px;font-size:13px;color:var(--mute);text-transform:uppercase;letter-spacing:.05em}.eqacc .warn,.accf .warn{font-size:12px;color:#e0764f}
    .acctabs{display:flex;gap:4px;margin:8px 0 4px}.acctabs button{flex:1;font-size:12px;padding:4px 6px;border-radius:8px}.acctabs button.on{background:var(--acc);border-color:var(--acc);color:#fff}
    .accf{display:flex;flex-direction:column;gap:6px;margin-top:6px;text-align:left}.accf input{font:inherit;font-size:14px;padding:6px 9px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);margin:0!important;width:auto!important;text-align:left!important}
    .accf .msg{font-size:12px;color:var(--mute);min-height:0;margin:0;text-align:left}.accf .msg:empty{display:none}.accf .pri,.eqmerge .pri{background:var(--acc);border-color:var(--acc);color:#fff}
    .accsm{font-size:11.5px;color:var(--mute);line-height:1.4}.accsm a,.accnudge a{color:var(--acc)}.accwhy{font-size:13px;line-height:1.4}
    .accdev{list-style:none;margin:8px 0;padding:0}.accdev li{display:flex;gap:6px;align-items:center;padding:4px 0;border-bottom:1px solid var(--line);font-size:12.5px}.accdev li span{flex:1;min-width:0}.accdev small{color:var(--mute)}.accdev button{font-size:11.5px;padding:2px 8px}
    .acclink{margin-top:8px;font-size:12px;color:var(--mute);line-height:1.4}.acclink a{color:var(--acc)}
    .accnudge{margin-top:8px;font-size:12.5px;line-height:1.45;background:rgba(127,127,127,.1);border-radius:8px;padding:7px 9px;text-align:left;color:var(--ink)}
    #over #pilAccF:not(:empty){margin-top:8px}
    .mrow{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0;padding-top:6px;border-top:1px solid var(--line)}.mrow .mslot{grid-column:1/-1;font-size:12px;color:var(--mute);text-transform:uppercase;letter-spacing:.05em}
    .mopt{display:flex;flex-direction:column;align-items:center;gap:3px;border:1px solid var(--line);border-radius:12px;padding:6px;cursor:pointer;background:var(--bg)}.mopt:has(input:checked){border-color:var(--acc);box-shadow:0 0 0 2px var(--acc)}.mopt .tag{font-size:10.5px;color:var(--mute)}.mopt .eqit{width:60px;height:60px}.mopt input{margin:0}
    .eqslot.q-n{border-color:#6d6a64}.eqslot.q-m{border-color:#4a5fb8;box-shadow:inset 0 0 0 2px #000,inset 0 0 22px rgba(80,110,255,.25)}.eqslot.q-r{border-color:#b89a2c;box-shadow:inset 0 0 0 2px #000,inset 0 0 22px rgba(242,210,75,.22)}`;
    document.head.appendChild(eqCss);
    const defs = document.createElement('div');
    defs.innerHTML = `<svg width="0" height="0" style="position:absolute"><defs>
      <symbol id="eq-helm" viewBox="0 0 78 78"><path d="M8 38 C8 12 70 12 70 38 L70 34 C64 30 14 30 8 34Z" fill="currentColor"/><path d="M6 36 C6 8 72 8 72 36 L64 36 C62 18 16 18 14 36Z" fill="currentColor"/><rect x="36" y="14" width="6" height="30" rx="2" fill="currentColor"/><path d="M14 36 C16 18 62 18 64 36" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="2"/></symbol>
      <symbol id="eq-armor" viewBox="0 0 78 78"><path d="M2 30 Q10 20 20 26 L20 40 Q8 42 2 30Z M76 30 Q68 20 58 26 L58 40 Q70 42 76 30Z" fill="currentColor"/><path d="M14 50 Q39 66 64 50 L62 76 L16 76Z" fill="currentColor"/><path d="M26 58 L39 72 L52 58" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="2"/></symbol>
      <symbol id="eq-gloves" viewBox="0 0 78 78"><g fill="currentColor"><path d="M0 44 q0-10 6-12 l1-10 q2-3 4 0 l1 8 1-10 q2-3 4 0 l0 10 1-8 q2-3 4 0 l0 12 q2 10-6 18 l-12 0z"/><path d="M78 44 q0-10-6-12 l-1-10 q-2-3-4 0 l-1 8-1-10 q-2-3-4 0 l0 10-1-8 q-2-3-4 0 l0 12 q-2 10 6 18 l12 0z"/></g></symbol>
      <symbol id="eq-boots" viewBox="0 0 78 78"><g fill="currentColor"><path d="M14 56 h14 v10 q0 4 4 5 l4 1 v5 h-24 q-2 0-2-3z"/><path d="M50 56 h14 v19 q0 3-2 3 h-24 v-5 l4-1 q4-1 4-5z"/></g><path d="M14 66 h14 M50 66 h14" stroke="#000" stroke-opacity=".35" stroke-width="2"/></symbol>
    </defs></svg>`;
    document.body.appendChild(defs.firstChild);
    // Przycisk pod kartą rankingu (karta rankingu pojawia się dopiero po pierwszej grze, przycisk jest zawsze)
    const eqCard = document.createElement('div'); eqCard.className = 'card';
    eqCard.innerHTML = `<div style="display:flex;gap:8px;flex-wrap:wrap"><button id="eqBtn" style="flex:1 1 140px">Ekwipunek</button>${KONTA ? '<button id="accBtn" style="flex:1 1 140px"></button>' : ''}</div>`;
    card.after(eqCard);
    eqCard.querySelector('#eqBtn').onclick = openInv;
    if (KONTA) { // konto widoczne od razu (nie tylko w Ekwipunku): gość — logowanie/rejestracja, zalogowany — nick
      const ab = eqCard.querySelector('#accBtn');
      accBtnDraw = () => { ab.textContent = tok() ? `🔒 ${accNick()}` : '🔒 Zaloguj się / załóż konto'; ab.title = tok() ? 'Konto: urządzenia, hasło, wylogowanie' : 'Nick chroniony hasłem i ten sam ekwipunek na każdym urządzeniu'; };
      ab.onclick = () => openInv({ konto: tok() ? 'acc' : 'reg' });
      accBtnDraw();
    }
    const tip = document.createElement('div'); tip.id = 'eqtip'; tip.hidden = true; document.body.appendChild(tip);
    let tipFor = null;
    const hideTip = () => { tip.hidden = true; tipFor = null; };
    const showTip = (el) => {
      const it = ITEMS[el.dataset.tid]; if (!it) return;
      tip.innerHTML = tipHtml(it); tip.hidden = false; tipFor = el;
      const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
      let x = r.right + 8; if (x + w > innerWidth - 6) x = r.left - w - 8; if (x < 6) x = Math.max(6, Math.min(innerWidth - w - 6, r.left + r.width / 2 - w / 2));
      tip.style.left = x + 'px'; tip.style.top = Math.max(6, Math.min(innerHeight - h - 6, r.top)) + 'px';
    };
    const tidEl = (e) => e.target.closest?.('[data-tid]');
    if (!TOUCH) { // komputer: najechanie; telefon: dotknięcie pokazuje/ukrywa
      document.addEventListener('mouseover', (e) => { const el = tidEl(e); if (el) showTip(el); else if (!tip.hidden) hideTip(); });
    } else {
      document.addEventListener('click', (e) => { const el = tidEl(e); if (el && el !== tipFor) showTip(el); else hideTip(); }, true);
    }
    document.getElementById('pil')?.addEventListener('click', (e) => { const li = e.target.closest('li[data-eq]'); if (li) openView(li.dataset.eq, li.dataset.nick, li.dataset.dev); });
    // bonusy z założonych przedmiotów od razu po wejściu na stronę (ponawiane przy błędzie)
    const loadInv = (n = 0) => eqPost('/inv', eqAuth()).then((r) => {
      if (KONTA && r.status === 403 && r.j?.konto !== undefined && !tok()) { ls.set('eqOwned', r.j.konto); ls.del('eqKey'); return loadInv(n); } // klucz przypięty do konta (np. kod przenoszenia sprzed rejestracji)
      if (KONTA && r.status === 401 && !tok()) return loadInv(n); // sesja usunięta z innego urządzenia — dalej jako gość
      if (!r.ok) throw 0;
      if (KONTA && tok()) { if (r.j.acc?.nick) ls.set('pilAcc', r.j.acc.nick); checkMerge(); }
    }).catch(() => {
      if (n < 4) setTimeout(() => loadInv(n + 1), 4000);
      else { eqFailed = true; if (game?.bWait) { game.bWait = false; drawHud(); flash('Nie udało się wczytać przedmiotów — ta gra bez nich', 2500); } }
    });
    loadInv();
  }

  // --- pętla ---
  let last = performance.now(), acc = 0;
  function loop(t) {
    const dt = Math.min(.05, (t - last) / 1000); last = t; if (game) game.sim += dt * 1000;
    acc += dt; if (acc > 1.75) { acc = 0; spawn(); } // o 25% częściej niż dawniej (2.2 s)
    for (const f of flakes) {
      if (game && game.f === f) {
        // test: prędkość po „Szybciej!” rośnie płynnie (~0.5 s) zamiast skokiem w trakcie lotu — skok wyglądał jak szarpnięcie
        const spd = speedOf(game.lvl, game.B.wytrw); game.spd = SUFIT && game.spd ? game.spd + (spd - game.spd) * Math.min(1, dt * 6) : spd;
        const wk = game.warm ? Math.min(1, (t - game.warm) / 2000) : 1; if (wk >= 1) game.warm = 0;
        const sd = dt * game.spd * (game.slow > t ? .45 : 1) * (.4 + .6 * wk * wk * (3 - 2 * wk)); // rozpędzanie 40% → 100% (płynnie) // po odbiciu od dołu chwilowe spowolnienie
        // test: po odbiciu od dołu piłeczka zatrzymuje się na szczycie i czeka na kliknięcie (chwila przerwy); po 1.5 s dymek :mellow:
        if (game.rise) { const p = Math.min(1, (t - game.rise.t0) / 3000); f.y = game.rise.y0 - game.rise.dy * (1 - (1 - p) ** 3); f.rot += f.vr * dt * (1 - p); // wznoszenie coraz wolniej (ease-out); obrót swobodny, wygasa razem z lotem
          if (p >= 1) { game.rise = null; game.hover = t; f.vx = 0; f.vy = 0; f.vr = 0; game.rot0 = f.rot; game.rotTo = Math.round(f.rot / 360) * 360; } }
        // w bezruchu przez 1.5 s piłeczka płynnie obraca się do pionu, potem dymek :mellow:
        if (game.hover) { const k = Math.min(1, (t - game.hover) / 1500), e = k < .5 ? 2 * k * k : 1 - (2 - 2 * k) ** 2 / 2; f.rot = game.rot0 + (game.rotTo - game.rot0) * e; }
        if (game.hover || game.rise) { if (game.hover && !game.bubble && t - game.hover > 1500) { game.bubble = document.createElement('div'); game.bubble.className = 'mellow'; game.bubble.innerHTML = '<img src="' + MELLOW + '" alt=":mellow:">'; f.el.appendChild(game.bubble); } }
        else { f.vy += G * (1 - game.B.ciezki) * game.k * sd; f.x += f.vx * sd; f.y += f.vy * sd; f.rot += f.vr * sd; }
        const A = TOUCH ? { l: 0, r: W } : arena();
        // mocne odbicie od boków i sufitu (z minimalną prędkością), żeby nie dało się trzymać piłeczki w rogu
        if (f.x < A.l) { f.x = A.l; f.vx = Math.max(Math.abs(f.vx), 180 * game.k); }
        if (f.x > A.r - f.size) { f.x = A.r - f.size; f.vx = -Math.max(Math.abs(f.vx), 180 * game.k); }
        // brak sufitu: za mocno podbita piłeczka wylatuje nad ekran (nie da się jej wtedy kliknąć) — wskaźnik pokazuje, jak wysoko jest
        if (SUFIT) { const above = Math.round(-(f.y + f.size)); if (above > 0) { nadEl.hidden = false; nadEl.style.left = (f.x + f.size / 2) + 'px'; nadEl.textContent = `↑ ${above} px`; } else nadEl.hidden = true; }
        if (f.y < 0 && !SUFIT) { f.y = 0; f.vy = Math.max(Math.abs(f.vy) * .8, 260 * game.k); }
        // Kapcie: 🔨 w HUD świeci, gdy pudło liczy się jako podbicie
        if (game.bans) { const a = kapArmed(game); if (a !== !!game.armed) { game.armed = a; hud.querySelector('.kap')?.classList.toggle('arm', a); } }
        if (!TOUCH && (H < MIN_H || W < H * ASPECT)) { game.small = true; endGame(); break; } // okno zmniejszone w trakcie: normalny koniec gry z zapisem wyniku
        if (f.y > H + 10) {
          if (game.saves > 0) { game.saves--; f.y = H - f.size - H * (SUFIT ? .08 : 0); // odbicie startuje nad dolną krawędzią (strefa gestów telefonu)
             f.vx = 0; f.vy = -Math.sqrt(2 * G * (1 - game.B.ciezki) * game.k * H * .55); if (SUFIT) { game.rise = { t0: t, y0: f.y, dy: H * .55 }; f.vy = 0; } else game.slow = t + 1600; // test: wznoszenie przez 3 s coraz wolniej, potem zawis; kliknięcie w trakcie = normalne podbicie // wysoko, prosto w górę i wolniej — łatwo kliknąć
            flash(`🛡 Odbicie od dołu! Zostało: ${game.saves}`); saveFx(); drawHud(); }
          else { endGame(); break; }
        }
      } else {
        f.ph += dt; f.y += f.vy * dt; f.rot += f.vr * dt;
        if (f.y > H + 20) { f.el.remove(); flakes.delete(f); continue; }
      }
      const sx = game && game.f === f ? 0 : Math.sin(f.ph) * f.sway;
      f.el.style.transform = `translate(${f.x + sx}px,${f.y}px) rotate(${f.rot}deg)`;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
