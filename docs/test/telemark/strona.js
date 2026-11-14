// Telemark na stronie licznika d2jsp (telemark/docs/zasady_d2jsp.md „Strona licznika”, wygląd: makieta C
// telemark/proto/strona-mistrzowie/makieta-c.html): karta w lewej kolumnie z przyciskiem gry, mistrzami roku, miesiąca
// i tygodnia (puchary strony #cupY, #cupM, #cup), wyścigami trwających okresów i miejscem zalogowanego. Gra w dużym oknie
// na wierzchu strony (jak okno nagrań Lotnika); ▶ odtwarza najlepszy skok osoby w okresie (?ogladaj=gid), klik w nick
// otwiera w grze ekran „Skoki gracza” (?gracz=uid&okres=klucz). Tytuły do galerii sław: window.tmFame + drawFame strony.
// Dane: /tm/tabele serwera Lotnika (lotnik/serwer/telemark.js). Kopiowane do docs[/test]/telemark/ przez scripts/d2jsp-publikuj.sh.
(function () {
  const SLOT = document.getElementById("telemark");
  if (!SLOT) return;
  const PROD = location.hostname === "kruszkush.github.io" && !location.pathname.includes("/test/");
  const API = "https://us-east1-rich-chimera-344319.cloudfunctions.net/" + (PROD ? "lotnik" : "lotnik-test");
  const GAME = new URL("telemark/index.html", document.baseURI).href;
  const DEMO = !PROD && new URLSearchParams(location.search).has("tmdemo"); // podgląd z przykładowymi danymi (porównanie z makietą)
  const ODSWIEZ_MS = 60000;
  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const pts = (p) => p.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: "always" });
  const whole = (p) => Math.round(p).toLocaleString("pl-PL", { useGrouping: "always" });
  const store = (k) => {
    try {
      return localStorage.getItem(k) || "";
    } catch (e) {
      return "";
    }
  };
  const haslo = () => store("lotnik.haslo");

  const css = document.createElement("style");
  css.textContent = `
#telemark{border-color:#c9a27e}
@media (prefers-color-scheme:dark){#telemark{border-color:#4a3a2c}}
#telemark .tm-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}
#telemark .tm-play{background:var(--acc);color:#fff;border-color:var(--acc);font-weight:600}
#telemark .tm-rules{color:var(--mute);font-size:12px;flex:1 1 240px}
#telemark .tm-cols,#telemark .tm-races{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
#telemark .tm-races{margin-top:10px}
@media (max-width:760px){#telemark .tm-cols,#telemark .tm-races{grid-template-columns:minmax(0,1fr)}}
#telemark .tmc{border-radius:10px;padding:10px 12px;border:1px solid var(--line);background:linear-gradient(170deg,var(--tint) 0%,transparent 75%);text-align:center;min-width:0}
#telemark .tmc.ky,#telemark .tmr.ky{--c:#3fb0d8;--tint:rgba(63,176,216,.18)}
#telemark .tmc.km,#telemark .tmr.km{--c:#9b5de5;--tint:rgba(155,93,229,.2)}
#telemark .tmc.kw,#telemark .tmr.kw{--c:var(--gold);--tint:rgba(201,150,26,.2)}
#telemark .tmc.ky .lab{color:#3fb0d8}#telemark .tmc.km .lab{color:#a46ff0}#telemark .tmc.kw .lab{color:var(--gold)}
#telemark .tmc .big{width:44px;height:44px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.4))}
#telemark .tmc .lab{font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:700}
#telemark .tmc .per{font-size:11px;color:var(--mute)}
#telemark .tmc .who{display:flex;align-items:center;justify-content:center;gap:2px;margin:4px 0 0;font-weight:700;font-size:17px;flex-wrap:wrap}
#telemark .tmc .none{font-style:italic;color:var(--mute);margin:4px 0 0}
#telemark .tmc .pts{font-size:11px;color:var(--mute)}
#telemark .tmc ol{margin:8px 0 0;padding:6px 0 0;border-top:1px dashed var(--line);list-style:none;font-size:12px;text-align:left}
#telemark .tmc ol .h{color:var(--mute);font-size:11px;margin-bottom:2px;display:block}
#telemark .tmc li{display:flex;align-items:center;gap:4px;line-height:1.5;margin-top:4px}
/* Odstęp wierszy jak „Wyniki końcowe” w kartach mistrzów postów (Mateusz 14.11: „wszystko nawalone”). */
#telemark .tmc li .ln{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#telemark .tmc li .lv{color:var(--mute);font-variant-numeric:tabular-nums;min-width:4.6em;text-align:right;margin-left:4px}
#telemark .rav{border:2px solid var(--c);width:22px;height:22px;margin-right:5px}
#telemark .tmc li .rav,#telemark .tmr .rav{width:18px;height:18px;border-width:1px;font-size:10px;margin-right:4px}
#telemark .nk{background:none;border:0;padding:0;color:inherit;font:inherit;font-weight:inherit;cursor:pointer;text-align:left}
#telemark .nk:hover{color:var(--acc);text-decoration:underline}
/* ▶ w wierszach (Mateusz 14.11): zawsze w tym samym miejscu za punktami, szary jak punkty, pomarańczowy po najechaniu;
   przy mistrzu „▶ najlepszy skok” w kolorze strony jak na makiecie C. */
#telemark .pl{background:none;border:0;padding:0;color:var(--mute);font-size:10px;line-height:1;cursor:pointer;width:1.8em;flex:none;text-align:right}
#telemark .pl:not([disabled]):hover{color:var(--acc)}
#telemark .pl[disabled]{opacity:.35;cursor:default}
#telemark .pl.t{font-size:11px;color:var(--acc);width:auto;padding:0 2px}
#telemark .pl-e{width:1.8em;flex:none}
#telemark .tmr{border:1px solid var(--line);border-radius:10px;padding:8px 12px;min-width:0}
#telemark .tmr h4{margin:0 0 4px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);font-weight:700}
#telemark .tmr ul{margin:0;padding:0}
#telemark .tmr li{list-style:none;display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--line);font-size:13px}
#telemark .tmr li:last-child{border:0}
#telemark .tmr .pos{width:20px;height:20px;font-size:11px}
#telemark .tmr .track i{background:var(--c)}
#telemark .tmr .v{font-size:12px;color:var(--mute);font-variant-numeric:tabular-nums}
#telemark .tmr .end{font-size:11px;color:var(--mute);margin-top:4px}
#telemark .tmr .empty{font-size:12px;padding:4px 0;border:0}
#telemark .tm-demo{font-size:12px;color:var(--acc);margin:0 0 8px}
.tm-okno{position:fixed;inset:0;z-index:97;background:#020617;display:flex;align-items:center;justify-content:center}
.tm-okno[hidden]{display:none!important}
.tm-okno .tm-box{position:relative;width:min(97vw,2200px);height:min(calc(100vh - 56px),1300px);margin-top:44px;background:#000;border-radius:10px;overflow:hidden}
.tm-okno iframe{width:100%;height:100%;border:0;display:block}
/* Krzyżyk na pasku nad grą, nie na niej: w rogu gry leży wskaźnik wiatru. */
.tm-okno .tm-x{position:fixed;top:6px;right:max(8px,calc((100vw - min(97vw,2200px)) / 2));z-index:2;background:rgba(15,23,42,.85);color:#e2e8f0;border:1px solid rgba(248,250,252,.35);font-size:16px;line-height:1;padding:6px 11px}
body.tm-on>:not(.tm-okno){visibility:hidden!important}
body.tm-on *,body.tm-on ::before,body.tm-on ::after{animation-play-state:paused!important}
@media (max-width:760px),(max-height:500px){.tm-okno{align-items:flex-end}.tm-okno .tm-box{width:100vw;height:calc(100% - 38px);margin:0;border-radius:0}.tm-okno .tm-x{right:6px}}
`;
  document.head.appendChild(css);

  // --- okno gry -----------------------------------------------------------------------------------------------
  let okno = null,
    frame = null,
    last = null;
  function open(query) {
    if (!okno) {
      okno = document.createElement("div");
      okno.className = "tm-okno";
      okno.hidden = true;
      okno.innerHTML =
        '<div class="tm-box"><iframe title="Telemark" allow="fullscreen; gamepad"></iframe>' +
        '<button type="button" class="tm-x" aria-label="Zamknij Telemark">✕</button></div>';
      frame = okno.querySelector("iframe");
      okno.querySelector(".tm-x").addEventListener("click", close);
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && okno && !okno.hidden && document.activeElement !== frame) close();
      });
      document.body.appendChild(okno);
    }
    last = document.activeElement;
    frame.src = GAME + (query || "");
    okno.hidden = false;
    document.body.classList.add("tm-on");
    frame.focus();
  }
  function close() {
    if (!okno || okno.hidden) return;
    okno.hidden = true;
    frame.src = "about:blank";
    document.body.classList.remove("tm-on");
    if (last && last.focus) last.focus();
    load(true);
  }

  // --- okresy: nazwy i daty (tydzień ISO pn–nd, dzień w czasie polskim) ---------------------------------------
  const MIES = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
  const plus = (day, n) => new Date(Date.parse(day + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);
  const dow = (day) => new Date(day + "T12:00:00Z").getUTCDay() || 7;
  const mondayOf = (day) => plus(day, 1 - dow(day));
  function isoMonday(key) {
    const [, y, w] = /^w(\d{4})-(\d{2})$/.exec(key);
    const jan4 = y + "-01-04";
    return plus(mondayOf(jan4), 7 * (+w - 1));
  }
  // „Listopad · tydzień 3”: jak tygodnie postów na stronie (weekNice): miesiąc czwartku, tydzień 1 = ten z 1. dniem miesiąca.
  function weekName(key) {
    const mon = isoMonday(key),
      thu = plus(mon, 3);
    const n = Math.round((Date.parse(mon) - Date.parse(mondayOf(thu.slice(0, 8) + "01"))) / (7 * 864e5)) + 1;
    return `${MIES[+thu.slice(5, 7) - 1]} · tydzień ${n}`;
  }
  const name = (key) =>
    key[0] === "y" ? key.slice(1) : key[0] === "m" ? `${MIES[+key.slice(6, 8) - 1]} ${key.slice(1, 5)}` : weekName(key);
  const dm = (day) => `${+day.slice(8, 10)}.${day.slice(5, 7)}`;
  function left(ts) {
    const s = Math.max(0, ts - Date.now() / 1000),
      d = Math.floor(s / 86400),
      h = Math.floor((s % 86400) / 3600);
    return d >= 3 ? `${d} d` : `${d ? d + " d " : ""}${h} h`;
  }
  const WD = ["", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota", "niedziela"];
  const endText = (o) =>
    `Koniec: ${o.k === "w" ? WD[dow(o.koniec)] + " 24:00" : dm(o.koniec)} (za ${left(o.koniecTs)})`;

  // --- osoby: awatar, nick (otwiera „Skoki gracza”), ▶ najlepszego skoku -------------------------------------
  const avatars = () => {
    try {
      return (typeof D !== "undefined" && D && D.avatars) || {};
    } catch {
      return {};
    }
  };
  window.tmAvatars = avatars; // dla gry w oknie (src/d2jsp/week-table.tsx czyta parent.tmAvatars)
  const av = (r) => {
    const url = r.uid ? avatars()[r.uid] : "";
    return url
      ? `<span class="rav" style="background-image:url('${esc(url).replace(/['\\]/g, "")}')"></span>`
      : `<span class="rav">${esc(String(r.nick || "?").charAt(0).toUpperCase())}</span>`;
  };
  let today = "";
  const nickBtn = (r, key) =>
    r.uid
      ? `<button type="button" class="nk" data-uid="${esc(r.uid)}" data-okres="${esc(key)}" title="Skoki gracza ${esc(r.nick)}">${esc(r.nick)}</button>`
      : esc(r.nick);
  const play = (r, text) => {
    const b = r.best;
    if (!b) return text ? "" : '<span class="pl-e"></span>';
    const later = b.day >= today;
    const tip = later
      ? "Dzisiejsze skoki można obejrzeć od jutra"
      : `Najlepszy skok: ${String(b.m).replace(".", ",")} m, ${pts(b.p)} pkt`;
    return `<button type="button" class="pl${text ? " t" : ""}" data-gid="${esc(b.gid)}"${later ? " disabled" : ""} title="${tip}" aria-label="Obejrzyj najlepszy skok ${esc(r.nick)}">▶${text ? " " + text : ""}</button>`;
  };
  const li = (r, i, key) =>
    `<li><span class="ln">${i + 1}. ${nickBtn(r, key)}</span><span class="lv">${pts(r.suma)}</span>${play(r)}</li>`;

  // --- karta mistrza: zwycięzca poprzedniego okresu, a bez niego „jeszcze nieznany” i kto na czele -----------
  const CUP = { y: "cupY", m: "cupM", w: "cup" };
  const LAB = { y: "Mistrz roku", m: "Mistrz miesiąca", w: "Mistrz tygodnia" };
  function champ(o) {
    const prev = (o.prev && o.prev.podium) || [];
    const win = prev.filter((r) => r.place === 1 && r.suma > 0);
    const head = (key) =>
      `<svg class="big"><use href="#${CUP[o.k]}"/></svg><div class="lab">${LAB[o.k]}${o.k === "y" ? " " + key.slice(1) : ""}</div>`;
    if (win.length) {
      const per = o.k === "y" ? "" : `<div class="per">${esc(name(o.prev.key))}</div>`;
      return (
        head(o.prev.key) +
        per +
        `<div class="who">${win.map((r) => av(r) + nickBtn(r, o.prev.key)).join(" i ")}</div>` +
        `<div class="pts">${pts(win[0].suma)} pkt · ${play(win[0], "najlepszy skok")}${o.prev.zamkniety ? "" : " · puchar po 0:15"}</div>` +
        `<ol><li class="h">wyniki końcowe</li>${prev.slice(0, 5).map((r, i) => li(r, r.place - 1, o.prev.key)).join("")}</ol>`
      );
    }
    const per = o.k === "y" ? `przyznanie ${dm(o.koniec)}` : `${name(o.key)} · przyznanie ${dm(o.koniec)}`;
    return (
      head(o.key) +
      `<div class="per">${esc(per)}</div><div class="none">jeszcze nieznany</div>` +
      (o.rows.length
        ? `<ol><li class="h">na czele</li>${o.rows.slice(0, 5).map((r, i) => li(r, r.place - 1, o.key)).join("")}</ol>`
        : "")
    );
  }
  const RACE = { y: (k) => "rok " + k.slice(1), m: (k) => MIES[+k.slice(6, 8) - 1], w: (k) => weekName(k).replace(" · ", ", ") };
  function race(o) {
    const lead = (o.rows[0] && o.rows[0].suma) || 1;
    const rows = o.rows
      .slice(0, 3)
      .map(
        (r, i) =>
          `<li><span class="pos ${r.place <= 3 ? "p" + r.place : ""}">${r.place}</span><div class="grow"><div class="nm">${nickBtn(r, o.key)}</div>` +
          `<div class="track"><i style="width:${(r.suma / lead) * 100}%"></i></div></div><span class="v">${whole(r.suma)}</span>${play(r)}</li>`,
      )
      .join("");
    return (
      `<h4>Wyścig · ${esc(RACE[o.k](o.key))}</h4><ul>${rows || '<li class="empty">Jeszcze nikt nie skakał.</li>'}</ul>` +
      `<div class="end">${endText(o)}</div>`
    );
  }
  SLOT.className = "card";
  SLOT.innerHTML =
    // Bez nagłówka „Telemark: Skocznie dnia” (Mateusz 14.11: „nie wiadomo, o co chodzi”); przycisk mówi, co robi.
    '<div class="tm-head"><button type="button" class="tm-play">Telemark – zagraj</button>' +
    '<span class="tm-rules">3 nowe skocznie codziennie o północy, ten sam wiatr dla wszystkich. Tydzień: 5 najlepszych dni, miesiąc: 20, rok: 200. ▶ odtwarza najlepszy skok (dzisiejsze od jutra), nick pokazuje wszystkie skoki.</span></div>' +
    (DEMO ? '<p class="tm-demo">Podgląd z przykładowymi danymi (adres z ?tmdemo).</p>' : "") +
    '<div id="tm-body"><p class="empty">Ładowanie wyników Telemarka…</p></div>';
  SLOT.querySelector(".tm-play").addEventListener("click", () => open(""));
  SLOT.addEventListener("click", (e) => {
    const p = e.target.closest("[data-gid]");
    if (p && !p.disabled) return open("?ogladaj=" + encodeURIComponent(p.dataset.gid));
    const n = e.target.closest("[data-uid]");
    if (n) open("?gracz=" + encodeURIComponent(n.dataset.uid) + "&okres=" + encodeURIComponent(n.dataset.okres));
  });

  function draw(j) {
    today = j.day;
    const by = (k) => j.okresy.find((o) => o.k === k);
    const list = ["y", "m", "w"].map(by).filter(Boolean);
    document.getElementById("tm-body").innerHTML =
      `<div class="tm-cols">${list.map((o) => `<div class="tmc k${o.k}">${champ(o)}</div>`).join("")}</div>` +
      `<div class="tm-races">${list.map((o) => `<div class="tmr k${o.k}">${race(o)}</div>`).join("")}</div>`;
    window.tmFame = j.slawa || [];
    if (typeof window.drawFame === "function") window.drawFame();
  }

  let timer = 0;
  async function load(fresh) {
    clearTimeout(timer);
    if (DEMO) return draw(demo());
    timer = setTimeout(() => load(false), ODSWIEZ_MS);
    const headers = { "Content-Type": "application/json" };
    if (!PROD && haslo()) headers["X-Lotnik-Haslo"] = haslo();
    let j = null;
    try {
      const r = await fetch(API + "/tm/tabele", {
        method: "POST",
        headers,
        body: JSON.stringify(fresh && !PROD ? { fresh: true } : {}),
      });
      j = await r.json();
      if (!r.ok) throw new Error(j && j.error);
    } catch (e) {
      const msg =
        j && j.haslo
          ? "Wyniki: strona testowa wymaga hasła testerów (wpisz je w grze albo w Lotniku)."
          : "Wyniki Telemarka chwilowo niedostępne.";
      document.getElementById("tm-body").innerHTML = `<p class="empty tm-err">${esc(msg)}</p>`;
      return;
    }
    draw(j);
  }

  // Przykładowe dane jak w makiecie C (tylko z ?tmdemo na stronie testowej).
  function demo() {
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });
    const y = day.slice(0, 4);
    const row = (nick, suma, place, i) => ({ nick, uid: "demo" + i, suma, place, dni: 3, puchary: [],
      best: { gid: ("000000000000000" + i).slice(-16), p: 150 + i, m: 120.5, hill: "own-20", day: plus(day, -1) } });
    const top = (names, sums) => names.map((n, i) => row(n, sums[i], i + 1, i + names.length * 7));
    const span = (k) => {
      if (k === "y") return [y + "-12-31"];
      if (k === "m") return [plus(day.slice(0, 8) + "28", 4).slice(0, 8) + "01"].map((f) => plus(f, -1));
      return [plus(mondayOf(day), 6)];
    };
    const mid = (d) => Date.parse(plus(d, 1) + "T00:00:00+01:00") / 1000;
    const wk = (d) => { const t = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + 4 - dow(d))); return "w" + t.getUTCFullYear() + "-" + String(Math.floor((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 / 7) + 1).padStart(2, "0"); };
    const pm = plus(day.slice(0, 8) + "01", -1).slice(0, 7);
    const o = (k, key, rows, prevKey, prev) => ({ k, key, koniec: span(k)[0], koniecTs: mid(span(k)[0]), rows,
      prev: { key: prevKey, zamkniety: true, podium: prev } });
    return {
      day,
      slawa: [{ nick: "Pozdrawiam", uid: "demo", puchary: ["m" + pm] }],
      okresy: [
        o("y", "y" + y, top(["Kryste_Panie", "BrakNicku", "ripsi", "fafniro", "kondes"], [9412, 8970.5, 6115.5, 5020, 3904.5]), "y" + (y - 1), []),
        o("m", "m" + day.slice(0, 7), top(["Kryste_Panie", "BrakNicku", "fafniro"], [4377, 3990, 2620]), "m" + pm,
          top(["Pozdrawiam", "Kryste_Panie", "BrakNicku", "ripsi", "cbx1992"], [7830.5, 7611, 6902.5, 4210, 2877.5])),
        o("w", wk(day), top(["BrakNicku", "Kryste_Panie", "ripsi"], [1205, 1130, 627]), wk(plus(day, -7)),
          top(["Kryste_Panie", "BrakNicku", "fafniro", "Pozdrawiam", "ripsi"], [2034.5, 1987, 1540.5, 1322, 1101.5])),
      ],
    };
  }
  load(false);
})();
