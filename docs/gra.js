// Spadające awatary + gra w podbijanie awatara. Ranking wspólny (funkcja w Google Cloud).
(() => {
  const API = 'https://pileczka-i3odn44x6q-ue.a.run.app';
  const COLORS = ['#e0a526', '#5b8def', '#d9667a', '#4fb286', '#9b5de5', '#e07a3f'];
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const css = document.createElement('style');
  css.textContent = `
  #snow{position:fixed;inset:0;pointer-events:none;z-index:40;overflow:hidden}
  .flake{position:absolute;top:0;left:0;border-radius:50%;background:var(--card) center/cover no-repeat;border:2px solid;display:grid;place-items:center;font-weight:700;color:var(--ink);pointer-events:auto;cursor:pointer;user-select:none;opacity:.85;will-change:transform;box-shadow:0 2px 8px rgba(0,0,0,.2)}
  .flake:hover{opacity:1}
  .flake.ball{opacity:1;z-index:2;box-shadow:0 8px 20px rgba(0,0,0,.35)}
  #hud{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:60;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:6px 18px;font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;box-shadow:0 6px 18px rgba(0,0,0,.25);pointer-events:none}
  #hud small{font-size:12px;font-weight:500;color:var(--mute);margin-left:6px}
  #over{position:fixed;inset:0;z-index:70;display:grid;place-items:center;background:rgba(0,0,0,.45)}
  #over .box{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;width:min(320px,calc(100vw - 32px));text-align:center}
  #over h3{margin:0 0 4px;font-size:18px}#over .sc{font-size:44px;font-weight:800;margin:4px 0 12px}
  #over .ball{width:80px;height:80px;border-radius:50%;border:3px solid;margin:6px auto 6px;background:var(--card) center/cover no-repeat;display:grid;place-items:center;font-size:32px;font-weight:800}
  #over .who{font-weight:700;font-size:16px}
  #over .txt{color:var(--mute);font-size:14px;margin-top:2px}
  #over .sc small{font-size:16px;color:var(--mute);font-weight:600}
  #over input{width:100%;margin-bottom:10px;text-align:center}
  #over .row{display:flex;gap:8px;justify-content:center}
  #over button.pri{background:var(--acc);border-color:var(--acc);color:#fff}
  #over .msg{font-size:12px;color:var(--mute);min-height:16px;margin-top:8px}
  #mult{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:39;pointer-events:none;font-weight:900;font-size:min(28vw,260px);line-height:1;opacity:0;transition:opacity .4s,color .6s;font-variant-numeric:tabular-nums;letter-spacing:-.04em}
  #mult.on{opacity:.13}
  #mult.pulse{animation:mpulse .9s ease-out}
  @keyframes mpulse{0%{opacity:.13;transform:translate(-50%,-50%) scale(1)}25%{opacity:.4;transform:translate(-50%,-50%) scale(1.12)}100%{opacity:.13;transform:translate(-50%,-50%) scale(1)}}
  #edge{position:fixed;inset:0;z-index:38;pointer-events:none;opacity:0;transition:opacity .6s;box-shadow:inset 0 0 120px 20px rgba(255,90,20,.55)}
  #lvlup{position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:60;font-weight:800;font-size:20px;color:#ff7a1a;text-shadow:0 0 10px rgba(255,120,30,.6);opacity:0;pointer-events:none}
  #lvlup.go{animation:lvl 1.1s ease-out}
  @keyframes lvl{0%{opacity:0;transform:translate(-50%,10px) scale(.8)}20%{opacity:1;transform:translate(-50%,0) scale(1.1)}100%{opacity:0;transform:translate(-50%,-18px) scale(1)}}
  #snowBtn{position:fixed;left:12px;bottom:12px;z-index:45;font-size:12px;padding:4px 10px;opacity:.75}
  body.playing{user-select:none;-webkit-user-select:none}
  body.playing .wrap{pointer-events:none}
  .pil li{list-style:none;display:flex;gap:8px;padding:5px 0;border-bottom:1px solid var(--line);font-size:14px}
  .pil li:last-child{border:0}.pil{margin:0;padding:0}.pil .me{color:var(--acc);font-weight:700}`;
  document.head.appendChild(css);

  const snow = document.createElement('div'); snow.id = 'snow'; document.body.appendChild(snow);
  const btn = document.createElement('button'); btn.id = 'snowBtn'; document.body.appendChild(btn);
  let on = ls.get('snieg') !== '0' && !reduce;
  const setBtn = () => { btn.textContent = on ? '❄ wyłącz awatary' : '❄ włącz awatary'; };
  btn.onclick = () => { on = !on; ls.set('snieg', on ? '1' : '0'); setBtn(); if (!on && !game) clearFlakes(); };
  setBtn();

  // Karta rankingu pod galerią sław: widoczna dopiero dla kogoś, kto już zagrał
  const fameCard = document.getElementById('fame')?.closest('.card');
  const card = document.createElement('div'); card.className = 'card'; card.hidden = true;
  card.innerHTML = '<h3>Piłeczka · ranking</h3><ul class="pil" id="pil"><li class="empty">Ładowanie…</li></ul>';
  fameCard?.after(card);
  function showRank(top) {
    card.hidden = false;
    const me = (ls.get('pilNick') || '').toLowerCase();
    document.getElementById('pil').innerHTML = top.length ? top.map((r, i) => `<li class="${r.nick.toLowerCase() === me ? 'me' : ''}"><span style="width:22px;color:var(--mute)">${i + 1}.</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.nick)}</span><b>${r.score}</b></li>`).join('') : '<li class="empty">Jeszcze nikt nie zagrał.</li>';
  }
  const loadRank = (n = 0) => fetch(API).then((r) => { if (!r.ok) throw 0; return r.json(); }).then((j) => showRank(j.top || []))
    .catch(() => { card.hidden = false; document.getElementById('pil').innerHTML = '<li class="empty">Ranking chwilowo niedostępny, ponawiam…</li>'; if (n < 5) setTimeout(() => loadRank(n + 1), 15000); });
  if (ls.get('pilGral')) loadRank();

  // --- płatki ---
  const flakes = new Set();
  let game = null, W = innerWidth, H = innerHeight;
  addEventListener('resize', () => { W = innerWidth; H = innerHeight; });
  const pickUser = () => {
    const withAv = Object.keys(D.avatars || {}).filter((u) => D.users[u]);
    const pool = withAv.length ? withAv : Object.keys(D.users || {});
    return pool[Math.floor(Math.random() * pool.length)];
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
    if (!on || game || document.hidden || flakes.size >= 7 || !D?.users) return;
    const u = pickUser(); if (!u) return;
    const size = Math.round(80 * scaleK());
    const f = { u, size, x: Math.random() * (W - size), y: -size - 10, vy: (28 + Math.random() * 30) * scaleK(), sway: 20 + Math.random() * 30, ph: Math.random() * 6.28, rot: 0, vr: (Math.random() - .5) * 40 };
    f.el = makeEl(u, size);
    f.el.addEventListener('pointerdown', (e) => { e.preventDefault(); game ? hit(f, e) : startGame(f, e); });
    flakes.add(f);
  }
  const clearFlakes = () => { for (const f of flakes) f.el.remove(); flakes.clear(); };

  // --- gra ---
  // Co 8 podbić poziom w górę: awatar leci szybciej (cały ruch przyspiesza), a mnożnik punktów rośnie o 0,1
  // Rozmiar i fizyka liczone względem wielkości okna — przybliżenie strony (Ctrl +) nie ułatwia gry
  const scaleK = () => Math.max(.3, Math.min(innerWidth, innerHeight) / 950);
  const G = 1500, JUMP = 720, PER_LEVEL = 8;
  const speedOf = (lvl) => 1 + lvl * 0.07, multOf = (lvl) => Math.round((1 + lvl * 0.1) * 10) / 10;
  const hud = document.createElement('div'); hud.id = 'hud'; hud.hidden = true; document.body.appendChild(hud);
  const multEl = document.createElement('div'); multEl.id = 'mult'; document.body.appendChild(multEl);
  const edgeEl = document.createElement('div'); edgeEl.id = 'edge'; document.body.appendChild(edgeEl);
  // Duży, półprzezroczysty mnożnik w tle + poświata na brzegach ekranu rosnąca z poziomem
  function showMult(lvl, pulse) {
    const m = multOf(lvl), heat = Math.min(1, lvl / 10);
    multEl.textContent = 'x' + m.toFixed(1);
    multEl.style.color = `hsl(${45 - heat * 45}, 95%, ${60 - heat * 10}%)`;
    multEl.classList.add('on'); edgeEl.style.opacity = String(heat * .9);
    if (pulse) { multEl.classList.remove('pulse'); void multEl.offsetWidth; multEl.classList.add('pulse'); }
  }
  const hideMult = () => { multEl.classList.remove('on', 'pulse'); edgeEl.style.opacity = '0'; };
  const flashEl = document.createElement('div'); flashEl.id = 'lvlup'; document.body.appendChild(flashEl);
  function flash(t) { flashEl.textContent = t; flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go'); }
  function startGame(f, e) {
    for (const o of flakes) if (o !== f) o.el.remove();
    flakes.clear(); flakes.add(f);
    game = { f, score: 0, hits: 0, lvl: 0, k: scaleK() }; f.el.classList.add('ball'); showMult(0, false);
    document.body.classList.add('playing'); getSelection()?.removeAllRanges(); const pie = document.getElementById('pie'); if (pie) pie.hidden = true; f.vx = 0; f.vy = 0;
    hit(f, e);
  }
  function hit(f, e) {
    if (!game || game.f !== f) return;
    game.hits++;
    const up = game.hits % PER_LEVEL === 0 && game.hits > 0;
    game.score += multOf(game.lvl);
    if (up) { game.lvl++; flash(`Szybciej! x${multOf(game.lvl).toFixed(1)}`); showMult(game.lvl, true); }
    const r = f.el.getBoundingClientRect(), off = ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) || 0;
    f.vy = -JUMP * game.k;
    f.vx = Math.max(-420, Math.min(420, -off * 320 + (Math.random() - .5) * 120)) * game.k;
    f.vr = -off * 360;
    hud.hidden = false; hud.innerHTML = `${Math.round(game.score)}<small>pkt · x${multOf(game.lvl).toFixed(1)} · ${game.hits} podbić</small>`;
  }
  function endGame() {
    const score = Math.round(game.score), f = game.f, gHits = game.hits; game = null; document.body.classList.remove('playing'); hideMult();
    f.el.remove(); flakes.clear(); hud.hidden = true;
    const ov = document.createElement('div'); ov.id = 'over';
    const av = D.avatars?.[f.u], who = D.users[f.u] || '?', hits = gHits;
    ov.innerHTML = `<div class="box"><h3>Koniec gry!</h3>
      <div class="ball" style="border-color:${f.el.style.borderColor};${av ? `background-image:url('${esc(av)}')` : ''}">${av ? '' : esc(who[0].toUpperCase())}</div>
      <div class="who">${esc(who)}</div>
      <div class="txt">Podrzuciłeś ${esc(who)} <b>${hits}</b> ${hits === 1 ? 'raz' : 'razy'}</div>
      <div class="sc">${score}<small> pkt</small></div>
      <input id="pilNick" maxlength="20" placeholder="Twój nick" value="${esc(ls.get('pilNick') || '')}">
      <div class="row"><button class="pri" id="pilSave">Zapisz wynik</button><button id="pilClose">Zamknij</button></div><div class="msg" id="pilMsg"></div></div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelector('#pilClose').onclick = close;
    const save = () => {
      const nick = ov.querySelector('#pilNick').value.trim();
      if (!nick) { ov.querySelector('#pilMsg').textContent = 'Wpisz nick.'; return; }
      ls.set('pilNick', nick); ls.set('pilGral', '1');
      ov.querySelector('#pilMsg').textContent = 'Zapisuję…';
      fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nick, score }) })
        .then((r) => r.json()).then((j) => { if (j.top) { showRank(j.top); close(); card.scrollIntoView({ behavior: 'smooth', block: 'center' }); } else ov.querySelector('#pilMsg').textContent = j.error || 'Błąd zapisu.'; })
        .catch(() => { ov.querySelector('#pilMsg').textContent = 'Nie udało się zapisać, spróbuj jeszcze raz.'; });
    };
    ov.querySelector('#pilSave').onclick = save;
    ov.querySelector('#pilNick').addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    setTimeout(() => ov.querySelector('#pilNick').focus(), 50);
  }

  // --- pętla ---
  let last = performance.now(), acc = 0;
  function loop(t) {
    const dt = Math.min(.05, (t - last) / 1000); last = t;
    acc += dt; if (acc > 2.2) { acc = 0; spawn(); }
    for (const f of flakes) {
      if (game && game.f === f) {
        const sd = dt * speedOf(game.lvl);
        f.vy += G * game.k * sd; f.x += f.vx * sd; f.y += f.vy * sd; f.rot += f.vr * sd;
        if (f.x < 0) { f.x = 0; f.vx = Math.abs(f.vx) * .8; }
        if (f.x > W - f.size) { f.x = W - f.size; f.vx = -Math.abs(f.vx) * .8; }
        if (f.y < 0) { f.y = 0; f.vy = Math.abs(f.vy) * .3; }
        if (f.y > H + 10) { endGame(); break; }
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
