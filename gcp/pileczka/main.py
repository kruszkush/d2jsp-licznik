# Ranking gry "piłeczka": GET -> top 20, POST {nick, score} -> zapis najlepszego wyniku danego nicku (Firestore).
import re, time
import functions_framework
from google.cloud import firestore

db = firestore.Client()
COL = db.collection("pileczka")
ORIGINS = {"https://kruszkush.github.io", "http://localhost:8765"}

def cors(req, body, status=200):
    o = req.headers.get("Origin", "")
    h = {"Access-Control-Allow-Origin": o if o in ORIGINS else "https://kruszkush.github.io",
         "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin"}
    return body, status, h

def top():
    return [{"nick": d.get("nick"), "score": d.get("score")} for d in
            (x.to_dict() for x in COL.order_by("score", direction=firestore.Query.DESCENDING).limit(20).stream())]

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
        if not nick or not isinstance(score, int) or not 0 < score <= 5000:
            return cors(req, {"error": "zły nick lub wynik"}, 400)
        ref = COL.document(re.sub(r"[^a-z0-9_\-ąćęłńóśźż ]", "_", nick.lower()) or "_")

        @firestore.transactional
        def save(tx):
            old = ref.get(transaction=tx)
            if not old.exists or old.get("score") < score:
                tx.set(ref, {"nick": nick, "score": score, "ts": int(time.time())})
        save(db.transaction())
        return cors(req, {"top": top()})
    return cors(req, {"error": "metoda"}, 405)
