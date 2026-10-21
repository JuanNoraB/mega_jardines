"""Bot de WhatsApp de Mega Jardines (WhatsApp Cloud API de Meta).

Muestra el catálogo y los servicios con menús numerados, busca productos por
nombre y, cuando no entiende o el cliente lo pide, lo pasa a un asesor humano.

Solo usa la librería estándar de Python 3.9+.

    python bot.py            -> servidor webhook (producción)
    python bot.py --cli      -> simulador en la terminal (pruebas)
"""
import csv
import hashlib
import hmac
import json
import os
import sys
import threading
import time
import unicodedata
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent

# ---------------------------------------------------------------- configuración
CFG = {
    "WA_TOKEN": os.environ.get("WA_TOKEN", ""),              # token de acceso de Meta
    "WA_PHONE_ID": os.environ.get("WA_PHONE_ID", ""),        # Phone number ID del bot
    "WA_VERIFY_TOKEN": os.environ.get("WA_VERIFY_TOKEN", "megajardines"),
    "WA_APP_SECRET": os.environ.get("WA_APP_SECRET", ""),    # para validar la firma de Meta
    "ASESOR_WHATSAPP": os.environ.get("ASESOR_WHATSAPP", "593996679763"),
    "IMAGE_BASE_URL": os.environ.get("IMAGE_BASE_URL", "https://www.megajardines.com/"),
    "PORT": int(os.environ.get("PORT", "8080")),
    "DRY_RUN": os.environ.get("DRY_RUN", "") == "1",          # 1 = no envía, solo imprime
    "GRAPH_URL": os.environ.get("GRAPH_URL", "https://graph.facebook.com/v21.0"),
}
PAGE_SIZE = 10
MAX_FAILS = 2                 # intentos no entendidos antes de pasar al asesor
HANDOFF_HOURS = 12            # horas que el bot se queda callado tras pasar al asesor

# ---------------------------------------------------------------------- datos
def norm(s):
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower().strip()


def load_data():
    with open(HERE / "data" / "productos.csv", encoding="utf-8") as f:
        products = list(csv.DictReader(f))
    with open(HERE / "data" / "servicios.csv", encoding="utf-8") as f:
        services = list(csv.DictReader(f))
    for p in products:
        p["cats"] = [c for c in p["categoria"].split("|") if c]
        p["_key"] = norm(p["nombre"] + " " + p["grupo"] + " " + " ".join(p["cats"]))
    groups = []
    for p in products:
        if p["grupo"] not in groups:
            groups.append(p["grupo"])
    return products, services, groups


PRODUCTS, SERVICES, GROUPS = load_data()


def categories(group):
    cats = []
    for p in PRODUCTS:
        if p["grupo"] == group:
            for c in p["cats"]:
                if c not in cats:
                    cats.append(c)
    return sorted(cats, key=norm)


def price(p):
    return f"${float(p['precio']):.2f}" if p["precio"] else "consultar precio"


def search(text):
    words = [w for w in norm(text).split() if len(w) > 2]
    if not words:
        return []
    scored = []
    for p in PRODUCTS:
        hits = sum(1 for w in words if w in p["_key"] or (w.endswith("s") and w[:-1] in p["_key"]))
        if hits:
            scored.append((-hits, p["nombre"], p))
    return [p for _, _, p in sorted(scored, key=lambda x: (x[0], x[1]))]


# ------------------------------------------------------------------- mensajes
MENU = (
    "🌿 *Mega Jardines* – vivero y jardinería en Quito\n\n"
    "Escribe el número de lo que necesitas:\n"
    "1️⃣ Ver catálogo de productos\n"
    "2️⃣ Ver servicios\n"
    "3️⃣ Buscar un producto\n"
    "4️⃣ Hablar con un asesor\n\n"
    "También puedes escribir directamente lo que buscas, por ejemplo: *orquídea*."
)
HINT = "\n\n_0 = menú principal · escribe *asesor* para hablar con una persona_"
ASESOR_WORDS = {"asesor", "humano", "persona", "agente", "ayuda", "cotizar", "cotizacion", "comprar", "pedido"}
MENU_WORDS = {"0", "menu", "inicio", "hola", "buenas", "buenos dias", "buenas tardes", "buenas noches", "volver"}


def text_msg(body):
    return {"type": "text", "text": body}


def image_msg(url, caption):
    return {"type": "image", "url": url, "caption": caption}


def numbered(items):
    return "\n".join(f"*{i}.* {it}" for i, it in enumerate(items, 1))


def product_list_page(s):
    items = s["items"]
    start = s["page"] * PAGE_SIZE
    chunk = items[start:start + PAGE_SIZE]
    lines = [f"*{start + i}.* {p['nombre']} – {price(p)}" for i, p in enumerate(chunk, 1)]
    body = f"*{s['title']}* ({len(items)} productos)\n\n" + "\n".join(lines)
    body += "\n\nEscribe el número para ver la foto."
    if start + PAGE_SIZE < len(items):
        body += "\nEscribe *más* para ver más productos."
    return body + HINT


# ------------------------------------------------------------------- sesiones
SESSIONS = {}


def session(user):
    s = SESSIONS.get(user)
    if not s:
        s = SESSIONS[user] = {"state": "new", "fails": 0, "handoff_until": 0, "last": "", "items": [], "page": 0, "title": ""}
    return s


def handoff(s, reason=""):
    s["state"] = "handoff"
    s["fails"] = 0
    s["handoff_until"] = time.time() + HANDOFF_HOURS * 3600
    detalle = s["last"] or reason or "información"
    link = "https://wa.me/{}?text={}".format(
        CFG["ASESOR_WHATSAPP"], urllib.parse.quote(f"Hola, vengo del asistente de Mega Jardines. Me interesa: {detalle}"))
    return [text_msg(
        "👩‍🌾 Te comunico con un asesor especializado.\n\n"
        f"Escríbele aquí y te atiende personalmente:\n{link}\n\n"
        "Si quieres volver al asistente, escribe *menú*.")]


def not_understood(s):
    s["fails"] += 1
    if s["fails"] >= MAX_FAILS:
        return handoff(s, "ayuda con mi consulta")
    return [text_msg("No entendí tu mensaje 🙈. Responde con un número de la lista o escribe el nombre de una planta." + HINT)]


def show_menu(s):
    s.update(state="menu", fails=0, handoff_until=0, last="")
    return [text_msg(MENU)]


def show_results(s, query):
    found = search(query)
    if not found:
        s["last"] = query
        s["fails"] += 1
        if s["fails"] >= MAX_FAILS:
            return handoff(s)
        return [text_msg(f"No encontré productos con *{query}*. Prueba con otra palabra (ej. cactus, maceta, palmera)." + HINT)]
    s.update(state="products", items=found, page=0, title=f"Resultados para \"{query}\"", fails=0, last=query)
    return [text_msg(product_list_page(s))]


def handle(user, text):
    """Recibe el texto del cliente y devuelve la lista de mensajes a enviar."""
    s = session(user)
    t = norm(text)

    if s["state"] == "handoff":
        if t in MENU_WORDS or t == "menu":
            return show_menu(s)
        if time.time() < s["handoff_until"]:
            return []          # lo atiende el asesor: el bot no interrumpe
        return show_menu(s)

    if s["state"] == "new" or t in MENU_WORDS:
        return show_menu(s)
    if (t == "4" and s["state"] == "menu") or set(t.split()) & ASESOR_WORDS:
        return handoff(s)

    st = s["state"]
    if st == "menu":
        if t == "1":
            s.update(state="groups", fails=0)
            return [text_msg("📦 *Catálogo*\n\n" + numbered(GROUPS) + "\n\nEscribe el número de la sección." + HINT)]
        if t == "2":
            s.update(state="services", fails=0)
            return [text_msg("🛠️ *Servicios*\n\n" + numbered([x["nombre"] for x in SERVICES]) + "\n\nEscribe el número para ver el detalle." + HINT)]
        if t == "3":
            s.update(state="search", fails=0)
            return [text_msg("🔎 Escribe el nombre del producto que buscas (ej. *bonsái*, *maceta*, *piedra*)." + HINT)]
        if t.isdigit():
            return not_understood(s)
        return show_results(s, text.strip())

    if st == "groups":
        if t.isdigit() and 1 <= int(t) <= len(GROUPS):
            g = GROUPS[int(t) - 1]
            cats = categories(g)
            if len(cats) <= 1:
                items = [p for p in PRODUCTS if p["grupo"] == g]
                s.update(state="products", items=items, page=0, title=g, fails=0, last=g)
                return [text_msg(product_list_page(s))]
            s.update(state="cats", group=g, cats=cats, fails=0)
            return [text_msg(f"*{g}*\n\n" + numbered(cats) + "\n\nEscribe el número de la categoría." + HINT)]
        return show_results(s, text.strip()) if not t.isdigit() else not_understood(s)

    if st == "cats":
        if t.isdigit() and 1 <= int(t) <= len(s["cats"]):
            c = s["cats"][int(t) - 1]
            items = [p for p in PRODUCTS if c in p["cats"]]
            s.update(state="products", items=items, page=0, title=c, fails=0, last=c)
            return [text_msg(product_list_page(s))]
        return show_results(s, text.strip()) if not t.isdigit() else not_understood(s)

    if st in ("products", "photo"):
        if t in ("mas", "más", "siguiente", "+"):
            if (s["page"] + 1) * PAGE_SIZE < len(s["items"]):
                s["page"] += 1
                return [text_msg(product_list_page(s))]
            return [text_msg("Ya viste todos los productos de esta lista." + HINT)]
        if t.isdigit() and 1 <= int(t) <= len(s["items"]):
            p = s["items"][int(t) - 1]
            s.update(state="photo", fails=0, last=f"{p['nombre']} ({price(p)})")
            caption = f"*{p['nombre']}*\n{price(p)}\n\nPara pedirlo escribe *asesor* y te atiende una persona." + HINT
            if p["imagen"]:
                return [image_msg(CFG["IMAGE_BASE_URL"] + p["imagen"], caption)]
            return [text_msg(caption)]
        return show_results(s, text.strip()) if not t.isdigit() else not_understood(s)

    if st == "services" or st == "service":
        if t.isdigit() and 1 <= int(t) <= len(SERVICES):
            x = SERVICES[int(t) - 1]
            s.update(state="service", fails=0, last=x["nombre"])
            incluye = "\n".join("• " + i for i in x["incluye"].split("|"))
            return [text_msg(f"*{x['nombre']}*\n{x['descripcion']}\n\nIncluye:\n{incluye}\n\n"
                             "Cada trabajo se cotiza según tu espacio. Escribe *asesor* para que te den el presupuesto." + HINT)]
        return not_understood(s)

    if st == "search":
        return show_results(s, text.strip())

    return show_menu(s)


# ----------------------------------------------------------- envío a WhatsApp
def send(to, msg):
    if msg["type"] == "text":
        payload = {"messaging_product": "whatsapp", "to": to, "type": "text", "text": {"body": msg["text"][:4096]}}
    else:
        payload = {"messaging_product": "whatsapp", "to": to, "type": "image",
                   "image": {"link": msg["url"], "caption": msg["caption"][:1024]}}
    if CFG["DRY_RUN"]:
        print("SEND", json.dumps(payload, ensure_ascii=False), flush=True)
        return
    req = urllib.request.Request(
        f"{CFG['GRAPH_URL']}/{CFG['WA_PHONE_ID']}/messages",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {CFG['WA_TOKEN']}", "Content-Type": "application/json"},
    )
    try:
        urllib.request.urlopen(req, timeout=20).read()
    except Exception as e:  # noqa: BLE001 - se registra y se sigue
        print("ERROR enviando a", to, e, getattr(e, "read", lambda: b"")()[:300], file=sys.stderr, flush=True)


SEEN = {}


def process(body):
    for entry in body.get("entry", []):
        for change in entry.get("changes", []):
            for m in change.get("value", {}).get("messages", []):
                if m.get("id") in SEEN:
                    continue                      # Meta a veces reenvía el mismo mensaje
                SEEN[m.get("id")] = time.time()
                user = m.get("from")
                if m.get("type") == "text":
                    replies = handle(user, m["text"]["body"])
                elif m.get("type") == "interactive":
                    r = m["interactive"].get("button_reply") or m["interactive"].get("list_reply") or {}
                    replies = handle(user, r.get("id") or r.get("title", ""))
                else:                             # audio, foto, ubicación...: mejor una persona
                    s = session(user)
                    replies = [] if s["state"] == "handoff" and time.time() < s["handoff_until"] else handoff(s, "consulta enviada por audio o foto")
                for r in replies:
                    send(user, r)
    cutoff = time.time() - 3600
    for k in [k for k, v in SEEN.items() if v < cutoff]:
        SEEN.pop(k, None)


class Webhook(BaseHTTPRequestHandler):
    def do_GET(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        if q.get("hub.mode", [""])[0] == "subscribe" and q.get("hub.verify_token", [""])[0] == CFG["WA_VERIFY_TOKEN"]:
            self._reply(200, q.get("hub.challenge", [""])[0])
        elif self.path in ("/", "/health"):
            self._reply(200, "ok")
        else:
            self._reply(403, "forbidden")

    def do_POST(self):
        raw = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if CFG["WA_APP_SECRET"]:
            expected = "sha256=" + hmac.new(CFG["WA_APP_SECRET"].encode(), raw, hashlib.sha256).hexdigest()
            if not hmac.compare_digest(expected, self.headers.get("X-Hub-Signature-256", "")):
                return self._reply(403, "bad signature")
        self._reply(200, "ok")                    # Meta exige respuesta rápida
        try:
            body = json.loads(raw or b"{}")
        except ValueError:
            return
        threading.Thread(target=process, args=(body,), daemon=True).start()

    def _reply(self, code, text):
        self.send_response(code)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(text.encode("utf-8"))

    def log_message(self, fmt, *args):
        print("%s %s" % (self.address_string(), fmt % args), flush=True)


def cli():
    print("Simulador del bot de Mega Jardines. Escribe 'salir' para terminar.\n")
    for line in sys.stdin:
        line = line.rstrip("\n")
        if line.strip().lower() == "salir":
            break
        print(f"\n> {line}")
        for r in handle("cli-user", line):
            if r["type"] == "text":
                print(r["text"])
            else:
                print(f"[IMAGEN] {r['url']}\n{r['caption']}")
        print("-" * 40)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    if "--cli" in sys.argv:
        sys.stdin.reconfigure(encoding="utf-8")
        cli()
    else:
        missing = [k for k in ("WA_TOKEN", "WA_PHONE_ID") if not CFG[k]]
        if missing and not CFG["DRY_RUN"]:
            sys.exit(f"Faltan variables de entorno: {', '.join(missing)} (ver .env.example)")
        print(f"Bot escuchando en el puerto {CFG['PORT']} · {len(PRODUCTS)} productos · {len(SERVICES)} servicios", flush=True)
        ThreadingHTTPServer(("0.0.0.0", CFG["PORT"]), Webhook).serve_forever()
