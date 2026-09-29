# Ranking gry "piłeczka": GET -> top 20, POST {nick, score} -> jeden wpis na adres IP (najlepszy wynik, ostatni nick).
# IP nie jest zapisywane wprost — tylko jego skrót (sha256 z solą).
import hashlib, ipaddress, os, re, time
import functions_framework
from google.cloud import firestore

db = firestore.Client()
COL = db.collection("pileczka")
SALT = os.environ.get("SALT", "d2jsp-pileczka")
ORIGINS = {"https://kruszkush.github.io", "http://localhost:8765"}

def cors(req, body, status=200):
    o = req.headers.get("Origin", "")
    h = {"Access-Control-Allow-Origin": o if o in ORIGINS else "https://kruszkush.github.io",
         "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin"}
    return body, status, h

def top():
    return [{"nick": d.get("nick"), "score": d.get("score")} for d in
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

@functions_framework.http
def pileczka(req):
    if req.method == "OPTIONS":
        return cors(req, "", 204)
    if req.method == "GET":
        return cors(req, {"top": top()})
    if req.method == "POST":
        j = req.get_json(silent=True) or {}
        nick = re.sub(r"\s+", " ", str(j.get("nick", ""))).strip()[:20]
        score = j.get("score")
        if not nick or not isinstance(score, int) or not 0 < score <= 100000:
            return cors(req, {"error": "zły nick lub wynik"}, 400)
        key = ip_key(req)
        ref = COL.document(key)

        @firestore.transactional
        def save(tx):
            old = ref.get(transaction=tx)
            best = max(score, old.get("score")) if old.exists else score
            tx.set(ref, {"nick": nick, "nickLower": nick.lower(), "score": best, "ip": key, "ts": int(time.time())})
        save(db.transaction())
        # sprzątanie: inne wpisy z tego samego IP (np. starsze) usuwamy
        for d in COL.where("ip", "==", key).stream():
            if d.id != key:
                d.reference.delete()
        for d in COL.where("nick", "==", nick).stream():  # stary wpis bez IP z tym samym nickiem
            if "ip" not in d.to_dict():
                d.reference.delete()
        return cors(req, {"top": top()})
    return cors(req, {"error": "metoda"}, 405)
