# Bloomfield BCCC - Full Project Handoff for Claude

Last updated: 2026-02-27  
Project root: `/Users/mathishasamarawickrama/Projects/bloomfield-bccc`

---

## 1) Why this file exists

This is a full handoff document so another Claude session can quickly understand:

- what was built,
- why it was built this way,
- what has already been changed,
- what is currently working,
- what still needs to be finished,
- and how to publish production safely.

This document is intentionally detailed and operational.

---

## 2) Visual snapshots

### Public site (Home)

![Bloomfield Home](/Users/mathishasamarawickrama/Projects/bloomfield-bccc/docs/images/home-page-file.png)

### Admin site (Login)

![Bloomfield Admin](/Users/mathishasamarawickrama/Projects/bloomfield-bccc/docs/images/admin-page-file.png)

Image files saved at:

- `/Users/mathishasamarawickrama/Projects/bloomfield-bccc/docs/images/home-page-file.png`
- `/Users/mathishasamarawickrama/Projects/bloomfield-bccc/docs/images/admin-page-file.png`

---

## 3) Product intent (business + user intent)

This website is designed as a **community operations platform** for Bloomfield Cricket Club:

- run and promote events,
- sell tickets with mobile-friendly checkout,
- support local business ads,
- maintain community galleries,
- run cricket programs,
- provide member marketplace buy/sell/donate,
- support member chat,
- and allow admin content control.

Future direction is to productize this into a multi-community template/SaaS.

---

## 4) What the owner specifically requested (high-level)

The owner asked for:

1. A normal landing page with top login area and list/navigation bar.
2. Controlled information density (not everything dumped at once).
3. Upcoming events and mobile ticket booking.
4. Payment methods: card/Apple Pay/Google Pay/PayPal/e-transfer.
5. Admin backend to edit profile/content/events/gallery/FAQs/payments.
6. Image upload from admin (file upload, not only URL).
7. Secure backend with stored login credentials.
8. Stripe checkout + webhook confirmation.
9. Security hardening for production (HTTPS, token secret, rate limits).
10. Cricket section with sub-areas (softball/hardball).
11. Marketplace listing and member-to-member chat.
12. FAQ section.
13. Better VS Code workflow because long-chat context instability in the app.
14. Ability to move toward productized multi-community architecture.
15. Background agents for recurring backend jobs.

---

## 5) What was built (scope summary)

### Frontend

- Public site (`index.html`, `styles.css`, `script.js`) with sectioned navigation and progressive reveal.
- Modal auth flow (register/login).
- Ticket booking modal and payment method selection.
- Event hero slider with dot navigation.
- Cricket section with player listing and player profile.
- Gallery, marketplace, FAQ, business and contact sections.
- My Tickets section with QR features.

### Admin

- Admin portal (`admin.html`, `admin.css`, `admin.js`) with protected login and content management.
- CRUD for:
  - profile copy,
  - payment settings,
  - events,
  - gallery,
  - FAQs,
  - cricket programs,
  - players,
  - matches/scorecards,
  - ticket fulfillment actions.
- File upload pipeline for event/gallery image uploads.

### Backend

- Single Python API server (`backend/server.py`) using standard library HTTP server.
- Data persistence in SQLite by default, optional Postgres driver compatibility.
- Ticketing/payment logic including Stripe Checkout creation and webhook verification.
- Marketplace listing + direct messages.
- Player + match + scorecard system.
- Ticket QR code generation and transfer/check-in workflows.
- Tenant-aware schema foundation (`clubs`, `club_domains`, per-table `club_id`).
- Security controls (auth tokens, password hashing, rate limiting, CORS, headers).
- New background worker process (`backend/agents.py`) for recurring jobs.

---

## 6) Project tree (important files)

```text
/Users/mathishasamarawickrama/Projects/bloomfield-bccc
├── index.html
├── styles.css
├── script.js
├── admin.html
├── admin.css
├── admin.js
├── .env.example
├── .vscode/
│   ├── settings.json
│   ├── launch.json
│   └── tasks.json
├── assets/
│   └── logo-placeholder.svg
├── backend/
│   ├── server.py
│   ├── agents.py
│   ├── requirements.txt
│   └── README.md
└── docs/
    ├── CLAUDE_FULL_PROJECT_HANDOFF.md
    └── images/
        ├── home-page-file.png
        └── admin-page-file.png
```

---

## 7) Key frontend behavior and UX decisions

### Navigation + information control

- Main tabs:
  - Home, About, Events, Cricket, Gallery, Marketplace, Business, FAQ, Contact, My Tickets.
- Sections are shown one at a time (`.page-section.active`) to keep pages focused.

### Owner-requested landing-page edits that were applied

- Removed explicit `Previous` / `Next` slider buttons (dot navigation remains).
- Removed `Step 1 / Step 2 / Step 3` explanatory panel.
- Removed hero pills text:
  - `Mobile ticket checkout`
  - `Card, PayPal, e-Transfer`
  - `Live community updates`
- Reduced heavy outline/border feel on major cards/containers.

### Login/register

- Login/register modal used for member auth.
- Auth state reflected in top bar.

### Tickets

- Booking modal captures buyer details + quantity + payment method.
- Supports:
  - Card (Stripe path when configured),
  - PayPal URL path,
  - E-transfer flow with pending confirmation.

### Marketplace

- Logged-in members can list items.
- Buyer/seller messaging in-app.

### Cricket

- Public player views and player profile details.
- Filtering/sorting for player grid.

---

## 8) Admin capabilities (implemented)

Admin functions available in UI:

- Profile copy update (`aboutTitle`, `aboutDescription`, `homeLead`).
- Payment settings update (`cardUrl`, `paypalUrl`, `etransferEmail`, `ticketHandlerEmail`, Stripe settings).
- Event create/update/delete with image URL + file upload support.
- Gallery create/delete with image URL + file upload support.
- FAQ create/update/delete.
- Cricket program create/update/delete.
- Ticket action buttons:
  - mark paid,
  - mark tickets sent.
- Player management (create/edit/delete).
- Match + scorecard management.

---

## 9) Backend architecture details

### Runtime

- HTTP server: `ThreadingHTTPServer`.
- App entrypoint: `run()` in `/Users/mathishasamarawickrama/Projects/bloomfield-bccc/backend/server.py`.
- DB mode selected by `BCCC_DB_DRIVER=sqlite|postgres`.

### Security primitives

- Password hashing: PBKDF2-HMAC-SHA256 + per-user salt.
- Bearer token signing: HMAC SHA-256.
- Rate limiting per client + route scope.
- CORS allowlist behavior.
- Secure headers:
  - `X-Content-Type-Options`,
  - `X-Frame-Options`,
  - `Referrer-Policy`,
  - `Permissions-Policy`,
  - `Content-Security-Policy`.
- Conditional HSTS for non-local HTTPS-hosted requests.

### Production hard-fail checks

In production (`BCCC_ENV=production`), startup now fails if:

- token secret is weak/default,
- CORS origins contain `*`,
- admin password is missing/default.

### Multi-tenant foundation

- `clubs` and `club_domains` tables.
- Tenant context resolution by host/slug.
- Major data tables include `club_id`.
- Auth token includes `club_id` and is validated against request club context.

### Storage

- Local upload mode: `assets/uploads/`.
- Object storage mode: S3/R2 via `BCCC_UPLOAD_BACKEND=s3` and `BCCC_S3_*` env vars.

---

## 10) API route map (current backend)

### Health

- `GET /health`
- `HEAD /health`

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/auth/roles`

### Public data

- `GET /api/public/site-data`
- `GET /api/public/marketplace/items`
- `GET /api/public/players`
- `GET /api/public/players/:id`
- `GET /api/public/matches`
- `GET /api/public/matches/:id`

### Ticket purchase + payments

- `POST /api/public/tickets`
- `POST /api/public/stripe/webhook`

### Member ticket operations

- `GET /api/member/tickets`
- `GET /api/member/tickets/:id/qr`
- `POST /api/member/tickets/:id/transfer`

### Marketplace (authenticated)

- `POST /api/marketplace/items`
- `PUT /api/marketplace/items/:id`
- `DELETE /api/marketplace/items/:id`
- `GET /api/marketplace/my-items`
- `GET /api/marketplace/items/:id/messages`
- `POST /api/marketplace/items/:id/messages`

### Admin core

- `GET/PUT /api/admin/profile`
- `GET/PUT /api/admin/payments`
- `GET/POST/PUT/DELETE /api/admin/events`
- `GET/POST/DELETE /api/admin/gallery`
- `POST /api/admin/upload-image`
- `GET/POST/PUT/DELETE /api/admin/faqs`
- `GET/POST/PUT/DELETE /api/admin/cricket-programs`
- `GET /api/admin/tickets`
- `POST /api/admin/tickets/:id/mark-paid`
- `POST /api/admin/tickets/:id/send`

### Admin cricket ops

- `POST /api/admin/players`
- `PUT /api/admin/players/:id`
- `DELETE /api/admin/players/:id`
- `POST /api/admin/matches`
- `POST /api/admin/matches/:id/scorecard`
- `POST /api/admin/checkin/scan`
- `POST /api/admin/user-roles`

---

## 11) Payment flow (important)

### Card path

- Public ticket checkout hits `/api/public/tickets` with `method=card`.
- If `STRIPE_SECRET_KEY` exists, backend creates Stripe Checkout session.
- Ticket status set as pending checkout first.
- On Stripe webhook `checkout.session.completed`, ticket is marked paid and notification row is created.

### PayPal path

- Redirect URL is generated from configured PayPal URL with parameters.

### E-transfer path

- Ticket status is `pending_transfer`.
- Notification is inserted for ticket handler.
- Admin later marks paid and then marks sent.

---

## 12) Background agents/jobs (new)

New worker file:

- `/Users/mathishasamarawickrama/Projects/bloomfield-bccc/backend/agents.py`

Current jobs implemented:

1. **Pending transfer reminders**
   - Finds old `pending_transfer` tickets.
   - Inserts reminder notifications for handler email.
   - Cooldown prevents spam duplicates.

2. **Marketplace stale cleanup**
   - Marks old active marketplace listings as `withdrawn`.

Env controls:

- `BCCC_AGENT_INTERVAL_SECONDS`
- `BCCC_AGENT_PENDING_TRANSFER_HOURS`
- `BCCC_AGENT_PENDING_TRANSFER_REMINDER_COOLDOWN_HOURS`
- `BCCC_AGENT_MARKETPLACE_STALE_DAYS`

---

## 13) VS Code workflow improvements

Configured files:

- `/Users/mathishasamarawickrama/Projects/bloomfield-bccc/.vscode/tasks.json`
- `/Users/mathishasamarawickrama/Projects/bloomfield-bccc/.vscode/launch.json`
- `/Users/mathishasamarawickrama/Projects/bloomfield-bccc/.vscode/settings.json`

Useful tasks:

- `BCCC: Setup Python venv`
- `BCCC: Backend API`
- `BCCC: Frontend Static`
- `BCCC: Agents Worker`
- `BCCC: Run All`
- `BCCC: Run All + Agents`
- `BCCC: Health Check`

---

## 14) API base URL behavior change (publish-critical)

Frontend/admin now resolve API base using this priority:

1. `localStorage['bccc_api_base']` if set,
2. `window.BCCC_API_BASE` if set,
3. `<meta name="bccc-api-base" content="...">` if set,
4. fallback:
   - localhost/file mode => `http://127.0.0.1:5050`
   - production host => `window.location.origin`

This makes reverse-proxy deployment practical (same-origin `/api/*`).

Files:

- `/Users/mathishasamarawickrama/Projects/bloomfield-bccc/script.js`
- `/Users/mathishasamarawickrama/Projects/bloomfield-bccc/admin.js`
- `/Users/mathishasamarawickrama/Projects/bloomfield-bccc/index.html`
- `/Users/mathishasamarawickrama/Projects/bloomfield-bccc/admin.html`

---

## 15) Data model summary (major tables)

Community and tenancy:

- `clubs`
- `club_domains`

Auth and roles:

- `users`
- `user_permissions`

Site content:

- `site_profile`
- `events`
- `gallery`
- `faqs`
- `cricket_programs`
- `payment_settings`

Commerce and support:

- `tickets`
- `ticket_qr_codes`
- `notifications`

Marketplace:

- `marketplace_items`
- `marketplace_messages`

Cricket operations:

- `players`
- `player_disciplines`
- `teams`
- `player_teams`
- `matches`
- `match_performances`

---

## 16) Current known limitations / follow-up work

1. **Deployment config is not yet codified** (no committed Caddy/Nginx + systemd files in root yet).
2. **Stripe live keys and webhook setup are not yet documented per environment file in repo** (still placeholders).
3. **Local artifact file exists**: `/Users/mathishasamarawickrama/Projects/bloomfield-bccc/BCCC:` (empty accidental file).
4. **README route list is smaller than actual backend route surface** (players/matches/member-ticket endpoints should be added).
5. **Monitoring/alerting not yet configured** (logs only).

---

## 17) Publish checklist (recommended order)

1. Set production env values:
   - strong token secret,
   - strong admin password,
   - strict CORS origin list,
   - Stripe live keys + webhook secret.
2. Decide infra:
   - single VPS + Caddy/Nginx + systemd,
   - or containerized deployment.
3. Serve static files at site domain, reverse-proxy `/api` to backend.
4. Enable HTTPS and pass `X-Forwarded-Proto=https`.
5. Run agents as separate service.
6. Configure daily encrypted backup for DB + uploads.
7. Smoke test:
   - auth,
   - admin CRUD,
   - ticket checkout methods,
   - Stripe webhook completion,
   - marketplace messaging,
   - player/match public pages.

---

## 18) Commands reference

### Local development

```bash
cd /Users/mathishasamarawickrama/Projects/bloomfield-bccc
python3 -m venv .venv
./.venv/bin/python -m pip install -r backend/requirements.txt
./.venv/bin/python backend/server.py
./.venv/bin/python -m http.server 8000
./.venv/bin/python backend/agents.py
```

### Health checks

```bash
curl -s http://127.0.0.1:5050/health
curl -s http://127.0.0.1:5050/api/public/site-data | python3 -m json.tool
```

---

## 19) Exact context block to paste into a new Claude chat

Paste this block to quickly onboard a new Claude instance:

```text
Project: Bloomfield Cricket Club community platform
Root path: /Users/mathishasamarawickrama/Projects/bloomfield-bccc

Objective:
- Continue improving and publishing the existing website, not rebuild from scratch.
- Maintain current design direction and business flows.

Current architecture:
- Frontend: index.html + script.js + styles.css
- Admin: admin.html + admin.js + admin.css
- Backend API: backend/server.py (Python stdlib server)
- Background jobs: backend/agents.py
- Database: SQLite default with optional Postgres compatibility
- Uploads: local assets/uploads or S3/R2 via env

Critical implemented features:
- Auth/register/login with signed bearer token
- Event listing + ticket booking
- Payment methods: card/paypal/e-transfer
- Stripe checkout + webhook support
- Admin CRUD for profile/payments/events/gallery/faqs/cricket programs
- Marketplace listings + member chat
- Player profiles + match/scorecard API routes
- My Tickets + QR code endpoints
- Tenant-aware schema (clubs + club_id)
- Rate limiting + CORS + security headers
- Production guardrails for secrets/origins/admin password

Important UX constraints from owner:
- Keep site user-friendly and section-based (not overloaded)
- Home should stay clean
- Slider uses dots (no prev/next buttons)
- Removed step-by-step panel and extra hero pills
- Keep admin access separate

Current priorities:
1) finalize publish-ready infra files (reverse proxy + services)
2) complete production env and webhook setup
3) run full smoke tests
4) deliver go-live runbook

Reference handoff file:
- /Users/mathishasamarawickrama/Projects/bloomfield-bccc/docs/CLAUDE_FULL_PROJECT_HANDOFF.md
```

---

## 20) Claude-oriented structured payload (machine-friendly)

```yaml
project:
  name: bloomfield-bccc
  root: /Users/mathishasamarawickrama/Projects/bloomfield-bccc
  status: active

stack:
  frontend:
    - index.html
    - styles.css
    - script.js
  admin:
    - admin.html
    - admin.css
    - admin.js
  backend:
    language: python
    api_file: backend/server.py
    worker_file: backend/agents.py
    db_default: sqlite
    db_optional: postgres

features:
  - sectioned_navigation
  - auth_register_login
  - event_ticketing
  - stripe_checkout_webhook
  - paypal_redirect
  - etransfer_pending_flow
  - admin_crud
  - image_file_upload
  - marketplace_chat
  - cricket_player_profiles
  - matches_scorecards
  - ticket_qr_transfer_checkin
  - tenant_foundation
  - security_headers_rate_limit
  - background_agents

dev_run:
  api: python3 backend/server.py
  web: python3 -m http.server 8000
  worker: python3 backend/agents.py

publish_needs:
  - reverse_proxy_config
  - service_units
  - production_env_values
  - stripe_webhook_registration
  - backups_monitoring
```

---

## 21) Final note for handoff continuity

This project is not a greenfield build anymore. It already has significant implementation and should be iterated in place.
The next Claude session should prioritize **finishing and shipping** over redesigning architecture from zero.

