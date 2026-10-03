# Ranking gry "piłeczka": GET [?nick=] -> top 10 + ostatni + miejsce gracza + liczba graczy, POST {nick, score} -> jeden wpis na adres IP (najlepszy wynik, ostatni nick).
# IP nie jest zapisywane wprost — tylko jego skrót (sha256 z solą).
import base64, hashlib, hmac, json, math, ipaddress, os, random, re, secrets, time
from datetime import datetime
from zoneinfo import ZoneInfo
import functions_framework
from google.api_core.exceptions import AlreadyExists
from google.cloud import firestore

db = firestore.Client()
SUFFIX = os.environ.get("SUFFIX", "")  # wersja testowa: osobne kolekcje (pileczka_test, ekwipunek_test)
COL = db.collection(f"pileczka{SUFFIX}")
EQ = db.collection(f"ekwipunek{SUFFIX}")
# rankingi okresowe (dzień i tydzień, czas polski; tydzień od poniedziałku): pileczka_okres/{d2026-10-03 | w2026-40}/gracze/{nick}
OKRES = db.collection(f"pileczka{SUFFIX}_okres")
TZ = ZoneInfo("Europe/Warsaw")

def period_keys():
    d = datetime.now(TZ)
    y, w, _ = d.isocalendar()
    return {"d": "d" + d.strftime("%Y-%m-%d"), "w": f"w{y}-{w:02d}"}

def col_of(okres, keys=None):
    return OKRES.document((keys or period_keys())[okres]).collection("gracze") if okres in ("d", "w") else COL
SALT = os.environ.get("SALT", "d2jsp-pileczka")
ORIGINS = {"https://kruszkush.github.io", "http://localhost:8765"}

def cors(req, body, status=200):
    o = req.headers.get("Origin", "")
    h = {"Access-Control-Allow-Origin": o if o in ORIGINS else "https://kruszkush.github.io",
         "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin"}
    return body, status, h

def row(d):
    return {"nick": d.get("nick"), "score": d.get("score"), "hits": d.get("hits"), "ball": d.get("ball"), "ballUid": d.get("ballUid"), "dev": d.get("dev"), "eq": d.get("eq"), "plays": d.get("plays")}

def nick_low(nick):  # ten sam gracz mimo emotek/spacji/znaków: porównujemy tylko litery i cyfry
    return re.sub(r"[^0-9a-ząćęłńóśźż]", "", nick.lower()) or nick.lower()

def claim_eq(d):  # urządzenie (skrót klucza), z którego można od razu założyć konto na nick z rankingu; bez claimEq = wpis sprzed kont
    return d["claimEq"] if "claimEq" in d else d.get("eq")

def nick_ref(nick, col=None):
    return (COL if col is None else col).document(hashlib.sha256(("nick:" + nick_low(nick)).encode()).hexdigest()[:32])

def ranking(nick="", okres="a"):
    """Top 10 + ostatnie miejsce + miejsce gracza (po nicku) + liczba graczy. Miejsce = 1 + liczba lepszych wyników.
    okres: a = ogólny, w = ten tydzień, d = dziś. best = rekord ogólny gracza (do HUD w grze)."""
    okres = okres if okres in ("d", "w") else "a"
    col = col_of(okres)
    q = col.order_by("score", direction=firestore.Query.DESCENDING)
    out = {"okres": okres, "top": [row(x.to_dict()) for x in q.limit(10).stream()]}
    total = col.count().get()[0][0].value
    out["total"] = total
    rank = lambda s: col.where(filter=firestore.FieldFilter("score", ">", s)).count().get()[0][0].value + 1
    if total > 10:
        last = next(iter(col.order_by("score").limit(1).stream()), None)
        if last:
            out["last"] = {**row(last.to_dict()), "rank": rank(last.to_dict().get("score", 0))}
    if nick:
        me = nick_ref(nick, col).get()
        if me.exists and me.to_dict().get("score"):
            out["you"] = {**row(me.to_dict()), "rank": rank(me.to_dict()["score"])}
        best = me if okres == "a" else nick_ref(nick).get()
        if best.exists:
            out["best"] = best.to_dict().get("score") or 0
    return out

def ip_key(req):
    ip = (req.headers.get("X-Forwarded-For", "") or req.remote_addr or "").split(",")[0].strip()
    try:  # IPv6 zmienia końcówkę adresu co jakiś czas — liczymy całą sieć /64 jako jeden adres
        a = ipaddress.ip_address(ip)
        if a.version == 6:
            ip = str(ipaddress.ip_network(f"{ip}/64", strict=False))
    except ValueError:
        pass
    return hashlib.sha256((SALT + ip).encode()).hexdigest()[:32]

# --- ekwipunek ---
SLOTS = ("helm", "armor", "gloves", "boots")
# afiksy: id -> (prefiks/sufiks, min, max, krok); wartości zawsze z kroku (procenty co 1, mnożniki co 0.1, sekundy co 0.1, seria co 0.01)
AFF = {
    "ostry": ("p", 0.4, 1.0, 0.1), "stlumiony": ("p", 5, 15, 1), "ciezki": ("p", 5, 10, 1), "zreczny": ("p", 10, 30, 1),
    "szczesliwy": ("p", 30, 60, 1), "rozpedzony": ("p", 10, 20, 1), "brawurowy": ("p", 0.15, 0.25, 0.01), "zuchwaly": ("p", 0.02, 0.04, 0.01),
    "wytrwalosci": ("s", 5, 15, 1), "olbrzyma": ("s", 5, 10, 1), "lowcy": ("s", 0.2, 0.5, 0.1), "serii": ("s", 0.10, 0.25, 0.01), "echa": ("s", 10, 20, 1), "stroza": ("s", 1, 1, 1),
    "lotny": ("p", 2, 5, 1), "wznoszacy": ("p", 0.02, 0.04, 0.01), "krytyczny": ("p", 3, 10, 1),
    "maratonczyka": ("s", 0.05, 0.15, 0.01), "rytmu": ("s", 1, 3, 1), "zlota": ("s", 1, 3, 1),
}
PRE_IDS = tuple(k for k, v in AFF.items() if v[0] == "p")
SUF_IDS = tuple(k for k, v in AFF.items() if v[0] == "s")
UNIQUE_MIN_SCORE = 50
U_PTS = [(50, 0.3), (150, 0.8), (300, 1.1), (600, 1.5), (1000, 1.8)]  # % szansy na unikat
def unique_chance(score):  # od 50 pkt, 1.8% przy 1000 pkt, dalej rośnie tym samym tempem (bez limitu)
    return 0 if score < 50 else _curve(U_PTS, score) / 100

def drop_chance(score):  # szansa, że w ogóle coś wypadnie: wynik/80 (od 80 pkt zawsze)
    return min(1.0, score / 80)
KEY_RE = re.compile(r"^[0-9a-f]{32}$")
EQID_RE = re.compile(r"^[0-9a-f]{40}$")
DROP_MIN, DROP_GAP = 15, 15
# punkty kontrolne: wynik -> (normalne, magiczne, rzadkie) w %; poniżej 30 i powyżej 150 stałe
# Szanse rzadkości rosną płynnie (liniowo między punktami, bez schodków); powyżej 1000 pkt dalej tempem ostatniego odcinka (bez limitu).
R_PTS = [(15, 0.25), (50, 1), (100, 2), (200, 4), (300, 6), (600, 10), (1000, 15)]  # rzadkie: szybszy wzrost do 300 pkt
M_PTS = [(15, 14), (50, 22), (100, 30), (200, 38), (300, 42), (600, 45), (1000, 45)]

def _curve(pts, x):
    x = max(pts[0][0], x)
    if x > pts[-1][0]:  # bez limitu: przedłużenie ostatniego odcinka
        (x0, y0), (x1, y1) = pts[-2], pts[-1]
        return y1 + (y1 - y0) * (x - x1) / (x1 - x0)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return pts[-1][1]

PTS_MF_MULT = 3  # magic find z punktów ×3: przyrost M i R ponad poziom z 15 pkt mnożony
def gear_boost(score, luck):
    """Szczęśliwy: MF z przedmiotów sumuje się z MF z punktów; rzadkie/unikaty × (1 + MF łączny) / (1 + MF z punktów)."""
    _, m, r = rarity_weights(score)
    return min(luck, 100) / (100 + max(0.0, m + r - 14.25))

def rarity_weights(score):
    r, m = _curve(R_PTS, score), _curve(M_PTS, score)
    n = max(5.0, 100 - m - r)  # waga normalnych z krzywych bez mnożnika — normalne znikają powoli
    r, m = R_PTS[0][1] + (r - R_PTS[0][1]) * PTS_MF_MULT, M_PTS[0][1] + (m - M_PTS[0][1]) * PTS_MF_MULT
    return (n, m, r)

def _num(x, step):
    x = round(x, 2)
    return int(x) if step >= 1 else x

def roll_val(aid):
    _, lo, hi, st = AFF[aid]
    return _num(lo + random.randint(0, round((hi - lo) / st)) * st, st)

def check_val(aid, v):
    """Zwraca wartość znormalizowaną do kroku albo None, gdy poza zakresem / poza krokiem."""
    if aid not in AFF or isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    _, lo, hi, st = AFF[aid]
    k = (v - lo) / st
    if abs(k - round(k)) > 1e-6 or not 0 <= round(k) <= round((hi - lo) / st):
        return None
    return _num(lo + round(k) * st, st)

def luck_of(slots):
    return sum(a.get("v", 0) for it in (slots or {}).values() if it for a in (it.get("affixes") or []) if a.get("id") == "szczesliwy")

def pick_rarity(score, luck=0):
    n, m, r = rarity_weights(score)
    extra = min(n, r * gear_boost(score, luck))  # szczęśliwy: +X% (względnie) do szansy na rzadki, kosztem normalnego (najwyżej cały normalny)
    n, r = n - extra, r + extra
    return random.choices(("n", "m", "r"), weights=(n, m, r))[0]

def make_item(slot, rarity, affixes, uid=None, nick=None, ilvl=0, mult=0.1):
    return {"v": 2, "id": secrets.token_hex(6), "slot": slot, "rarity": rarity, "uid": uid, "unick": nick, "ilvl": ilvl,
            "ts": int(time.time()), "implicit": {"mult": mult}, "affixes": affixes}

# klasy afiksów i ich waga losowania (łączna na klasę dzielona po równo między afiksy tej klasy)
TIER = {"stlumiony": "slaby", "zreczny": "slaby", "olbrzyma": "slaby",
        "lowcy": "dobry", "ciezki": "dobry",
        "wytrwalosci": "dobry", "rozpedzony": "znakomity", "szczesliwy": "dobry", "brawurowy": "znakomity", "zuchwaly": "znakomity", "echa": "znakomity",
        "lotny": "znakomity", "wznoszacy": "znakomity", "krytyczny": "znakomity", "maratonczyka": "znakomity", "rytmu": "znakomity",
        "ostry": "boski", "serii": "boski", "stroza": "boski", "zlota": "boski"}
_TW = {"slaby": 55, "dobry": 35, "znakomity": 7, "boski": 3}
TIER_W = {t: _TW[t] / sum(1 for x in TIER.values() if x == t) for t in _TW}

def roll_item(score, uid, nick, luck=0):
    slot = random.choice(SLOTS)
    if random.random() < unique_chance(score) * (1 + gear_boost(score, luck)):  # szczęśliwy zwiększa też szansę na unikat
        rarity = "u"  # unikat losowany przed tabelą rzadkości
        slot = random.choice(("helm", "boots"))  # na razie unikaty tylko: Korona Króla Forum i Kapcie Moderatora
    else:
        rarity = pick_rarity(score, luck)
    # afiksy losowane wg klasy (słaby > dobry > znakomity > boski); mogą się powtarzać na jednym przedmiocie
    ids = list(TIER)
    if rarity == "u":  # unikat: +0.3x, jeden gwarantowany boski afiks (równe szanse w klasie) + 2 losowe wg zwykłych wag
        gods = [i for i in ids if TIER[i] == "boski"]
        picks = [random.choice(gods)] + random.choices(ids, weights=[TIER_W[TIER[i]] for i in ids], k=2)
        item = make_item(slot, rarity, [{"id": a, "v": roll_val(a)} for a in picks], uid, nick, score, mult=0.3)
        if slot == "boots":
            item["bans"] = random.randint(2, 4)  # Kapcie Moderatora: 2–4 kliknięcia na grę (starsze egzemplarze bez pola = 1)
        return item
    else:
        n_aff = {"m": 1, "r": 2}.get(rarity, 0)
        aff = [{"id": a, "v": roll_val(a)} for a in random.choices(ids, weights=[TIER_W[TIER[i]] for i in ids], k=n_aff)]
    return make_item(slot, rarity, aff, uid, nick, score)

def eq_ref(key):
    return EQ.document(hashlib.sha256(key.encode()).hexdigest()[:40])

PENDING_TTL = 600  # nierozstrzygnięty przedmiot przepada po 10 min (decyzja tylko w oknie końca gry)
def eq_state(d):
    p = d.get("pending")
    if p and time.time() - d.get("pendingTs", 0) > PENDING_TTL:
        p = None
    return {"slots": {s: (d.get("slots") or {}).get(s) for s in SLOTS}, "pending": p}

def eq_key(j):
    k = j.get("key")
    return k if isinstance(k, str) and KEY_RE.match(k) else None

def eq_target(req, j):
    """(dokument ekwipunku, sesja, odpowiedź z błędem). Zalogowany: ekwipunek konta z sesji; gość: dokument klucza."""
    if KONTA and "token" in j:
        s = session_of(j.get("token"))
        if not s:
            return None, None, relogin(req)
        return EQ.document(s["eq"]), s, None
    key = eq_key(j)
    if not key:
        return None, None, cors(req, {"error": "zły klucz"}, 400)
    return eq_ref(key), None, None

def owned(req, d):  # klucz gościa, którego ekwipunek jest już przypięty do konta (rejestracja / łączenie)
    return cors(req, {"error": f"Ten ekwipunek jest na koncie {d.get('ownerNick') or ''} — zaloguj się.", "konto": d.get("ownerNick") or ""}, 403)

def eq_drop(req, j):
    ref, ses, bad = eq_target(req, j)
    if bad:
        return bad
    r = tok_read(j.get("r"), "r", 3600)  # wynik zweryfikowany przez /end
    if not r:
        return cors(req, {"error": "Nieważny wynik gry — odśwież stronę."}, 400)
    gid, score = r["gid"], r["score"]
    if score < DROP_MIN:
        return cors(req, {"drop": None})
    uid = str(j.get("ballUid", ""))[:12] if str(j.get("ballUid", "")).isdigit() else None
    nick = str(j.get("ballNick", ""))[:30] or None

    @firestore.transactional
    def run(tx):
        snap = ref.get(transaction=tx)
        d = snap.to_dict() if snap.exists else {}
        if not ses and d.get("owner"):
            return {"_owned": d}
        now = time.time()
        if d.get("lastGameId") == gid:
            return {"drop": None, "reason": "ta gra już była"}
        if now - d.get("lastDropTs", 0) < DROP_GAP:
            return {"drop": None, "reason": "za szybko"}
        if random.random() >= drop_chance(score):  # gra zużyta, ale bez przedmiotu
            d["lastGameId"] = gid
            tx.set(ref, d, merge=True) if snap.exists else None
            return {"drop": None, "reason": "pech", "chance": round(drop_chance(score) * 100)}
        st = eq_state(d)
        item = roll_item(score, uid, nick, luck_of(st["slots"]))
        d["slots"], d["pending"], d["lastDropTs"], d["lastGameId"] = st["slots"], st["pending"], now, gid
        if d["slots"][item["slot"]] is None:
            d["slots"][item["slot"]] = item
            d["pending"] = None
            out = {"drop": item, "equipped": True, "slots": d["slots"]}
        elif item["rarity"] == "n" and d["slots"][item["slot"]].get("rarity") != "n":
            # normalny przy założonym magicznym/rzadkim/unikacie jest zawsze gorszy (bez afiksów, nie liczy się do zestawu) — odrzucamy bez pytania
            out = {"drop": item, "autoDiscard": True, "current": d["slots"][item["slot"]], "slots": d["slots"]}
        else:
            d["pending"], d["pendingTs"] = item, now
            out = {"drop": item, "current": d["slots"][item["slot"]], "slots": d["slots"]}
        tx.set(ref, d)
        return out
    out = run(db.transaction())
    return owned(req, out["_owned"]) if "_owned" in out else cors(req, out)

def eq_inv(req, j):
    ref, ses, bad = eq_target(req, j)
    if bad:
        return bad
    snap = ref.get()
    d = snap.to_dict() if snap.exists else {}
    if not ses and d.get("owner"):
        return owned(req, d)
    return cors(req, {**eq_state(d), **({"acc": {"nick": ses["nick"]}} if ses else {})})

def eq_equip(req, j):
    # klucz gościa może rozstrzygnąć pending także po przypięciu ekwipunku do konta (drop sprzed rejestracji; nowe dropy kluczem są wtedy blokowane)
    ref, ses, bad = eq_target(req, j)
    if bad:
        return bad
    iid, action = j.get("id"), j.get("action")
    if not isinstance(iid, str) or action not in ("equip", "discard"):
        return cors(req, {"error": "zły klucz lub akcja"}, 400)

    @firestore.transactional
    def run(tx):
        snap = ref.get(transaction=tx)
        d = snap.to_dict() if snap.exists else {}
        st = eq_state(d)
        p = st["pending"]
        if not p or p.get("id") != iid or (not ses and d.get("owner") and d.get("pendingTs", 0) >= d.get("ownerTs", 0)):
            return None
        if action == "equip":
            st["slots"][p["slot"]] = p
        tx.set(ref, {"slots": st["slots"], "pending": None}, merge=True)
        return {"slots": st["slots"], "pending": None}
    r = run(db.transaction())
    return cors(req, r) if r else cors(req, {"error": "przedmiot już przepadł"}, 409)

def eq_grant(req, j):  # narzędzie testowe: tylko funkcja testowa (SUFFIX=_test)
    if SUFFIX != "_test":
        return cors(req, {"error": "niedostępne"}, 403)
    ref, ses, bad = eq_target(req, j)
    if bad:
        return bad
    slot, rarity, aff = j.get("slot"), j.get("rarity"), j.get("affixes") or []
    if slot not in SLOTS or rarity not in ("n", "m", "r", "u") or not isinstance(aff, list):
        return cors(req, {"error": "zły klucz, slot lub rzadkość"}, 400)
    if len(aff) > {"n": 0, "m": 1, "r": 2, "u": 0}[rarity]:
        return cors(req, {"error": "za dużo afiksów"}, 400)
    out, seen = [], set()
    for a in aff:
        aid = a.get("id") if isinstance(a, dict) else None
        v = check_val(aid, a.get("v")) if aid else None
        if v is None or aid in seen:
            return cors(req, {"error": "zły afiks lub wartość"}, 400)
        seen.add(aid)
        out.append({"id": aid, "v": v})
    snap = ref.get()
    if not ses and (snap.to_dict() or {}).get("owner"):
        return owned(req, snap.to_dict())
    st = eq_state(snap.to_dict() if snap.exists else {})
    st["slots"][slot] = make_item(slot, rarity, out, None, "test", 50)
    ref.set({"slots": st["slots"]}, merge=True)
    return cors(req, {"slots": st["slots"], "pending": st["pending"]})

def eq_view(req, j):  # publiczny podgląd cudzych slotów (po skrócie z rankingu; bez pending i bez klucza)
    eid = j.get("eq")
    if not isinstance(eid, str) or not EQID_RE.match(eid):
        return cors(req, {"error": "zły identyfikator"}, 400)
    snap = EQ.document(eid).get()
    return cors(req, {"slots": eq_state(snap.to_dict() if snap.exists else {})["slots"]})

# --- weryfikacja gier: bilet z /start (podpisany, bez zapisu w bazie) -> /end sprawdza log podbić i wydaje podpisany wynik dla /drop i zapisu ---
# Reguły bonusów to kopia calcB/CAP/partsOf z docs/gra.js — przy zmianie zasad punktacji w grze zmień też tutaj (gra_bonusy, gra_limit).
CAP = {"stlum": .3, "ciezki": .25, "zreczny": .6, "olb": .25, "rozp": .6, "lowcy": 1.5, "lucky": 100, "wytrw": .3, "brawur": .5, "zuch": .08, "echa": .25,
       "wzn": .08, "mar": .3, "rytm": 6, "kryt": .3, "zlota": .06}  # nowe (12.1-test): wznoszący, maratończyka, rytmu, krytyczny, złotej piłki
BRAV_MAX, ZUCH_MAX = 1.5, 0.6
MIN_GAP_MS = 90  # klient ignoruje kliki szybsze niż 100 ms; luz na zaokrąglenia

def sign_key():
    k = os.environ.get("ADMIN_SECRET", "")
    return hmac.new(k.encode(), b"pileczka-gra", hashlib.sha256).digest() if k else None

def tok_make(d):
    body = base64.urlsafe_b64encode(json.dumps(d, separators=(",", ":")).encode()).decode().rstrip("=")
    return body + "." + hmac.new(sign_key(), body.encode(), hashlib.sha256).hexdigest()[:32]

def tok_read(t, kind, max_age):
    if not isinstance(t, str) or "." not in t or len(t) > 2000 or not sign_key():
        return None
    body, sig = t.rsplit(".", 1)
    if not hmac.compare_digest(sig, hmac.new(sign_key(), body.encode(), hashlib.sha256).hexdigest()[:32]):
        return None
    try:
        d = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
    except ValueError:
        return None
    return d if isinstance(d, dict) and d.get("k") == kind and time.time() - d.get("t", 0) <= max_age else None

def gra_bonusy(slots):
    b = dict.fromkeys(("impl", "ostry", "stlum", "ciezki", "zreczny", "rozp", "wytrw", "olb", "lowcy", "serii", "brawur", "zuch", "echa", "lucky", "korona", "setMult", "wzn", "mar", "rytm", "kryt", "zlota"), 0.0)
    pct = {"stlumiony": "stlum", "ciezki": "ciezki", "zreczny": "zreczny", "rozpedzony": "rozp", "wytrwalosci": "wytrw", "olbrzyma": "olb", "echa": "echa", "krytyczny": "kryt", "zlota": "zlota"}
    raw = {"ostry": "ostry", "szczesliwy": "lucky", "lowcy": "lowcy", "serii": "serii", "brawurowy": "brawur", "zuchwaly": "zuch", "wznoszacy": "wzn", "maratonczyka": "mar", "rytmu": "rytm"}
    cnt = {}
    for it in (slots or {}).values():
        if not it:
            continue
        b["impl"] += (it.get("implicit") or {}).get("mult") or 0
        if it.get("rarity") == "u" and it.get("slot") == "helm":
            b["korona"] = 1
        for a in it.get("affixes") or []:
            v = a.get("v") or 0
            if a.get("id") in pct:
                b[pct[a["id"]]] += v / 100
            elif a.get("id") in raw:
                b[raw[a["id"]]] += v
        if it.get("uid") and it.get("rarity") in ("r", "u"):
            cnt[it["uid"]] = cnt.get(it["uid"], 0) + 1
    n = max(cnt.values()) if cnt else 0
    b["setMult"] = (n - 1) * .2 if n >= 2 else 0
    for k, c in CAP.items():
        b[k] = min(b[k], c)
    return b

def roll(seed, k, i):
    """Rzut szansy za podbicie: kopia funkcji roll z docs/test/gra.js (32 bity). k: 1 echa, 2 krytyczny, 3 złota; i: numer podbicia od 1. Trafienie gdy roll < szansa."""
    M = 0xFFFFFFFF
    x = (seed ^ (k * 0x9E3779B1 & M) ^ (i * 0x85EBCA77 & M)) & M
    x ^= x >> 16
    x = x * 0x85EBCA6B & M
    x ^= x >> 13
    x = x * 0xC2B2AE35 & M
    x ^= x >> 16
    return x / 2**32

def chance_mult(b, seed, i):
    """Dokładny mnożnik szans za i-te podbicie: echa ×2, krytyczny ×3, złota ×10 (mnożą się). Bilet bez seeda (stary klient) = najgorszy możliwy przypadek dla echa."""
    if seed is None:
        return 2 if b["echa"] > 0 else 1
    m, eps = 1, 1e-9  # eps: zaokrąglenia szans po stronie klienta (r3) nie mogą odrzucić uczciwej gry
    if roll(seed, 1, i) < b["echa"] + eps:
        m *= 2
    if roll(seed, 2, i) < b["kryt"] + eps:
        m *= 3
    if roll(seed, 3, i) < b["zlota"] + eps:
        m *= 10
    return m

def gra_limit(b, i, t_ms=0, seed=None):
    """Najwięcej punktów możliwych za i-te podbicie (od 1, t_ms = czas z logu): największa piłeczka (1.7) + Łowcy + premia top 10 (0.6) [+ Hełm]."""
    base = 1.7 + b["lowcy"] + .6 + (.6 if b["korona"] else 0)
    lv = 1 + b["rozp"] + .1 * (i // 8)
    items = (b["impl"] + b["ostry"] + b["setMult"] + min(ZUCH_MAX, b["zuch"] * i) + b["serii"] * (i // 10)
             + b["wzn"] * (i // 8) + b["mar"] * (int(t_ms) // 30000))
    brav = min(BRAV_MAX, b["brawur"] * i)
    rytm = b["rytm"] if i % 5 == 0 else 0  # stała premia na co 5. podbiciu (poza mnożnikami szans)
    return (base * lv + items + brav) * chance_mult(b, seed, i) + rytm + .02

def gra_start(req, j):
    if not sign_key():
        return cors(req, {"error": "niedostępne"}, 503)
    if not rate_ok(req, "start", 120, 600):
        return too_many(req)
    seed = secrets.randbits(32)  # z niego klient i serwer liczą rzuty szans (echa/krytyczny/złota) — patrz roll()
    return cors(req, {"g": tok_make({"k": "g", "gid": secrets.token_hex(8), "t": time.time(), "s": seed}), "s": seed})

def gra_end(req, j):
    g = tok_read(j.get("g"), "g", 6 * 3600)
    if not g:
        return cors(req, {"error": "Nieważny bilet gry — odśwież stronę."}, 400)
    log = j.get("log")
    st = j.get("st") if isinstance(j.get("st"), dict) else {}
    if not isinstance(log, list) or not 0 < len(log) <= 20000:
        return cors(req, {"error": "zły log gry"}, 400)
    num = lambda x: isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)
    # granica punktów z ekwipunku, którym grało to urządzenie (stan teraz — przedmiot zakładany jest tylko między grami)
    ref = None
    if KONTA and "token" in j:
        s = session_of(j.get("token"))
        ref = EQ.document(s["eq"]) if s else None
    elif eq_key(j):
        ref = eq_ref(eq_key(j))
    snap = ref.get() if ref else None
    b = gra_bonusy(eq_state(snap.to_dict() if snap and snap.exists else {})["slots"])

    def bad(why):
        print("gra odrzucona:", why, g["gid"])
        return cors(req, {"error": f"Wynik odrzucony: {why}.", "odrzucony": True}, 400)
    prev, total, gaps = -1, 0.0, []
    for i, e in enumerate(log, 1):
        if not isinstance(e, list) or len(e) != 2 or not num(e[0]) or not num(e[1]) or e[1] < 0:
            return cors(req, {"error": "zły log gry"}, 400)
        t, pts = e
        if prev >= 0:
            if t - prev < MIN_GAP_MS:
                return bad("podbicia szybsze, niż pozwala gra")
            gaps.append(t - prev)
        if pts > gra_limit(b, i, t, g.get("s")):
            return bad("za dużo punktów za podbicie")
        prev, total = t, total + pts
    dur, sim = st.get("dur"), st.get("sim")
    if not num(dur) or not num(sim) or dur < prev:
        return cors(req, {"error": "zły log gry"}, 400)
    real = (time.time() - g["t"]) * 1000
    if dur > real + 5000:
        return bad("czas gry dłuższy, niż minął naprawdę")
    if dur < .8 * real - 15000:
        return bad("zegar gry był spowolniony")
    flags = []
    if dur > 20000 and sim < .8 * dur:
        flags.append("fps")  # niski FPS (słaby sprzęt albo celowe dławienie) — gra zwalnia; tylko flaga
    if st.get("emu") is True:
        flags.append("emu")  # tryb telefonu w narzędziach przeglądarki na komputerze (heurystyka)
    if num(st.get("untr")) and st["untr"] > 0:
        flags.append("skrypt")  # kliknięcia wywołane skryptem (gra je ignoruje)
    if len(gaps) >= 30:
        m = sum(gaps) / len(gaps)
        cv = math.sqrt(sum((x - m) ** 2 for x in gaps) / len(gaps)) / m if m else 0
        if cv < .1:
            flags.append("rowne")  # podbicia w bardzo równych odstępach (autokliker)
    if num(st.get("clicks")) and dur > 10000 and st["clicks"] / (dur / 1000) > 8:
        flags.append("klik")  # ponad 8 kliknięć na sekundę przez całą grę
    score, hits = round(total), len(log)
    return cors(req, {"r": tok_make({"k": "r", "gid": g["gid"], "score": score, "hits": hits, "flags": flags, "t": time.time()}),
                      "score": score, "hits": hits, "flags": flags})

# --- konta graczy: nick + hasło (scrypt), sesja per urządzenie (losowy token, na serwerze tylko skrót), bez wygasania ---
ACC = db.collection(f"konta{SUFFIX}")  # id = skrót nicku, ten sam co wpis rankingu
SES = db.collection(f"sesje{SUFFIX}")  # id = skrót tokenu
TOK_RE, SID_RE = re.compile(r"^[0-9a-f]{64}$"), re.compile(r"^[0-9a-f]{40}$")
PW_MIN, PW_MAX, FAIL_MAX, LOCK_S, SEEN_S = 6, 200, 5, 900, 43200
CODE_ABC, CODE_TTL = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", 86400  # kod od admina: 8 znaków bez mylących (0/O, 1/I/L), ważny 24 h
KONTA = os.environ.get("KONTA") == "1"  # konta włączone tylko tam, gdzie ustawiono env (na razie pileczka-test) — wdrożenie tego kodu na prod ich nie włącza
WEAK = {"123456", "1234567", "12345678", "123456789", "1234567890", "654321", "111111", "000000", "666666", "123123", "121212", "112233", "123321",
        "qwerty", "qwerty1", "qwerty123", "qwertyuiop", "asdfgh", "zxcvbn", "password", "password1", "haslo", "haslo1", "haslo12", "haslo123",
        "abc123", "abcdef", "zaq12wsx", "qazwsx", "1q2w3e", "1q2w3e4r", "iloveyou", "kochanie", "polska", "diablo", "diablo2", "d2jsp1", "pileczka"}
_RL = {}
RL_PW, RL_REG = int(os.environ.get("RL_PW", "20")), int(os.environ.get("RL_REG", "5"))  # prób z hasłem na 10 min / nowych kont na dobę z jednego adresu

def real_ip(req):
    """Adres do limitów: OSTATNI wpis X-Forwarded-For (dopisuje go Google); pierwszy może podać sam klient. IPv6: cała sieć /64."""
    xs = [x.strip() for x in req.headers.get("X-Forwarded-For", "").split(",") if x.strip()]
    ip = xs[-1] if xs else (req.remote_addr or "")
    try:
        if ipaddress.ip_address(ip).version == 6:
            ip = str(ipaddress.ip_network(f"{ip}/64", strict=False))
    except ValueError:
        pass
    return sha(SALT + ip)[:32]

def rate_ok(req, kind, n, per):
    """Limit na adres IP (w pamięci instancji): chroni CPU przed seriami scrypt i przed masową rejestracją nicków."""
    k, now = (kind, real_ip(req)), time.time()
    q = [t for t in _RL.get(k, ()) if now - t < per]
    ok = len(q) < n
    _RL[k] = q + [now] if ok else q
    if len(_RL) > 20000:
        _RL.clear()
    return ok

def too_many(req):
    return cors(req, {"error": "Za dużo prób z tego adresu — odczekaj kilka minut."}, 429)

def clean_nick(x):
    return re.sub(r"\s+", " ", str(x or "")).strip()[:20]

def pw_hash(pw):
    s = os.urandom(16)
    return {"s": s.hex(), "h": hashlib.scrypt(pw.encode(), salt=s, n=2**14, r=8, p=1, dklen=32).hex(), "n": 2**14, "r": 8, "p": 1}

def pw_ok(pw, rec):
    h = hashlib.scrypt(pw.encode(), salt=bytes.fromhex(rec["s"]), n=rec["n"], r=rec["r"], p=rec["p"], dklen=32).hex()
    return hmac.compare_digest(h, rec["h"])

def pw_bad(pw, nick=""):
    """Komunikat, gdy hasło się nie nadaje (None = dobre): długość, najpopularniejsze hasła, hasło = nick."""
    if not isinstance(pw, str) or not PW_MIN <= len(pw) <= PW_MAX:
        return f"Hasło musi mieć {PW_MIN}–{PW_MAX} znaków."
    if pw.lower() in WEAK or len(set(pw)) < 3 or (nick and nick_low(pw) == nick_low(nick)):
        return "To hasło jest za łatwe do zgadnięcia — wymyśl inne."
    return None

def sha(x):
    return hashlib.sha256(x.encode()).hexdigest()

def ua_label(req):  # opis urządzenia na liście sesji, np. „Chrome · Android”
    ua = req.headers.get("User-Agent", "")
    b = next((n for p, n in (("Edg/", "Edge"), ("OPR/", "Opera"), ("SamsungBrowser", "Samsung Internet"), ("Firefox/", "Firefox"), ("FxiOS", "Firefox"),
                             ("CriOS", "Chrome"), ("Chrome/", "Chrome"), ("Safari/", "Safari")) if p in ua), "Przeglądarka")
    o = next((n for p, n in (("Android", "Android"), ("iPhone", "iPhone"), ("iPad", "iPad"), ("Windows", "Windows"), ("Mac OS", "macOS"), ("CrOS", "ChromeOS"), ("Linux", "Linux")) if p in ua), "")
    return f"{b} · {o}" if o else b

def new_session(req, acc_id, nick, eq_id, dev):
    tok, now = secrets.token_hex(32), int(time.time())
    SES.document(sha(tok)[:40]).set({"acc": acc_id, "nick": nick, "eq": eq_id, "dev": dev if dev in ("m", "d") else None, "label": ua_label(req), "created": now, "seen": now})
    return tok

def session_of(tok):
    if not isinstance(tok, str) or not TOK_RE.match(tok):
        return None
    ref = SES.document(sha(tok)[:40])
    s = ref.get()
    if not s.exists:
        return None
    d = {**s.to_dict(), "id": ref.id}
    if time.time() - d.get("seen", 0) > SEEN_S:  # „ostatnio” na liście urządzeń: zapis najwyżej co 12 h
        ref.update({"seen": int(time.time())})
    return d

def relogin(req):
    return cors(req, {"error": "To urządzenie zostało wylogowane — zaloguj się ponownie.", "relogin": True}, 401)

def sessions_of(acc_id):
    return list(SES.where(filter=firestore.FieldFilter("acc", "==", acc_id)).stream())

# osobne liczniki dla hasła (p="") i kodu od admina (p="r"): złe hasła wpisywane przez kogoś obcego nie blokują użycia kodu
def lock_left(d, p=""):
    return max(0, d.get(p + "lockUntil", 0) - time.time())

def lock_msg(d, p=""):
    return f"Za dużo błędnych prób — {'logowanie na ten nick' if not p else 'użycie kodu'} zablokowane na 15 min (do {datetime.fromtimestamp(d[p + 'lockUntil'], TZ).strftime('%H:%M')})."

def fail(req, aref, what, p=""):
    """Błędne hasło/kod: licznik prób (krótka transakcja, scrypt liczony wcześniej); przy 5. blokada na 15 min (jawny komunikat)."""
    @firestore.transactional
    def run(tx):
        d = aref.get(transaction=tx).to_dict() or {}
        n = d.get(p + "fails", 0) + 1
        if n >= FAIL_MAX:
            d = {p + "fails": 0, p + "lockUntil": int(time.time()) + LOCK_S}
            tx.update(aref, d)
            return lock_msg(d, p)
        tx.update(aref, {p + "fails": n})
        return f"{what}. Zostało prób: {FAIL_MAX - n} (potem blokada na 15 min)."
    return cors(req, {"error": run(db.transaction())}, 401)

def bind_eq(tx, aref, nick, key):
    """Ekwipunek konta = dokument klucza tego urządzenia (stary klucz przestaje działać jako gość).
    Gdy ten dokument należy już do innego konta albo brak klucza — nowy, pusty dokument konta. Odczyt przed zapisami (transakcja)."""
    eref = eq_ref(key) if key else None
    if eref is not None and not (eref.get(transaction=tx).to_dict() or {}).get("owner"):
        return eref
    return EQ.document(sha("konto:" + aref.id)[:40])

def acc_register(req, j):
    nick, pw, key = clean_nick(j.get("nick")), j.get("password"), eq_key(j)
    if len(nick) < 3:
        return cors(req, {"error": "Nick musi mieć co najmniej 3 znaki."}, 400)
    if pw_bad(pw, nick):
        return cors(req, {"error": pw_bad(pw, nick)}, 400)
    if not key:
        return cors(req, {"error": "zły klucz"}, 400)
    if not rate_ok(req, "pw", RL_PW, 600):
        return too_many(req)
    aref, rref = nick_ref(nick, ACC), nick_ref(nick)
    a = aref.get()
    if a.exists:
        return cors(req, {"error": "Ten nick ma już konto — zaloguj się." if a.to_dict().get("pw") else "Na ten nick admin wydał kod — użyj „Mam kod od admina”."}, 409)
    r = rref.get()
    if r.exists and claim_eq(r.to_dict()) != eq_ref(key).id:  # nick zajęty w rankingu: od razu tylko z urządzenia rekordu (stan sprzed kont, niepodrabialny)
        return cors(req, {"error": "Ten nick jest już w rankingu. Konto na niego założysz tylko na urządzeniu, na którym padł jego rekord (sprzed wprowadzenia kont) — albo napisz PW do kruszkush na d2jsp.", "admin": True}, 403)
    if not rate_ok(req, "reg", RL_REG, 86400):  # liczą się tylko udane próby: max 5 nowych kont na dobę z jednego adresu
        return too_many(req)
    h, now = pw_hash(pw), int(time.time())

    @firestore.transactional
    def run(tx):
        eref = bind_eq(tx, aref, nick, key)
        tx.create(aref, {"nick": nick, "nickLower": nick_low(nick), "pw": h, "eq": eref.id, "created": now, "fails": 0})
        tx.set(eref, {"owner": aref.id, "ownerNick": nick, "ownerTs": time.time()}, merge=True)
        if r.exists and r.to_dict().get("eq") != eref.id:  # podgląd z rankingu ma pokazywać ekwipunek konta
            tx.update(rref, {"eq": eref.id})
        return eref.id
    try:
        eid = run(db.transaction())
    except AlreadyExists:
        return cors(req, {"error": "Ten nick ma już konto — zaloguj się."}, 409)
    return cors(req, {"token": new_session(req, aref.id, nick, eid, j.get("dev")), "nick": nick, "bound": eid == eq_ref(key).id})

def acc_login(req, j):
    nick, pw = clean_nick(j.get("nick")), j.get("password")
    if len(nick) < 3 or not isinstance(pw, str) or not pw:
        return cors(req, {"error": "Podaj nick i hasło."}, 400)
    if not rate_ok(req, "pw", RL_PW, 600):
        return too_many(req)
    aref = nick_ref(nick, ACC)
    a = aref.get()
    d = a.to_dict() if a.exists else {}
    if not d.get("pw"):
        return cors(req, {"error": "Ten nick nie ma konta."}, 404)
    if lock_left(d):
        return cors(req, {"error": lock_msg(d)}, 429)
    if not pw_ok(pw[:PW_MAX], d["pw"]):
        return fail(req, aref, "Złe hasło")
    if d.get("fails"):
        aref.update({"fails": 0})
    return cors(req, {"token": new_session(req, aref.id, d["nick"], d["eq"], j.get("dev")), "nick": d["nick"]})

def sess_rows(s):
    rows = [{"sid": x.id, **{k: x.to_dict().get(k) for k in ("label", "dev", "created", "seen")}, "me": x.id == s["id"]} for x in sessions_of(s["acc"])]
    return sorted(rows, key=lambda r: (not r["me"], -(r["seen"] or 0)))

def acc_sessions(req, j):
    s = session_of(j.get("token"))
    return cors(req, {"nick": s["nick"], "sessions": sess_rows(s)}) if s else relogin(req)

def acc_logout(req, j):
    s = session_of(j.get("token"))
    if not s:
        return relogin(req)
    sid = j.get("sid")
    if sid is None or sid == s["id"]:
        SES.document(s["id"]).delete()
        return cors(req, {"ok": True})
    if not isinstance(sid, str) or not SID_RE.match(sid):
        return cors(req, {"error": "zła sesja"}, 400)
    t = SES.document(sid).get()
    if t.exists and t.to_dict().get("acc") == s["acc"]:
        t.reference.delete()
    return cors(req, {"nick": s["nick"], "sessions": sess_rows(s)})

def acc_password(req, j):  # zmiana hasła na zalogowanym urządzeniu (też gdy stare zapomniane) — bez starego hasła
    s = session_of(j.get("token"))
    if not s:
        return relogin(req)
    if pw_bad(j.get("password"), s["nick"]):
        return cors(req, {"error": pw_bad(j.get("password"), s["nick"])}, 400)
    if not rate_ok(req, "pw", RL_PW, 600):
        return too_many(req)
    ACC.document(s["acc"]).update({"pw": pw_hash(j["password"]), "fails": 0, "lockUntil": 0})
    gone = [x for x in sessions_of(s["acc"]) if x.id != s["id"]]
    for x in gone:  # zmiana hasła wylogowuje pozostałe urządzenia (np. skradziony token)
        x.reference.delete()
    return cors(req, {"ok": True, "loggedOut": len(gone)})

def acc_redeem(req, j):
    """Kod od admina: ustawia nowe hasło i wylogowuje wszystkie urządzenia konta. Nick bez konta (przejęcie z rankingu) = jak rejestracja."""
    nick, pw, key = clean_nick(j.get("nick")), j.get("password"), eq_key(j)
    code = re.sub(r"[\s-]", "", str(j.get("code", ""))).upper()[:20]
    if len(nick) < 3 or not code:
        return cors(req, {"error": "Podaj nick i kod."}, 400)
    if pw_bad(pw, nick):
        return cors(req, {"error": pw_bad(pw, nick)}, 400)
    if not rate_ok(req, "pw", RL_PW, 600):
        return too_many(req)
    aref = nick_ref(nick, ACC)
    a = aref.get()
    d = a.to_dict() if a.exists else {}
    rs = d.get("reset") or {}
    if rs.get("exp", 0) < time.time():
        return cors(req, {"error": "Brak ważnego kodu dla tego nicku (kod działa 24 h) — napisz PW do kruszkush na d2jsp."}, 404)
    if lock_left(d, "r"):
        return cors(req, {"error": lock_msg(d, "r")}, 429)
    if not hmac.compare_digest(sha(code), rs.get("h", "")):
        return fail(req, aref, "Zły kod", "r")
    h, now = pw_hash(pw), int(time.time())

    @firestore.transactional
    def run(tx):
        cur = aref.get(transaction=tx).to_dict() or {}
        if (cur.get("reset") or {}).get("h") != rs.get("h"):
            return None  # kod zużyty równolegle
        if cur.get("eq"):  # konto z ekwipunkiem albo ekwipunek urządzenia rekordu podpięty przez admina
            eref = EQ.document(cur["eq"])
            bind = not (eref.get(transaction=tx).to_dict() or {}).get("owner")
        else:
            eref, bind = bind_eq(tx, aref, cur.get("nick") or nick, key), True
        tx.update(aref, {"pw": h, "reset": firestore.DELETE_FIELD, "fails": 0, "lockUntil": 0, "rfails": 0, "rlockUntil": 0, "eq": eref.id, "created": cur.get("created") or now})
        if bind:
            tx.set(eref, {"owner": aref.id, "ownerNick": cur.get("nick") or nick, "ownerTs": time.time()}, merge=True)
        return eref.id, cur.get("nick") or nick
    out = run(db.transaction())
    if not out:
        return cors(req, {"error": "Ten kod został już użyty."}, 409)
    eid, nk = out
    for x in sessions_of(aref.id):  # wszystkie dotychczasowe urządzenia wylogowane
        x.reference.delete()
    return cors(req, {"token": new_session(req, aref.id, nk, eid, j.get("dev")), "nick": nk, "bound": bool(key) and eid == eq_ref(key).id})

def acc_merge(req, j):
    """Łączenie ekwipunku gościa z tego urządzenia z kontem: pick[slot] = 'dev' bierze przedmiot gościa. Nic nie kasujemy — dokument gościa dostaje znacznik mergedInto."""
    s, key, pick = session_of(j.get("token")), eq_key(j), j.get("pick")
    if not s:
        return relogin(req)
    if not key or not isinstance(pick, dict):
        return cors(req, {"error": "zły klucz"}, 400)
    aref, gref = EQ.document(s["eq"]), eq_ref(key)

    @firestore.transactional
    def run(tx):
        ad, gd = aref.get(transaction=tx).to_dict() or {}, gref.get(transaction=tx).to_dict() or {}
        ast = eq_state(ad)
        if gref.id == aref.id or gd.get("owner"):  # już połączony / to ten sam ekwipunek / należy do innego konta
            return ast if gref.id == aref.id or gd.get("owner") == s["acc"] else None
        gs = eq_state(gd)["slots"]
        slots = {sl: gs[sl] if pick.get(sl) == "dev" and gs[sl] else ast["slots"][sl] for sl in SLOTS}
        tx.set(aref, {"slots": slots}, merge=True)
        tx.set(gref, {"owner": s["acc"], "ownerNick": s["nick"], "mergedInto": aref.id, "mergedTs": int(time.time()),
                      "mergedPick": {sl: "dev" if slots[sl] is gs[sl] and gs[sl] else "acc" for sl in SLOTS}}, merge=True)
        return {"slots": slots, "pending": ast["pending"]}
    out = run(db.transaction())
    return cors(req, out) if out else cors(req, {"error": "Ten ekwipunek należy do innego konta."}, 409)

def acc_admin(req, j):
    """Admin (sekret w env ADMIN_SECRET): action=code — jednorazowy kod na 24 h (reset hasła albo przejęcie nicku z rankingu), action=info — stan konta."""
    sec = os.environ.get("ADMIN_SECRET", "")
    if not sec or not hmac.compare_digest(str(j.get("secret", "")).encode(), sec.encode()):
        return cors(req, {"error": "niedostępne"}, 403)
    nick = clean_nick(j.get("nick"))
    if len(nick) < 3:
        return cors(req, {"error": "zły nick"}, 400)
    aref = nick_ref(nick, ACC)
    d = aref.get().to_dict() or {}
    r = nick_ref(nick).get().to_dict() or {}
    info = {"nick": d.get("nick") or r.get("nick") or nick, "konto": bool(d.get("pw")), "sesje": len(sessions_of(aref.id)) if d else 0,
            "zablokowane": bool(lock_left(d)), "ranking": {k: r.get(k) for k in ("nick", "score", "eq", "dev", "flags")} if r else None,
            "kod_wazny_do": (d.get("reset") or {}).get("exp")}
    if j.get("action") == "info":
        return cors(req, info)
    if j.get("action") != "code":
        return cors(req, {"error": "zła akcja"}, 400)
    code = "".join(secrets.choice(CODE_ABC) for _ in range(8))
    upd = {"reset": {"h": sha(code), "exp": int(time.time()) + CODE_TTL}}
    if not d:
        upd.update(nick=info["nick"], nickLower=nick_low(info["nick"]))
    ce = claim_eq(r) if r and not d.get("eq") else None
    if ce and EQID_RE.match(ce) and not (EQ.document(ce).get().to_dict() or {}).get("owner"):
        upd["eq"] = ce  # przejęcie nicku: konto dostanie ekwipunek z urządzenia rekordu (np. gracz stracił klucz po wyczyszczeniu przeglądarki)
    aref.set(upd, merge=True)
    return cors(req, {**info, "kod": code[:4] + "-" + code[4:], "kod_wazny_do": upd["reset"]["exp"], "ekwipunek_rekordu": bool(upd.get("eq") or d.get("eq") and not d.get("pw"))})

ACC_ROUTES = {acc_register, acc_login, acc_logout, acc_sessions, acc_password, acc_redeem, acc_merge, acc_admin}
EQ_ROUTES = {"/start": gra_start, "/end": gra_end, "/drop": eq_drop, "/inv": eq_inv, "/equip": eq_equip, "/grant": eq_grant, "/view": eq_view,
             "/register": acc_register, "/login": acc_login, "/logout": acc_logout, "/sessions": acc_sessions,
             "/password": acc_password, "/redeem": acc_redeem, "/merge": acc_merge, "/admin": acc_admin}

@functions_framework.http
def pileczka(req):
    if req.method == "OPTIONS":
        return cors(req, "", 204)
    h = EQ_ROUTES.get(req.path.rstrip("/") or "/")
    if h in ACC_ROUTES and not KONTA:
        return cors(req, {"error": "niedostępne"}, 404)
    if h:  # ekwipunek: osobna ścieżka, błąd tutaj nie dotyka rankingu
        if req.method != "POST":
            return cors(req, {"error": "metoda"}, 405)
        try:
            return h(req, req.get_json(silent=True) or {})
        except Exception as e:
            print("ekwipunek:", repr(e))
            return cors(req, {"error": "błąd ekwipunku"}, 500)
    if req.method == "GET":
        return cors(req, ranking(str(req.args.get("nick", ""))[:20], str(req.args.get("okres", ""))))
    if req.method == "POST":
        j = req.get_json(silent=True) or {}
        nick = re.sub(r"\s+", " ", str(j.get("nick", ""))).strip()[:20]
        gr = tok_read(j.get("r"), "r", 3600)  # wynik i podbicia tylko z biletu zweryfikowanego przez /end
        if not gr:
            return cors(req, {"error": "Nieważny wynik gry — odśwież stronę (nowa wersja gry)."}, 400)
        score, hits, flags = gr["score"], gr["hits"] or None, gr.get("flags") or []
        if len(nick) < 3 or not 0 < score <= 100000:
            return cors(req, {"error": "zły nick lub wynik"}, 400)
        ball = str(j.get("ball", ""))[:30] or None
        ball_uid = str(j.get("ballUid", ""))[:12] if str(j.get("ballUid", "")).isdigit() else None
        dev = j.get("dev") if j.get("dev") in ("m", "d") else None
        key = ip_key(req)
        eqk = j.get("key") if isinstance(j.get("key"), str) and KEY_RE.match(j.get("key")) else None
        eq_id, ses, acc = (eq_ref(eqk).id if eqk else None), None, {}
        if KONTA and "token" in j:  # zalogowany: zawsze nick i ekwipunek konta
            ses = session_of(j.get("token"))
            if not ses:
                return relogin(req)
            nick, eq_id = ses["nick"], ses["eq"]
        elif KONTA:  # nick z kontem zapisuje wynik tylko z zalogowanego urządzenia (też rankingi dnia i tygodnia)
            acc = nick_ref(nick, ACC).get().to_dict() or {}
            if acc.get("pw"):
                return cors(req, {"error": f"Nick {acc['nick']} ma konto — zaloguj się, żeby zapisać wynik.", "need": "login", "nick": acc["nick"]}, 403)
        # ten sam gracz mimo emotek/spacji/znaków: porównujemy tylko litery i cyfry
        nl = nick_low(nick)
        okres = j.get("okres") if j.get("okres") in ("d", "w") else "a"
        keys = period_keys()
        # jeden wpis na nick: ranking ogólny + ranking dnia i tygodnia (w każdym najlepsza gra z danego okresu)
        refs = [nick_ref(nick)] + [nick_ref(nick, col_of(o, keys)) for o in ("d", "w")]

        @firestore.transactional
        def save(tx):
            prevs = [(r, (s.to_dict() if s.exists else {})) for r in refs for s in [r.get(transaction=tx)]]  # najpierw wszystkie odczyty, potem zapisy
            out = None
            for i, (r, prev) in enumerate(prevs):
                doc = {"nick": nick, "nickLower": nl, "ip": key, "ts": int(time.time())}
                if score >= prev.get("score", 0):  # nowy rekord: zapisujemy też, ile podbić, czyim awatarem i ekwipunek z tej gry
                    doc.update(score=score, hits=hits, ball=ball, ballUid=ball_uid, dev=dev, flags=flags)
                    doc["eq"] = eq_id or firestore.DELETE_FIELD  # tylko skrót klucza; rekord bez klucza nie zostawia cudzego ekwipunku
                if i == 0 and "claimEq" not in prev:
                    # urządzenie, z którego da się od razu założyć konto na ten nick: zamrożone (urządzenie rekordu sprzed kont albo to, które założyło wpis),
                    # bo wynik nie jest weryfikowany i fałszywy rekord nie może przenieść prawa do nicku
                    doc["claimEq"] = (prev.get("eq") or "") if prev else (eq_id or "")
                doc["plays"] = prev.get("plays", 0) + 1  # licznik rozegranych (zapisanych) gier
                tx.set(r, doc, merge=True)
                if i == 0:  # „me” z rankingu ogólnego; claim: to urządzenie gościa może od razu założyć konto na ten nick
                    out = {"best": max(score, prev.get("score", 0)), "plays": doc["plays"], "record": score >= prev.get("score", 0), "konto": bool(ses),
                           "claim": bool(KONTA and not ses and not acc and eq_id and doc.get("claimEq", prev.get("claimEq")) == eq_id)}
            return out
        me = save(db.transaction())
        # (bez kasowania wpisów „z tego samego adresu”: telefony w sieci komórkowej dzielą jeden adres między wielu ludzi)
        return cors(req, {**ranking(nick, okres), "me": me})
    return cors(req, {"error": "metoda"}, 405)
