"""
Bloomfield Cricket & Cultural Club — Backend API Server
========================================================
Pure-Python HTTP server (no Flask/Django dependency).
Runs on port 5050 by default.

    python backend/server.py

Environment variables:
    BCCC_ENV              production | development (default: development)
    BCCC_DB_DRIVER        sqlite | postgres (default: sqlite)
    BCCC_TOKEN_SECRET     HMAC signing key (MUST be strong in production)
    BCCC_ADMIN_PASSWORD   Admin portal password
    BCCC_UPLOAD_BACKEND   local | s3 (default: local)
    BCCC_CORS_ORIGINS     comma-separated allowed origins
"""

import hashlib, hmac, json, os, re, secrets, shutil, sqlite3, struct, time, uuid
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

# ─── Configuration ───────────────────────────────────────────────

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "backend" / "bccc.db"
UPLOAD_DIR = BASE_DIR / "assets" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ENV = os.getenv("BCCC_ENV", "development")
TOKEN_SECRET = os.getenv("BCCC_TOKEN_SECRET", "dev-secret-change-me")
ADMIN_PASSWORD = os.getenv("BCCC_ADMIN_PASSWORD", "admin")
CORS_ORIGINS = [o.strip() for o in os.getenv("BCCC_CORS_ORIGINS", "*").split(",")]
PORT = int(os.getenv("BCCC_PORT", "5050"))

if ENV == "production":
    if TOKEN_SECRET == "dev-secret-change-me":
        raise SystemExit("FATAL: Set a strong BCCC_TOKEN_SECRET in production")
    if ADMIN_PASSWORD == "admin":
        raise SystemExit("FATAL: Set a strong BCCC_ADMIN_PASSWORD in production")
    if "*" in CORS_ORIGINS:
        raise SystemExit("FATAL: Do not use wildcard CORS in production")

# ─── Database helpers ────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Create tables if they don't exist."""
    db = get_db()
    db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'member',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS site_profile (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            about_title TEXT NOT NULL DEFAULT 'About Bloomfield CC',
            about_description TEXT NOT NULL DEFAULT '',
            home_lead TEXT NOT NULL DEFAULT 'Manitoba''s Premier Cricket Community'
        );

        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            date TEXT NOT NULL,
            location TEXT NOT NULL DEFAULT '',
            image_url TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS gallery (
            id TEXT PRIMARY KEY,
            caption TEXT NOT NULL DEFAULT '',
            image_url TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS faqs (
            id TEXT PRIMARY KEY,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS cricket_programs (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            schedule TEXT NOT NULL DEFAULT '',
            level TEXT NOT NULL DEFAULT 'all'
        );

        CREATE TABLE IF NOT EXISTS payment_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            card_url TEXT NOT NULL DEFAULT '',
            paypal_url TEXT NOT NULL DEFAULT '',
            etransfer_email TEXT NOT NULL DEFAULT '',
            ticket_handler_email TEXT NOT NULL DEFAULT '',
            stripe_publishable_key TEXT NOT NULL DEFAULT '',
            stripe_secret_key TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS players (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'all-rounder',
            batting_style TEXT NOT NULL DEFAULT 'right-hand',
            bowling_style TEXT NOT NULL DEFAULT '',
            image_url TEXT NOT NULL DEFAULT '',
            bio TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS teams (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            season TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS matches (
            id TEXT PRIMARY KEY,
            opponent TEXT NOT NULL,
            date TEXT NOT NULL,
            venue TEXT NOT NULL DEFAULT '',
            result TEXT NOT NULL DEFAULT '',
            bloomfield_score TEXT NOT NULL DEFAULT '',
            opponent_score TEXT NOT NULL DEFAULT '',
            match_type TEXT NOT NULL DEFAULT 'league'
        );

        CREATE TABLE IF NOT EXISTS match_performances (
            id TEXT PRIMARY KEY,
            match_id TEXT NOT NULL,
            player_name TEXT NOT NULL,
            team TEXT NOT NULL DEFAULT 'bloomfield',
            batting_runs INTEGER NOT NULL DEFAULT 0,
            batting_balls INTEGER NOT NULL DEFAULT 0,
            batting_fours INTEGER NOT NULL DEFAULT 0,
            batting_sixes INTEGER NOT NULL DEFAULT 0,
            batting_how_out TEXT NOT NULL DEFAULT '',
            bowling_overs TEXT NOT NULL DEFAULT '',
            bowling_maidens INTEGER NOT NULL DEFAULT 0,
            bowling_runs INTEGER NOT NULL DEFAULT 0,
            bowling_wickets INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (match_id) REFERENCES matches(id)
        );

        CREATE TABLE IF NOT EXISTS tickets (
            id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL,
            buyer_name TEXT NOT NULL,
            buyer_email TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            payment_method TEXT NOT NULL DEFAULT 'etransfer',
            status TEXT NOT NULL DEFAULT 'pending_transfer',
            stripe_session_id TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (event_id) REFERENCES events(id)
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            recipient_email TEXT NOT NULL,
            subject TEXT NOT NULL DEFAULT '',
            body TEXT NOT NULL DEFAULT '',
            is_read INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS marketplace_items (
            id TEXT PRIMARY KEY,
            seller_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            price REAL NOT NULL DEFAULT 0,
            image_url TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT NOT NULL,
            FOREIGN KEY (seller_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS marketplace_messages (
            id TEXT PRIMARY KEY,
            item_id TEXT NOT NULL,
            sender_id TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (item_id) REFERENCES marketplace_items(id),
            FOREIGN KEY (sender_id) REFERENCES users(id)
        );

        -- Seed singleton rows
        INSERT OR IGNORE INTO site_profile (id) VALUES (1);
        INSERT OR IGNORE INTO payment_settings (id) VALUES (1);
    """)
    db.commit()
    db.close()


# ─── Auth helpers ────────────────────────────────────────────────

def hash_password(password, salt=None):
    if salt is None:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260000)
    return hashed.hex(), salt


def verify_password(password, stored_hash, salt):
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260000)
    return hmac.compare_digest(hashed.hex(), stored_hash)


def create_token(user_id, role):
    payload = json.dumps({"uid": user_id, "role": role, "exp": int(time.time()) + 86400 * 7})
    sig = hmac.new(TOKEN_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}|{sig}"


def verify_token(token):
    if not token or "|" not in token:
        return None
    payload_str, sig = token.rsplit("|", 1)
    expected = hmac.new(TOKEN_SECRET.encode(), payload_str.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return None
    payload = json.loads(payload_str)
    if payload.get("exp", 0) < time.time():
        return None
    return payload


# ─── Rate limiter (in-memory) ────────────────────────────────────

_rate_buckets = {}

def check_rate_limit(client_ip, scope="global", limit=60, window=60):
    now = time.time()
    key = f"{client_ip}:{scope}"
    bucket = _rate_buckets.get(key, [])
    bucket = [t for t in bucket if t > now - window]
    if len(bucket) >= limit:
        return False
    bucket.append(now)
    _rate_buckets[key] = bucket
    return True


# ─── JSON helpers ────────────────────────────────────────────────

def json_response(handler, data, status=200):
    body = json.dumps(data, default=str).encode()
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def read_json_body(handler):
    length = int(handler.headers.get("Content-Length", 0))
    if length == 0:
        return {}
    raw = handler.rfile.read(length)
    return json.loads(raw)


def error_response(handler, message, status=400):
    json_response(handler, {"error": message}, status)


def row_to_dict(row):
    if row is None:
        return None
    return dict(row)


def rows_to_list(rows):
    return [dict(r) for r in rows]


# ─── Router ──────────────────────────────────────────────────────

class Router:
    def __init__(self):
        self.routes = {"GET": [], "POST": [], "PUT": [], "DELETE": [], "HEAD": []}

    def add(self, method, pattern, handler_fn, auth=None):
        regex = re.sub(r":(\w+)", r"(?P<\1>[^/]+)", pattern)
        self.routes[method].append((re.compile(f"^{regex}$"), handler_fn, auth))

    def match(self, method, path):
        for regex, handler_fn, auth in self.routes.get(method, []):
            m = regex.match(path)
            if m:
                return handler_fn, m.groupdict(), auth
        return None, {}, None


router = Router()

# Decorator helpers
def route(method, pattern, auth=None):
    def decorator(fn):
        router.add(method, pattern, fn, auth)
        return fn
    return decorator


# ─── Request Handler ─────────────────────────────────────────────

class BCCCHandler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        ts = datetime.now().strftime("%H:%M:%S")
        print(f"[{ts}] {fmt % args}")

    def _set_cors(self):
        origin = self.headers.get("Origin", "")
        if "*" in CORS_ORIGINS or origin in CORS_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin or "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD")

    def _set_security_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

    def _get_token_payload(self):
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            return verify_token(auth[7:])
        return None

    def do_OPTIONS(self):
        self.send_response(204)
        self._set_cors()
        self.end_headers()

    def _dispatch(self, method):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        client_ip = self.client_address[0]

        if not check_rate_limit(client_ip):
            self.send_response(429)
            self._set_cors()
            self.end_headers()
            self.wfile.write(b'{"error":"Rate limit exceeded"}')
            return

        handler_fn, params, auth_level = router.match(method, path)
        if handler_fn is None:
            error_response(self, "Not found", 404)
            return

        # Auth check
        user = None
        if auth_level in ("member", "admin"):
            user = self._get_token_payload()
            if user is None:
                error_response(self, "Unauthorized", 401)
                return
            if auth_level == "admin" and user.get("role") != "admin":
                error_response(self, "Forbidden", 403)
                return

        self._user = user
        self._params = params
        self._query = parse_qs(parsed.query)

        try:
            handler_fn(self)
        except Exception as exc:
            print(f"ERROR: {exc}")
            import traceback; traceback.print_exc()
            error_response(self, "Internal server error", 500)

    def do_GET(self):
        self._dispatch("GET")

    def do_HEAD(self):
        self._dispatch("HEAD")

    def do_POST(self):
        self._dispatch("POST")

    def do_PUT(self):
        self._dispatch("PUT")

    def do_DELETE(self):
        self._dispatch("DELETE")

    def send_response(self, code, message=None):
        super().send_response(code, message)
        self._set_cors()
        self._set_security_headers()


# ══════════════════════════════════════════════════════════════════
#  ROUTES
# ══════════════════════════════════════════════════════════════════

# ─── Health ──────────────────────────────────────────────────────

@route("GET", "/health")
@route("HEAD", "/health")
def health(h):
    json_response(h, {"status": "ok", "env": ENV, "ts": datetime.now(timezone.utc).isoformat()})


# ─── Auth ────────────────────────────────────────────────────────

@route("POST", "/api/auth/register")
def auth_register(h):
    body = read_json_body(h)
    email = (body.get("email") or "").strip().lower()
    name = (body.get("name") or "").strip()
    password = body.get("password", "")

    if not email or not name or len(password) < 6:
        return error_response(h, "Email, name, and password (6+ chars) required")

    pw_hash, salt = hash_password(password)
    uid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    db = get_db()
    try:
        db.execute(
            "INSERT INTO users (id, email, name, password_hash, salt, role, created_at) VALUES (?,?,?,?,?,?,?)",
            (uid, email, name, pw_hash, salt, "member", now),
        )
        db.commit()
    except sqlite3.IntegrityError:
        db.close()
        return error_response(h, "Email already registered", 409)
    db.close()
    token = create_token(uid, "member")
    json_response(h, {"token": token, "user": {"id": uid, "email": email, "name": name, "role": "member"}}, 201)


@route("POST", "/api/auth/login")
def auth_login(h):
    body = read_json_body(h)
    email = (body.get("email") or "").strip().lower()
    password = body.get("password", "")

    # Admin shortcut login
    if email == "admin" and password == ADMIN_PASSWORD:
        token = create_token("admin", "admin")
        return json_response(h, {"token": token, "user": {"id": "admin", "email": "admin", "name": "Admin", "role": "admin"}})

    db = get_db()
    row = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    db.close()
    if row is None or not verify_password(password, row["password_hash"], row["salt"]):
        return error_response(h, "Invalid credentials", 401)

    token = create_token(row["id"], row["role"])
    json_response(h, {"token": token, "user": {"id": row["id"], "email": row["email"], "name": row["name"], "role": row["role"]}})


@route("GET", "/api/auth/me", auth="member")
def auth_me(h):
    uid = h._user["uid"]
    if uid == "admin":
        return json_response(h, {"id": "admin", "email": "admin", "name": "Admin", "role": "admin"})
    db = get_db()
    row = db.execute("SELECT id, email, name, role, created_at FROM users WHERE id = ?", (uid,)).fetchone()
    db.close()
    if row is None:
        return error_response(h, "User not found", 404)
    json_response(h, row_to_dict(row))


# ─── Public data ─────────────────────────────────────────────────

@route("GET", "/api/public/site-data")
def public_site_data(h):
    db = get_db()
    profile = row_to_dict(db.execute("SELECT * FROM site_profile WHERE id = 1").fetchone())
    events = rows_to_list(db.execute("SELECT * FROM events ORDER BY date DESC").fetchall())
    gallery = rows_to_list(db.execute("SELECT * FROM gallery ORDER BY sort_order, created_at DESC").fetchall())
    faqs = rows_to_list(db.execute("SELECT * FROM faqs ORDER BY sort_order").fetchall())
    programs = rows_to_list(db.execute("SELECT * FROM cricket_programs").fetchall())
    payments = row_to_dict(db.execute("SELECT card_url, paypal_url, etransfer_email FROM payment_settings WHERE id = 1").fetchone())
    db.close()
    json_response(h, {
        "profile": profile,
        "events": events,
        "gallery": gallery,
        "faqs": faqs,
        "programs": programs,
        "payments": payments,
    })


@route("GET", "/api/public/players")
def public_players(h):
    db = get_db()
    rows = rows_to_list(db.execute("SELECT * FROM players").fetchall())
    db.close()
    json_response(h, rows)


@route("GET", "/api/public/players/:id")
def public_player_detail(h):
    db = get_db()
    row = db.execute("SELECT * FROM players WHERE id = ?", (h._params["id"],)).fetchone()
    db.close()
    if row is None:
        return error_response(h, "Player not found", 404)
    json_response(h, row_to_dict(row))


@route("GET", "/api/public/matches")
def public_matches(h):
    db = get_db()
    rows = rows_to_list(db.execute("SELECT * FROM matches ORDER BY date DESC").fetchall())
    db.close()
    json_response(h, rows)


@route("GET", "/api/public/matches/:id")
def public_match_detail(h):
    db = get_db()
    row = db.execute("SELECT * FROM matches WHERE id = ?", (h._params["id"],)).fetchone()
    db.close()
    if row is None:
        return error_response(h, "Match not found", 404)
    json_response(h, row_to_dict(row))


@route("GET", "/api/public/marketplace/items")
def public_marketplace(h):
    db = get_db()
    rows = rows_to_list(db.execute("SELECT * FROM marketplace_items WHERE status = 'active' ORDER BY created_at DESC").fetchall())
    db.close()
    json_response(h, rows)


# ─── Stripe helpers ───────────────────────────────────────────────

def _get_stripe():
    """Lazy-load stripe module. Returns None if not installed."""
    try:
        import stripe
        db = get_db()
        ps = db.execute("SELECT stripe_secret_key FROM payment_settings WHERE id = 1").fetchone()
        db.close()
        key = (ps["stripe_secret_key"] if ps else "") or os.getenv("STRIPE_SECRET_KEY", "")
        if not key:
            return None
        stripe.api_key = key
        return stripe
    except ImportError:
        return None


# ─── Ticket purchase ─────────────────────────────────────────────

@route("POST", "/api/public/tickets")
def public_buy_ticket(h):
    body = read_json_body(h)
    event_id = body.get("event_id", "")
    buyer_name = (body.get("buyer_name") or "").strip()
    buyer_email = (body.get("buyer_email") or "").strip().lower()
    quantity = int(body.get("quantity", 1))
    method = body.get("payment_method", "etransfer")
    unit_price = float(body.get("unit_price", 0))  # cents for Stripe

    if not event_id or not buyer_name or not buyer_email:
        return error_response(h, "event_id, buyer_name, buyer_email required")

    db = get_db()
    event = db.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
    if event is None:
        db.close()
        return error_response(h, "Event not found", 404)

    tid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    stripe_session_id = None
    checkout_url = None

    if method == "card":
        stripe_mod = _get_stripe()
        if stripe_mod is None:
            db.close()
            return error_response(h, "Card payments not configured. Use e-transfer or PayPal.", 400)

        # Create Stripe Checkout session
        success_url = body.get("success_url", "http://localhost:8000/?ticket_status=success")
        cancel_url = body.get("cancel_url", "http://localhost:8000/?ticket_status=cancel")
        price_cents = int(unit_price * 100) if unit_price else 2000  # default $20

        session = stripe_mod.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "cad",
                    "product_data": {"name": f"Ticket: {event['title']}"},
                    "unit_amount": price_cents,
                },
                "quantity": quantity,
            }],
            mode="payment",
            success_url=success_url,
            cancel_url=cancel_url,
            client_reference_id=tid,
            customer_email=buyer_email,
            metadata={"ticket_id": tid, "event_id": event_id},
        )
        stripe_session_id = session.id
        checkout_url = session.url
        status = "pending_checkout"
    elif method == "etransfer":
        status = "pending_transfer"
    else:
        status = "pending_checkout"

    db.execute(
        "INSERT INTO tickets (id, event_id, buyer_name, buyer_email, quantity, payment_method, status, stripe_session_id, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        (tid, event_id, buyer_name, buyer_email, quantity, method, status, stripe_session_id, now),
    )

    if method == "etransfer":
        ps = db.execute("SELECT ticket_handler_email FROM payment_settings WHERE id = 1").fetchone()
        handler_email = ps["ticket_handler_email"] if ps else ""
        if handler_email:
            db.execute(
                "INSERT INTO notifications (id, recipient_email, subject, body, created_at) VALUES (?,?,?,?,?)",
                (str(uuid.uuid4()), handler_email, f"New e-transfer ticket from {buyer_name}",
                 f"Ticket {tid}: {quantity}x for event '{event['title']}'. Awaiting e-transfer from {buyer_email}.", now),
            )

    db.commit()
    db.close()

    result = {"ticket_id": tid, "status": status}
    if checkout_url:
        result["checkout_url"] = checkout_url
    json_response(h, result, 201)


# ─── Stripe Webhook ──────────────────────────────────────────────

@route("POST", "/api/public/stripe/webhook")
def stripe_webhook(h):
    """Handle Stripe checkout.session.completed events."""
    stripe_mod = _get_stripe()
    if stripe_mod is None:
        return error_response(h, "Stripe not configured", 400)

    payload = h.rfile.read(int(h.headers.get("Content-Length", 0)))
    sig_header = h.headers.get("Stripe-Signature", "")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")

    try:
        if webhook_secret:
            event = stripe_mod.Webhook.construct_event(payload, sig_header, webhook_secret)
        else:
            event = json.loads(payload)
    except Exception as exc:
        return error_response(h, f"Webhook error: {exc}", 400)

    if event.get("type") == "checkout.session.completed":
        session = event["data"]["object"]
        tid = session.get("client_reference_id") or (session.get("metadata") or {}).get("ticket_id")
        if tid:
            db = get_db()
            db.execute("UPDATE tickets SET status = 'paid', stripe_session_id = ? WHERE id = ?",
                       (session.get("id", ""), tid))
            # Create notification for handler
            ticket = db.execute("SELECT * FROM tickets WHERE id = ?", (tid,)).fetchone()
            if ticket:
                ps = db.execute("SELECT ticket_handler_email FROM payment_settings WHERE id = 1").fetchone()
                handler_email = ps["ticket_handler_email"] if ps else ""
                if handler_email:
                    now = datetime.now(timezone.utc).isoformat()
                    db.execute(
                        "INSERT INTO notifications (id, recipient_email, subject, body, created_at) VALUES (?,?,?,?,?)",
                        (str(uuid.uuid4()), handler_email,
                         f"Card payment received for ticket {tid}",
                         f"Ticket from {ticket['buyer_name']} ({ticket['buyer_email']}) paid via Stripe.", now),
                    )
            db.commit()
            db.close()

    json_response(h, {"received": True})


# ─── Member ticket routes ────────────────────────────────────────

@route("GET", "/api/member/tickets", auth="member")
def member_tickets(h):
    uid = h._user["uid"]
    db = get_db()
    user = db.execute("SELECT email FROM users WHERE id = ?", (uid,)).fetchone()
    if user is None:
        db.close()
        return error_response(h, "User not found", 404)
    rows = rows_to_list(db.execute("SELECT * FROM tickets WHERE buyer_email = ? ORDER BY created_at DESC", (user["email"],)).fetchall())
    db.close()
    json_response(h, rows)


# ─── Admin: Site Profile ─────────────────────────────────────────

@route("GET", "/api/admin/profile", auth="admin")
def admin_get_profile(h):
    db = get_db()
    row = row_to_dict(db.execute("SELECT * FROM site_profile WHERE id = 1").fetchone())
    db.close()
    json_response(h, row)


@route("PUT", "/api/admin/profile", auth="admin")
def admin_update_profile(h):
    body = read_json_body(h)
    db = get_db()
    db.execute(
        "UPDATE site_profile SET about_title = ?, about_description = ?, home_lead = ? WHERE id = 1",
        (body.get("about_title", ""), body.get("about_description", ""), body.get("home_lead", "")),
    )
    db.commit()
    row = row_to_dict(db.execute("SELECT * FROM site_profile WHERE id = 1").fetchone())
    db.close()
    json_response(h, row)


# ─── Admin: Payment Settings ─────────────────────────────────────

@route("GET", "/api/admin/payments", auth="admin")
def admin_get_payments(h):
    db = get_db()
    row = row_to_dict(db.execute("SELECT * FROM payment_settings WHERE id = 1").fetchone())
    db.close()
    json_response(h, row)


@route("PUT", "/api/admin/payments", auth="admin")
def admin_update_payments(h):
    body = read_json_body(h)
    db = get_db()
    db.execute(
        """UPDATE payment_settings SET card_url = ?, paypal_url = ?, etransfer_email = ?,
           ticket_handler_email = ?, stripe_publishable_key = ?, stripe_secret_key = ? WHERE id = 1""",
        (body.get("card_url", ""), body.get("paypal_url", ""), body.get("etransfer_email", ""),
         body.get("ticket_handler_email", ""), body.get("stripe_publishable_key", ""), body.get("stripe_secret_key", "")),
    )
    db.commit()
    row = row_to_dict(db.execute("SELECT * FROM payment_settings WHERE id = 1").fetchone())
    db.close()
    json_response(h, row)


# ─── Admin: Events CRUD ──────────────────────────────────────────

@route("GET", "/api/admin/events", auth="admin")
def admin_list_events(h):
    db = get_db()
    rows = rows_to_list(db.execute("SELECT * FROM events ORDER BY date DESC").fetchall())
    db.close()
    json_response(h, rows)


@route("POST", "/api/admin/events", auth="admin")
def admin_create_event(h):
    body = read_json_body(h)
    eid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    db = get_db()
    db.execute(
        "INSERT INTO events (id, title, description, date, location, image_url, created_at) VALUES (?,?,?,?,?,?,?)",
        (eid, body.get("title", ""), body.get("description", ""), body.get("date", now),
         body.get("location", ""), body.get("image_url", ""), now),
    )
    db.commit()
    row = row_to_dict(db.execute("SELECT * FROM events WHERE id = ?", (eid,)).fetchone())
    db.close()
    json_response(h, row, 201)


@route("PUT", "/api/admin/events/:id", auth="admin")
def admin_update_event(h):
    body = read_json_body(h)
    db = get_db()
    db.execute(
        "UPDATE events SET title=?, description=?, date=?, location=?, image_url=? WHERE id=?",
        (body.get("title", ""), body.get("description", ""), body.get("date", ""),
         body.get("location", ""), body.get("image_url", ""), h._params["id"]),
    )
    db.commit()
    row = row_to_dict(db.execute("SELECT * FROM events WHERE id = ?", (h._params["id"],)).fetchone())
    db.close()
    if row is None:
        return error_response(h, "Event not found", 404)
    json_response(h, row)


@route("DELETE", "/api/admin/events/:id", auth="admin")
def admin_delete_event(h):
    db = get_db()
    db.execute("DELETE FROM events WHERE id = ?", (h._params["id"],))
    db.commit()
    db.close()
    json_response(h, {"deleted": True})


# ─── Admin: Gallery CRUD ─────────────────────────────────────────

@route("GET", "/api/admin/gallery", auth="admin")
def admin_list_gallery(h):
    db = get_db()
    rows = rows_to_list(db.execute("SELECT * FROM gallery ORDER BY sort_order, created_at DESC").fetchall())
    db.close()
    json_response(h, rows)


@route("POST", "/api/admin/gallery", auth="admin")
def admin_create_gallery(h):
    body = read_json_body(h)
    gid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    db = get_db()
    db.execute(
        "INSERT INTO gallery (id, caption, image_url, sort_order, created_at) VALUES (?,?,?,?,?)",
        (gid, body.get("caption", ""), body.get("image_url", ""), int(body.get("sort_order", 0)), now),
    )
    db.commit()
    row = row_to_dict(db.execute("SELECT * FROM gallery WHERE id = ?", (gid,)).fetchone())
    db.close()
    json_response(h, row, 201)


@route("DELETE", "/api/admin/gallery/:id", auth="admin")
def admin_delete_gallery(h):
    db = get_db()
    db.execute("DELETE FROM gallery WHERE id = ?", (h._params["id"],))
    db.commit()
    db.close()
    json_response(h, {"deleted": True})


# ─── Admin: FAQs CRUD ────────────────────────────────────────────

@route("GET", "/api/admin/faqs", auth="admin")
def admin_list_faqs(h):
    db = get_db()
    rows = rows_to_list(db.execute("SELECT * FROM faqs ORDER BY sort_order").fetchall())
    db.close()
    json_response(h, rows)


@route("POST", "/api/admin/faqs", auth="admin")
def admin_create_faq(h):
    body = read_json_body(h)
    fid = str(uuid.uuid4())
    db = get_db()
    db.execute(
        "INSERT INTO faqs (id, question, answer, sort_order) VALUES (?,?,?,?)",
        (fid, body.get("question", ""), body.get("answer", ""), int(body.get("sort_order", 0))),
    )
    db.commit()
    row = row_to_dict(db.execute("SELECT * FROM faqs WHERE id = ?", (fid,)).fetchone())
    db.close()
    json_response(h, row, 201)


@route("PUT", "/api/admin/faqs/:id", auth="admin")
def admin_update_faq(h):
    body = read_json_body(h)
    db = get_db()
    db.execute(
        "UPDATE faqs SET question=?, answer=?, sort_order=? WHERE id=?",
        (body.get("question", ""), body.get("answer", ""), int(body.get("sort_order", 0)), h._params["id"]),
    )
    db.commit()
    row = row_to_dict(db.execute("SELECT * FROM faqs WHERE id = ?", (h._params["id"],)).fetchone())
    db.close()
    if row is None:
        return error_response(h, "FAQ not found", 404)
    json_response(h, row)


@route("DELETE", "/api/admin/faqs/:id", auth="admin")
def admin_delete_faq(h):
    db = get_db()
    db.execute("DELETE FROM faqs WHERE id = ?", (h._params["id"],))
    db.commit()
    db.close()
    json_response(h, {"deleted": True})


# ─── Admin: Cricket Programs CRUD ────────────────────────────────

@route("GET", "/api/admin/cricket-programs", auth="admin")
def admin_list_programs(h):
    db = get_db()
    rows = rows_to_list(db.execute("SELECT * FROM cricket_programs").fetchall())
    db.close()
    json_response(h, rows)


@route("POST", "/api/admin/cricket-programs", auth="admin")
def admin_create_program(h):
    body = read_json_body(h)
    pid = str(uuid.uuid4())
    db = get_db()
    db.execute(
        "INSERT INTO cricket_programs (id, title, description, schedule, level) VALUES (?,?,?,?,?)",
        (pid, body.get("title", ""), body.get("description", ""), body.get("schedule", ""), body.get("level", "all")),
    )
    db.commit()
    row = row_to_dict(db.execute("SELECT * FROM cricket_programs WHERE id = ?", (pid,)).fetchone())
    db.close()
    json_response(h, row, 201)


@route("PUT", "/api/admin/cricket-programs/:id", auth="admin")
def admin_update_program(h):
    body = read_json_body(h)
    db = get_db()
    db.execute(
        "UPDATE cricket_programs SET title=?, description=?, schedule=?, level=? WHERE id=?",
        (body.get("title", ""), body.get("description", ""), body.get("schedule", ""),
         body.get("level", "all"), h._params["id"]),
    )
    db.commit()
    row = row_to_dict(db.execute("SELECT * FROM cricket_programs WHERE id = ?", (h._params["id"],)).fetchone())
    db.close()
    if row is None:
        return error_response(h, "Program not found", 404)
    json_response(h, row)


@route("DELETE", "/api/admin/cricket-programs/:id", auth="admin")
def admin_delete_program(h):
    db = get_db()
    db.execute("DELETE FROM cricket_programs WHERE id = ?", (h._params["id"],))
    db.commit()
    db.close()
    json_response(h, {"deleted": True})


# ─── Admin: Tickets management ───────────────────────────────────

@route("GET", "/api/admin/tickets", auth="admin")
def admin_list_tickets(h):
    db = get_db()
    rows = rows_to_list(db.execute(
        """SELECT t.*, e.title as event_title FROM tickets t
           LEFT JOIN events e ON t.event_id = e.id ORDER BY t.created_at DESC"""
    ).fetchall())
    db.close()
    json_response(h, rows)


@route("POST", "/api/admin/tickets/:id/mark-paid", auth="admin")
def admin_mark_ticket_paid(h):
    db = get_db()
    db.execute("UPDATE tickets SET status = 'paid' WHERE id = ?", (h._params["id"],))
    db.commit()
    row = row_to_dict(db.execute("SELECT * FROM tickets WHERE id = ?", (h._params["id"],)).fetchone())
    db.close()
    if row is None:
        return error_response(h, "Ticket not found", 404)
    json_response(h, row)


@route("POST", "/api/admin/tickets/:id/send", auth="admin")
def admin_send_ticket(h):
    db = get_db()
    db.execute("UPDATE tickets SET status = 'sent' WHERE id = ?", (h._params["id"],))
    db.commit()
    row = row_to_dict(db.execute("SELECT * FROM tickets WHERE id = ?", (h._params["id"],)).fetchone())
    db.close()
    if row is None:
        return error_response(h, "Ticket not found", 404)
    json_response(h, row)


# ─── Admin: Players CRUD ─────────────────────────────────────────

@route("POST", "/api/admin/players", auth="admin")
def admin_create_player(h):
    body = read_json_body(h)
    pid = str(uuid.uuid4())
    db = get_db()
    db.execute(
        "INSERT INTO players (id, name, role, batting_style, bowling_style, image_url, bio) VALUES (?,?,?,?,?,?,?)",
        (pid, body.get("name", ""), body.get("role", "all-rounder"), body.get("batting_style", "right-hand"),
         body.get("bowling_style", ""), body.get("image_url", ""), body.get("bio", "")),
    )
    db.commit()
    row = row_to_dict(db.execute("SELECT * FROM players WHERE id = ?", (pid,)).fetchone())
    db.close()
    json_response(h, row, 201)


@route("PUT", "/api/admin/players/:id", auth="admin")
def admin_update_player(h):
    body = read_json_body(h)
    db = get_db()
    db.execute(
        "UPDATE players SET name=?, role=?, batting_style=?, bowling_style=?, image_url=?, bio=? WHERE id=?",
        (body.get("name", ""), body.get("role", "all-rounder"), body.get("batting_style", "right-hand"),
         body.get("bowling_style", ""), body.get("image_url", ""), body.get("bio", ""), h._params["id"]),
    )
    db.commit()
    row = row_to_dict(db.execute("SELECT * FROM players WHERE id = ?", (h._params["id"],)).fetchone())
    db.close()
    if row is None:
        return error_response(h, "Player not found", 404)
    json_response(h, row)


@route("DELETE", "/api/admin/players/:id", auth="admin")
def admin_delete_player(h):
    db = get_db()
    db.execute("DELETE FROM players WHERE id = ?", (h._params["id"],))
    db.commit()
    db.close()
    json_response(h, {"deleted": True})


# ─── Admin: Matches ──────────────────────────────────────────────

@route("POST", "/api/admin/matches", auth="admin")
def admin_create_match(h):
    body = read_json_body(h)
    mid = str(uuid.uuid4())
    db = get_db()
    db.execute(
        "INSERT INTO matches (id, opponent, date, venue, result, bloomfield_score, opponent_score, match_type) VALUES (?,?,?,?,?,?,?,?)",
        (mid, body.get("opponent", ""), body.get("date", ""), body.get("venue", ""),
         body.get("result", ""), body.get("bloomfield_score", ""), body.get("opponent_score", ""),
         body.get("match_type", "league")),
    )
    db.commit()
    row = row_to_dict(db.execute("SELECT * FROM matches WHERE id = ?", (mid,)).fetchone())
    db.close()
    json_response(h, row, 201)


# ─── Admin: Scorecards ────────────────────────────────────────────

@route("POST", "/api/admin/matches/:id/scorecard", auth="admin")
def admin_add_scorecard(h):
    """Add or replace batting/bowling performances for a match."""
    body = read_json_body(h)
    match_id = h._params["id"]
    performances = body.get("performances", [])

    db = get_db()
    match = db.execute("SELECT * FROM matches WHERE id = ?", (match_id,)).fetchone()
    if match is None:
        db.close()
        return error_response(h, "Match not found", 404)

    # Clear existing scorecard
    db.execute("DELETE FROM match_performances WHERE match_id = ?", (match_id,))

    for perf in performances:
        pid = str(uuid.uuid4())
        db.execute(
            """INSERT INTO match_performances
               (id, match_id, player_name, team, batting_runs, batting_balls,
                batting_fours, batting_sixes, batting_how_out,
                bowling_overs, bowling_maidens, bowling_runs, bowling_wickets)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (pid, match_id, perf.get("player_name", ""), perf.get("team", "bloomfield"),
             int(perf.get("batting_runs", 0)), int(perf.get("batting_balls", 0)),
             int(perf.get("batting_fours", 0)), int(perf.get("batting_sixes", 0)),
             perf.get("batting_how_out", ""),
             perf.get("bowling_overs", ""), int(perf.get("bowling_maidens", 0)),
             int(perf.get("bowling_runs", 0)), int(perf.get("bowling_wickets", 0))),
        )

    # Update match scores if provided
    if body.get("bloomfield_score"):
        db.execute("UPDATE matches SET bloomfield_score=?, opponent_score=?, result=? WHERE id=?",
                   (body.get("bloomfield_score", ""), body.get("opponent_score", ""),
                    body.get("result", ""), match_id))

    db.commit()
    rows = rows_to_list(db.execute("SELECT * FROM match_performances WHERE match_id = ?", (match_id,)).fetchall())
    db.close()
    json_response(h, {"match_id": match_id, "performances": rows}, 201)


@route("GET", "/api/public/matches/:id/scorecard")
def public_match_scorecard(h):
    db = get_db()
    match = db.execute("SELECT * FROM matches WHERE id = ?", (h._params["id"],)).fetchone()
    if match is None:
        db.close()
        return error_response(h, "Match not found", 404)
    performances = rows_to_list(db.execute("SELECT * FROM match_performances WHERE match_id = ?", (h._params["id"],)).fetchall())
    db.close()
    json_response(h, {"match": row_to_dict(match), "performances": performances})


# ─── Admin: Image Upload ─────────────────────────────────────────

@route("POST", "/api/admin/upload-image", auth="admin")
def admin_upload_image(h):
    """Accept a raw binary image body with Content-Type header.
       Saves to assets/uploads/ and returns the URL path."""
    content_type = h.headers.get("Content-Type", "")
    ext = ".jpg"
    if "png" in content_type:
        ext = ".png"
    elif "gif" in content_type:
        ext = ".gif"
    elif "webp" in content_type:
        ext = ".webp"

    length = int(h.headers.get("Content-Length", 0))
    if length == 0 or length > 10 * 1024 * 1024:
        return error_response(h, "Image required (max 10MB)")

    data = h.rfile.read(length)
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = UPLOAD_DIR / filename
    filepath.write_bytes(data)
    url = f"/assets/uploads/{filename}"
    json_response(h, {"url": url}, 201)


# ─── Admin: User roles ───────────────────────────────────────────

@route("POST", "/api/admin/user-roles", auth="admin")
def admin_set_user_role(h):
    body = read_json_body(h)
    user_id = body.get("user_id", "")
    role = body.get("role", "member")
    if role not in ("member", "admin"):
        return error_response(h, "Role must be 'member' or 'admin'")
    db = get_db()
    db.execute("UPDATE users SET role = ? WHERE id = ?", (role, user_id))
    db.commit()
    db.close()
    json_response(h, {"updated": True})


# ─── Marketplace (member) ────────────────────────────────────────

@route("POST", "/api/marketplace/items", auth="member")
def marketplace_create(h):
    body = read_json_body(h)
    iid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    db = get_db()
    db.execute(
        "INSERT INTO marketplace_items (id, seller_id, title, description, price, image_url, status, created_at) VALUES (?,?,?,?,?,?,?,?)",
        (iid, h._user["uid"], body.get("title", ""), body.get("description", ""),
         float(body.get("price", 0)), body.get("image_url", ""), "active", now),
    )
    db.commit()
    row = row_to_dict(db.execute("SELECT * FROM marketplace_items WHERE id = ?", (iid,)).fetchone())
    db.close()
    json_response(h, row, 201)


@route("GET", "/api/marketplace/my-items", auth="member")
def marketplace_my_items(h):
    db = get_db()
    rows = rows_to_list(db.execute(
        "SELECT * FROM marketplace_items WHERE seller_id = ? ORDER BY created_at DESC",
        (h._user["uid"],),
    ).fetchall())
    db.close()
    json_response(h, rows)


@route("PUT", "/api/marketplace/items/:id", auth="member")
def marketplace_update(h):
    body = read_json_body(h)
    db = get_db()
    item = db.execute("SELECT * FROM marketplace_items WHERE id = ?", (h._params["id"],)).fetchone()
    if item is None or item["seller_id"] != h._user["uid"]:
        db.close()
        return error_response(h, "Not found or not your item", 404)
    db.execute(
        "UPDATE marketplace_items SET title=?, description=?, price=?, image_url=? WHERE id=?",
        (body.get("title", item["title"]), body.get("description", item["description"]),
         float(body.get("price", item["price"])), body.get("image_url", item["image_url"]), h._params["id"]),
    )
    db.commit()
    row = row_to_dict(db.execute("SELECT * FROM marketplace_items WHERE id = ?", (h._params["id"],)).fetchone())
    db.close()
    json_response(h, row)


@route("DELETE", "/api/marketplace/items/:id", auth="member")
def marketplace_delete(h):
    db = get_db()
    item = db.execute("SELECT * FROM marketplace_items WHERE id = ?", (h._params["id"],)).fetchone()
    if item is None or item["seller_id"] != h._user["uid"]:
        db.close()
        return error_response(h, "Not found or not your item", 404)
    db.execute("UPDATE marketplace_items SET status = 'withdrawn' WHERE id = ?", (h._params["id"],))
    db.commit()
    db.close()
    json_response(h, {"withdrawn": True})


@route("GET", "/api/marketplace/items/:id/messages", auth="member")
def marketplace_messages(h):
    db = get_db()
    rows = rows_to_list(db.execute(
        "SELECT m.*, u.name as sender_name FROM marketplace_messages m JOIN users u ON m.sender_id = u.id WHERE m.item_id = ? ORDER BY m.created_at",
        (h._params["id"],),
    ).fetchall())
    db.close()
    json_response(h, rows)


@route("POST", "/api/marketplace/items/:id/messages", auth="member")
def marketplace_send_message(h):
    body = read_json_body(h)
    mid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    db = get_db()
    db.execute(
        "INSERT INTO marketplace_messages (id, item_id, sender_id, message, created_at) VALUES (?,?,?,?,?)",
        (mid, h._params["id"], h._user["uid"], body.get("message", ""), now),
    )
    db.commit()
    db.close()
    json_response(h, {"id": mid}, 201)


# ══════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════

def run():
    init_db()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), BCCCHandler)
    print(f"\n  Bloomfield BCCC API running on http://127.0.0.1:{PORT}")
    print(f"  Environment: {ENV}")
    print(f"  Database: {DB_PATH}\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()


if __name__ == "__main__":
    run()
