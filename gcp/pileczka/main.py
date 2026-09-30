# Ranking gry "piłeczka": GET -> top 20, POST {nick, score} -> jeden wpis na adres IP (najlepszy wynik, ostatni nick).
# IP nie jest zapisywane wprost — tylko jego skrót (sha256 z solą).
import hashlib, ipaddress, os, random, re, secrets, time
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
    return [{"nick": d.get("nick"), "score": d.get("score"), "hits": d.get("hits"), "ball": d.get("ball"), "ballUid": d.get("ballUid"), "dev": d.get("dev")} for d in
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
PREFIXES = ("iron", "gold", "crown", "shadow", "storm")  # nazwy po polsku składa klient
SUFFIXES = ("bear", "fox", "tiger", "wolf", "eagle", "snake", "speed")
KEY_RE = re.compile(r"^[0-9a-f]{32}$")
DROP_MIN, DROP_GAP = 15, 15
# punkty kontrolne: wynik -> (normalne, magiczne, rzadkie) w %; poniżej 30 i powyżej 150 stałe
CHECK = [(30, (85, 14, 1)), (60, (65, 30, 5)), (100, (45, 42, 13)), (150, (30, 45, 25))]

def rarity_weights(score):
    if score <= CHECK[0][0]:
        return CHECK[0][1]
    if score >= CHECK[-1][0]:
        return CHECK[-1][1]
    for (s0, w0), (s1, w1) in zip(CHECK, CHECK[1:]):
        if s0 <= score <= s1:
            t = (score - s0) / (s1 - s0)
            return tuple(a + (b - a) * t for a, b in zip(w0, w1))

def roll_item(score, uid, nick):
    w = rarity_weights(score)
    rarity = random.choices(("n", "m", "r"), weights=w)[0]
    prefix = suffix = None
    if rarity == "r":
        prefix, suffix = random.choice(PREFIXES), random.choice(SUFFIXES)
    elif rarity == "m":
        if random.random() < .3:
            prefix, suffix = random.choice(PREFIXES), random.choice(SUFFIXES)
        elif random.random() < .5:
            prefix = random.choice(PREFIXES)
        else:
            suffix = random.choice(SUFFIXES)
    return {"v": 1, "id": secrets.token_hex(6), "slot": random.choice(SLOTS), "rarity": rarity, "uid": uid, "unick": nick,
            "prefix": prefix, "suffix": suffix, "ilvl": score, "ts": int(time.time()), "stats": {}}

def eq_ref(key):
    return EQ.document(hashlib.sha256(key.encode()).hexdigest()[:40])

def eq_state(d):
    return {"slots": {s: (d.get("slots") or {}).get(s) for s in SLOTS}, "pending": d.get("pending")}

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
        item = roll_item(score, uid, nick)
        st = eq_state(d)
        d["slots"], d["pending"], d["lastDropTs"], d["lastGameId"] = st["slots"], st["pending"], now, gid
        if d["slots"][item["slot"]] is None:
            d["slots"][item["slot"]] = item
            d["pending"] = None
            out = {"drop": item, "equipped": True}
        else:
            d["pending"] = item
            out = {"drop": item, "current": d["slots"][item["slot"]]}
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

EQ_ROUTES = {"/drop": eq_drop, "/inv": eq_inv, "/equip": eq_equip}

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
        if not nick or not isinstance(score, int) or not 0 < score <= 100000:
            return cors(req, {"error": "zły nick lub wynik"}, 400)
        hits = j.get("hits") if isinstance(j.get("hits"), int) and 0 < j.get("hits") <= 100000 else None
        ball = str(j.get("ball", ""))[:30] or None
        ball_uid = str(j.get("ballUid", ""))[:12] if str(j.get("ballUid", "")).isdigit() else None
        dev = j.get("dev") if j.get("dev") in ("m", "d") else None
        key = ip_key(req)
        # ten sam gracz mimo emotek/spacji/znaków: porównujemy tylko litery i cyfry
        nl = re.sub(r"[^0-9a-ząćęłńóśźż]", "", nick.lower()) or nick.lower()
        ref = COL.document(hashlib.sha256(("nick:" + nl).encode()).hexdigest()[:32])  # jeden wpis na nick

        @firestore.transactional
        def save(tx):
            old = ref.get(transaction=tx)
            prev = old.to_dict() if old.exists else {}
            doc = {"nick": nick, "nickLower": nl, "ip": key, "ts": int(time.time())}
            if score >= prev.get("score", 0):  # nowy rekord: zapisujemy też, ile podbić i czyim awatarem
                doc.update(score=score, hits=hits, ball=ball, ballUid=ball_uid, dev=dev)
            tx.set(ref, doc, merge=True)
        save(db.transaction())
        # (bez kasowania wpisów „z tego samego adresu”: telefony w sieci komórkowej dzielą jeden adres między wielu ludzi)
        return cors(req, {"top": top()})
    return cors(req, {"error": "metoda"}, 405)
