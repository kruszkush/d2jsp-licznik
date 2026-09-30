# Ranking gry "piłeczka": GET -> top 20, POST {nick, score} -> jeden wpis na adres IP (najlepszy wynik, ostatni nick).
# IP nie jest zapisywane wprost — tylko jego skrót (sha256 z solą).
import hashlib, math, ipaddress, os, random, re, secrets, time
import functions_framework
from google.cloud import firestore

db = firestore.Client()
SUFFIX = os.environ.get("SUFFIX", "")  # wersja testowa: osobne kolekcje (pileczka_test, ekwipunek_test)
COL = db.collection(f"pileczka{SUFFIX}")
EQ = db.collection(f"ekwipunek{SUFFIX}")
SALT = os.environ.get("SALT", "d2jsp-pileczka")
ORIGINS = {"https://kruszkush.github.io", "http://localhost:8765"}

def cors(req, body, status=200):
    o = req.headers.get("Origin", "")
    h = {"Access-Control-Allow-Origin": o if o in ORIGINS else "https://kruszkush.github.io",
         "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin"}
    return body, status, h

def top():
    return [{"nick": d.get("nick"), "score": d.get("score"), "hits": d.get("hits"), "ball": d.get("ball"), "ballUid": d.get("ballUid"), "dev": d.get("dev"), "eq": d.get("eq"), "plays": d.get("plays")} for d in
            (x.to_dict() for x in COL.order_by("score", direction=firestore.Query.DESCENDING).limit(20).stream())]

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
}
PRE_IDS = tuple(k for k, v in AFF.items() if v[0] == "p")
SUF_IDS = tuple(k for k, v in AFF.items() if v[0] == "s")
UNIQUE_MIN_SCORE = 50
def unique_chance(score):  # 0.3% od 50 pkt, liniowo do 0.8% przy 150 pkt
    return 0 if score < 50 else (0.003 + 0.005 * min(1, (score - 50) / 100))

def drop_chance(score):  # szansa, że w ogóle coś wypadnie: wynik/80 (od 80 pkt zawsze)
    return min(1.0, score / 80)
KEY_RE = re.compile(r"^[0-9a-f]{32}$")
EQID_RE = re.compile(r"^[0-9a-f]{40}$")
DROP_MIN, DROP_GAP = 15, 15
# punkty kontrolne: wynik -> (normalne, magiczne, rzadkie) w %; poniżej 30 i powyżej 150 stałe
# Szanse rzadkości rosną płynnie (liniowo między punktami, bez schodków) aż do 1000 pkt; dalej bez zmian.
R_PTS = [(15, 0.25), (100, 1.25), (300, 3), (600, 5), (1000, 12.5)]  # rzadkie o 75% rzadziej (30.09)
M_PTS = [(15, 14), (100, 25), (300, 35), (600, 42), (1000, 45)]

def _curve(pts, x):
    x = max(pts[0][0], min(x, pts[-1][0]))
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return pts[-1][1]

def rarity_weights(score):
    r, m = _curve(R_PTS, score), _curve(M_PTS, score)
    return (max(5.0, 100 - m - r), m, r)

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
    extra = r * min(luck, 100) / 100  # szczęśliwy: +X% (względnie) do szansy na rzadki, kosztem normalnego
    n, r = n - extra, r + extra
    return random.choices(("n", "m", "r"), weights=(n, m, r))[0]

def make_item(slot, rarity, affixes, uid=None, nick=None, ilvl=0, mult=0.1):
    return {"v": 2, "id": secrets.token_hex(6), "slot": slot, "rarity": rarity, "uid": uid, "unick": nick, "ilvl": ilvl,
            "ts": int(time.time()), "implicit": {"mult": mult}, "affixes": affixes}

# klasy afiksów i ich waga losowania (łączna na klasę dzielona po równo między afiksy tej klasy)
TIER = {"stlumiony": "slaby", "zreczny": "slaby", "olbrzyma": "slaby",
        "lowcy": "dobry", "ciezki": "dobry",
        "wytrwalosci": "dobry", "rozpedzony": "znakomity", "szczesliwy": "dobry", "brawurowy": "znakomity", "zuchwaly": "znakomity", "echa": "znakomity",
        "ostry": "boski", "serii": "boski", "stroza": "boski"}
_TW = {"slaby": 55, "dobry": 35, "znakomity": 7, "boski": 3}
TIER_W = {t: _TW[t] / sum(1 for x in TIER.values() if x == t) for t in _TW}

def roll_item(score, uid, nick, luck=0):
    slot = random.choice(SLOTS)
    if random.random() < unique_chance(score) * (1 + min(luck, 100) / 100):  # szczęśliwy zwiększa też szansę na unikat
        rarity = "u"  # unikat losowany przed tabelą rzadkości
        slot = random.choice(("helm", "boots"))  # na razie unikaty tylko: Korona Króla Forum i Kapcie Moderatora
    else:
        rarity = pick_rarity(score, luck)
    # afiksy losowane wg klasy (słaby > dobry > znakomity > boski); mogą się powtarzać na jednym przedmiocie
    ids = list(TIER)
    if rarity == "u":  # unikat: +0.3x, jeden gwarantowany boski afiks (równe szanse w klasie) + 2 losowe wg zwykłych wag
        gods = [i for i in ids if TIER[i] == "boski"]
        picks = [random.choice(gods)] + random.choices(ids, weights=[TIER_W[TIER[i]] for i in ids], k=2)
        return make_item(slot, rarity, [{"id": a, "v": roll_val(a)} for a in picks], uid, nick, score, mult=0.3)
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

def eq_drop(req, j):
    key = eq_key(j)
    gid, score = j.get("gameId"), j.get("score")
    if not key or not isinstance(gid, str) or not 0 < len(gid) <= 40 or not isinstance(score, int) or isinstance(score, bool) or not 0 <= score <= 100000:
        return cors(req, {"error": "zły klucz, gra lub wynik"}, 400)
    if score < DROP_MIN:
        return cors(req, {"drop": None})
    uid = str(j.get("ballUid", ""))[:12] if str(j.get("ballUid", "")).isdigit() else None
    nick = str(j.get("ballNick", ""))[:30] or None
    ref = eq_ref(key)

    @firestore.transactional
    def run(tx):
        snap = ref.get(transaction=tx)
        d = snap.to_dict() if snap.exists else {}
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
    return cors(req, run(db.transaction()))

def eq_inv(req, j):
    key = eq_key(j)
    if not key:
        return cors(req, {"error": "zły klucz"}, 400)
    snap = eq_ref(key).get()
    return cors(req, eq_state(snap.to_dict() if snap.exists else {}))

def eq_equip(req, j):
    key, iid, action = eq_key(j), j.get("id"), j.get("action")
    if not key or not isinstance(iid, str) or action not in ("equip", "discard"):
        return cors(req, {"error": "zły klucz lub akcja"}, 400)
    ref = eq_ref(key)

    @firestore.transactional
    def run(tx):
        snap = ref.get(transaction=tx)
        d = snap.to_dict() if snap.exists else {}
        st = eq_state(d)
        p = st["pending"]
        if not p or p.get("id") != iid:
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
    key, slot, rarity, aff = eq_key(j), j.get("slot"), j.get("rarity"), j.get("affixes") or []
    if not key or slot not in SLOTS or rarity not in ("n", "m", "r", "u") or not isinstance(aff, list):
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
    ref = eq_ref(key)
    snap = ref.get()
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

EQ_ROUTES = {"/drop": eq_drop, "/inv": eq_inv, "/equip": eq_equip, "/grant": eq_grant, "/view": eq_view}

@functions_framework.http
def pileczka(req):
    if req.method == "OPTIONS":
        return cors(req, "", 204)
    h = EQ_ROUTES.get(req.path.rstrip("/") or "/")
    if h:  # ekwipunek: osobna ścieżka, błąd tutaj nie dotyka rankingu
        if req.method != "POST":
            return cors(req, {"error": "metoda"}, 405)
        try:
            return h(req, req.get_json(silent=True) or {})
        except Exception as e:
            print("ekwipunek:", repr(e))
            return cors(req, {"error": "błąd ekwipunku"}, 500)
    if req.method == "GET":
        return cors(req, {"top": top()})
    if req.method == "POST":
        j = req.get_json(silent=True) or {}
        nick = re.sub(r"\s+", " ", str(j.get("nick", ""))).strip()[:20]
        score = j.get("score")
        if len(nick) < 3 or not isinstance(score, int) or not 0 < score <= 100000:
            return cors(req, {"error": "zły nick lub wynik"}, 400)
        hits = j.get("hits") if isinstance(j.get("hits"), int) and 0 < j.get("hits") <= 100000 else None
        ball = str(j.get("ball", ""))[:30] or None
        ball_uid = str(j.get("ballUid", ""))[:12] if str(j.get("ballUid", "")).isdigit() else None
        dev = j.get("dev") if j.get("dev") in ("m", "d") else None
        key = ip_key(req)
        eqk = j.get("key") if isinstance(j.get("key"), str) and KEY_RE.match(j.get("key")) else None
        # ten sam gracz mimo emotek/spacji/znaków: porównujemy tylko litery i cyfry
        nl = re.sub(r"[^0-9a-ząćęłńóśźż]", "", nick.lower()) or nick.lower()
        ref = COL.document(hashlib.sha256(("nick:" + nl).encode()).hexdigest()[:32])  # jeden wpis na nick

        @firestore.transactional
        def save(tx):
            old = ref.get(transaction=tx)
            prev = old.to_dict() if old.exists else {}
            doc = {"nick": nick, "nickLower": nl, "ip": key, "ts": int(time.time())}
            if score >= prev.get("score", 0):  # nowy rekord: zapisujemy też, ile podbić, czyim awatarem i ekwipunek z tej gry
                doc.update(score=score, hits=hits, ball=ball, ballUid=ball_uid, dev=dev)
                doc["eq"] = eq_ref(eqk).id if eqk else firestore.DELETE_FIELD  # tylko skrót klucza; rekord bez klucza nie zostawia cudzego ekwipunku
            doc["plays"] = prev.get("plays", 0) + 1  # licznik rozegranych (zapisanych) gier
            tx.set(ref, doc, merge=True)
            return {"best": max(score, prev.get("score", 0)), "plays": doc["plays"], "record": score >= prev.get("score", 0)}
        me = save(db.transaction())
        # (bez kasowania wpisów „z tego samego adresu”: telefony w sieci komórkowej dzielą jeden adres między wielu ludzi)
        return cors(req, {"top": top(), "me": me})
    return cors(req, {"error": "metoda"}, 405)
