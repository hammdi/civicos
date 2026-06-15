# CivicOS — Architecture

CivicOS is an open-source civic platform that digitalises four essential daily
citizen services behind a single API. It is designed to be portable: any city or
country deploys the same images and overrides only environment variables.

The four modules:

| # | Module | Arabic | What it does |
|---|--------|--------|--------------|
| 1 | Digital Queue System | الطابور الرقمي | Take a numbered ticket remotely; watch the queue advance live. |
| 2 | Document Tracker | تتبع الوثائق | Submit an administrative file, track its status by reference number, get notified on change. |
| 3 | Local Market | السوق المحلي | Browse/sell neighbourhood listings, contact sellers, leave reviews. |
| 4 | Urban Issue Reporter | بلاغ مشكل | Report city issues with photos/geo, upvote, and track municipality response. |

---

## 1. Monorepo layout

```
civicos/
├── docker-compose.yml        # postgres + redis + backend + frontend (+ optional nginx proxy)
├── .env.example              # all tunables, documented
├── Makefile
├── nginx/nginx.conf          # optional single-origin reverse proxy (SPA + API + WS on one port)
│
├── backend/                  # FastAPI application (single app, four modules)
│   ├── Dockerfile
│   ├── entrypoint.sh         # wait-for-postgres → seed → uvicorn
│   ├── requirements.txt
│   └── app/
│       ├── main.py           # builds the FastAPI app, mounts every router, startup hook
│       ├── core/             # shared infrastructure (config, db, auth, otp, ws, notifications)
│       ├── models/           # SQLAlchemy ORM, one module file each (+ base, admin)
│       ├── schemas/          # Pydantic request/response models
│       ├── routers/          # HTTP + WS endpoints, public + *_admin per module
│       ├── services/         # framework-free domain logic (queue_service.py)
│       └── seeds/seed.py     # idempotent create_all + demo data
│
└── frontend/                 # React + Vite + TypeScript SPA
    ├── Dockerfile            # build → nginx-spa.conf serves static bundle
    └── src/
        ├── main.tsx          # BrowserRouter + AuthProvider + i18n bootstrap
        ├── App.tsx           # route table (public pages + AdminProtected routes)
        ├── api/              # axios client + TS types mirroring the backend schemas
        ├── context/          # AuthContext (citizen phone-OTP session)
        ├── hooks/            # useWebSocket (auto-reconnecting channel subscriber)
        ├── i18n.ts           # i18next, en/fr/ar, RTL direction switching
        ├── locales/          # en.json, fr.json, ar.json
        ├── components/       # Layout, Navbar, PhoneAuthModal, AdminProtected, ...
        └── pages/            # Home, Queue, QueueDetail, Documents, Market, Report
            └── admin/        # AdminHub, AdminQueue, AdminDocuments, AdminIssues
```

---

## 2. The single-FastAPI-app, four-module design

There is exactly one FastAPI application (`backend/app/main.py`). Each of the four
modules is implemented as a pair of routers — a public one and a JWT-protected
`*_admin` one — that are all included onto the same app. Auth is shared and
mounted once.

```
                          FastAPI app (app.main:app)
                                    │
   CORSMiddleware ──────────────────┤  (allow_origins = settings.cors_origin_list)
                                    │
   ┌── meta ─────────────  GET /            GET /health
   │
   ├── Shared auth ──────  auth.router        → /auth/request-otp, /auth/verify-otp
   │                       auth.admin_router  → /admin/login
   │
   ├── M1 Queue ─────────  queue.router       → /institutions, /tickets, WS /ws/queue/{id}
   │                       queue_admin.router → /admin/dashboard, /admin/queue/*, /admin/stats
   │
   ├── M2 Documents ─────  documents.router       → /document-types, /files, WS /ws/files/{ref}
   │                       documents_admin.router → /admin/files, /admin/files/{id}/status|notify
   │
   ├── M3 Market ────────  market.router      → /listings, /sellers/{phone}  (no admin, no WS)
   │
   └── M4 Issues ────────  issues.router       → /issue-categories, /issues, /issues/stats
                           issues_admin.router → /admin/issues, /admin/issues/{id}/status|assign
```

Notes that fall straight out of the code:

- `api_v1_prefix` is empty by design — the spec uses root-level paths
  (`/institutions`, not `/api/v1/institutions`).
- Admin routers all share the `/admin` prefix; the axios client distinguishes
  admin vs. citizen calls purely by URL (`/admin/*` except `/admin/login`).
- Module 3 (Market) has neither an admin router nor WebSockets — it is a
  citizen-to-citizen marketplace; only listing create/update/delete are
  OTP-gated (`CurrentCitizen`).
- `@app.on_event("startup")` captures the running asyncio loop and hands it to
  the WebSocket `manager` (see §5) so synchronous request handlers can fan out
  broadcasts.

---

## 3. Data model per module

All models share a declarative `Base` and a `TimestampMixin` (`created_at`,
`server_default=now()`) in `models/base.py`. `models/__init__.py` imports every
model so `Base.metadata.create_all` (used by the seeder) sees the full schema.
JSON columns use PostgreSQL `JSONB`.

### Shared — Admin (`models/admin.py`)

The only credentialed users. Citizens never hold a password.

- `admins`: `id`, `username` (unique), `password_hash` (bcrypt), `full_name`,
  `institution_id → institutions` (SET NULL), `institution_type`, `is_superuser`.
  Scoped to one institution/module; superusers are unrestricted.
- `INSTITUTION_TYPES = (hospital, municipality, post, court, tax_office)`.

### Module 1 — Queue (`models/queue.py`)

```
institutions ──1:N──> queues ──1:N──> tickets
     │                   │
     │                   └──1:N──> queue_windows ──(current_ticket_id)──> tickets
     └── (admins.institution_id references institutions)
```

- `institutions`: `name`, `type`, `address`, `city`, `country`,
  `avg_wait_minutes` (used for ETA), `is_active`.
- `queues`: one per institution **per day** (`date`). `status ∈ (open, paused,
  closed)`, `current_number`, `total_served`, `opened_at`, `closed_at`.
  Created lazily ("today's queue") on first ticket or when an admin opens it.
- `tickets`: `number` (monotonic per queue), `phone`, `service_type`,
  `status ∈ (waiting, called, serving, served, no_show, cancelled)`, plus
  `called_at` / `served_at` / `wait_minutes` timing.
- `queue_windows`: service counters; `current_ticket_id → tickets` (SET NULL)
  records who a window is currently serving.

### Module 2 — Documents (`models/documents.py`)

```
document_types ──1:N──> files ──1:N──> file_updates   (status history, ordered by time)
      │
      └── document_types.institution_id ──> institutions (SET NULL)

notifications_log   (every SMS that was sent/logged, written by core/notifications.py)
```

- `document_types`: `name`, optional `institution_id`, `required_documents`
  (JSONB list), `avg_processing_days` (drives `expected_ready_date`).
- `files`: `reference_number` (unique, human-friendly `REF-YYYY-XXXXX`),
  `citizen_phone`, `document_type_id` (RESTRICT), `status ∈ (submitted,
  processing, ready, delivered, rejected)`, `submitted_at`,
  `expected_ready_date`, `notes`.
- `file_updates`: append-only audit trail — `old_status`, `new_status`,
  `message`, `updated_by`, `updated_at`.
- `notifications_log`: `phone`, `message`, `status` (`sent` | `logged`),
  `sent_at`. Shared by all modules' SMS sends.

### Module 3 — Market (`models/market.py`)

```
sellers ──1:N──> listings ──1:N──> orders     (a buyer's "contact seller" intent)
                    │
                    └────1:N──> reviews        (1..5 rating; feeds seller.rating)
```

- `sellers`: `name`, `phone` (unique — created on demand from the OTP identity),
  `city`, `neighborhood`, `verified`, `rating`, `total_sales`.
- `listings`: `title`, `description`, `category ∈ LISTING_CATEGORIES`,
  `price` (Numeric), `negotiable`, `photos` (JSONB), `city`, `neighborhood`,
  `status ∈ (active, sold, expired)`, `views`.
- `orders`: `buyer_phone`, `buyer_name`, `message`,
  `status ∈ (pending, accepted, rejected, completed)`.
- `reviews`: `reviewer_phone`, `rating` (1..5), `comment`. On insert the seller's
  aggregate `rating` is recomputed across all their listings.

### Module 4 — Issues (`models/issues.py`)

```
issue_categories ──1:N──> issues ──1:N──> issue_updates   (status timeline)
                             │
                             └────1:N──> upvotes           (UNIQUE issue_id+voter_phone)
```

- `issue_categories`: `name`, `icon`, `responsible_dept`.
- `issues`: `reference_number` (`ISS-YYYY-XXXXX`), `reporter_phone`,
  `category_id` (SET NULL), `title`, `description`, `location_lat/lng`,
  `address`, `city`, `photos` (JSONB), `status ∈ (reported, acknowledged,
  in_progress, resolved, closed)`, `priority ∈ (low, medium, high, urgent)`,
  `assigned_dept`, `upvote_count` (denormalised), `resolved_at`,
  `resolution_note`.
- `issue_updates`: `status`, `message`, `updated_by`, optional `photo`,
  `updated_at`.
- `upvotes`: `voter_phone`, with a `UniqueConstraint(issue_id, voter_phone)` so
  a phone can upvote an issue once; a duplicate raises `IntegrityError` →
  `409`.

---

## 4. Shared infrastructure (`core/`)

### Configuration (`core/config.py`)

A single pydantic-settings `Settings` object, cached with `@lru_cache`. Every
field is environment-overridable (`.env` or process env), with development
defaults so the stack boots with zero config. Key values: `database_url`,
`redis_url`, `jwt_secret`, `jwt_algorithm` (HS256), `jwt_expire_days` (30),
`otp_expire_minutes` (5), `otp_length` (6), `otp_debug_return`,
`twilio_*`, `cors_origins`. Helpers: `is_production`, `cors_origin_list`.

### Database (`core/database.py`)

Synchronous SQLAlchemy. A single `engine` (`pool_pre_ping=True`) and a
`SessionLocal` factory. `get_db()` is the FastAPI dependency that yields a
request-scoped session and always closes it. Exposed as
`DbSession = Annotated[Session, Depends(get_db)]` in `core/deps.py`.

### Auth — phone OTP (citizens) + JWT (admins)

Two identity types, both ending in a signed JWT.

**Passwords & JWT (`core/security.py`)**
- `hash_password` / `verify_password` — bcrypt via passlib (admins only).
- `create_access_token(subject, role, extra)` — HS256 token with
  `sub`, `role` (`"citizen"` | `"admin"`), `iat`, `exp` (now + `jwt_expire_days`).
  Admin tokens carry `extra`: `admin_id`, `institution_id`, `institution_type`,
  `is_superuser`.
- `decode_access_token` — returns the payload or `None` on any `JWTError`.

**OTP issuing/verification (`core/otp.py`)**
- `generate_otp(phone)` makes a `secrets`-random numeric code of
  `otp_length`, stores it under `otp:{phone}`, **prints it to the console**
  (the spec's `console.log(OTP)` dev behaviour) and returns it.
- Storage is **Redis when reachable** (`SETEX` with `otp_expire_minutes` TTL, so
  codes expire automatically and survive across workers); if Redis is
  unavailable at import time it transparently falls back to an in-process
  `dict` with manual expiry.
- `verify_otp(phone, code)` is constant-time (`secrets.compare_digest`) and
  single-use (deletes the code on success).
- In development `otp_debug_return=True` also echoes the code in the
  `/auth/request-otp` response so testers don't have to read logs. **Keep this
  off in production.**

**Dependency guards (`core/deps.py`)** — `HTTPBearer` based:
- `get_current_citizen` → 401 if no/invalid token, 403 if `role != "citizen"`.
- `get_current_admin` → same, requiring `role == "admin"`.
- `optional_citizen` → returns `None` instead of raising (for endpoints that
  personalise when logged in but also work anonymously).
- Exposed as `CurrentCitizen`, `CurrentAdmin`, `OptionalCitizen` annotations.

### Reference numbers (`core/refs.py`)

`new_reference(prefix)` → `PREFIX-YEAR-XXXXX`, e.g. `REF-2026-0A3F` / `ISS-2026-...`,
using an unambiguous alphabet (no `0/O`, `1/I`). Routers retry on the rare
collision against the unique column.

### WebSocket fan-out (`core/websocket.py`)

A single in-process `ConnectionManager` (`manager`) holds a
`channel → set[WebSocket]` registry guarded by an asyncio lock.

- `connect` / `disconnect` — accept and register / drop a socket on a channel.
- `broadcast(channel, msg)` — async send `msg` (JSON) to all subscribers,
  pruning sockets that error mid-send.
- `broadcast_sync(channel, msg)` — the bridge for **synchronous** request
  handlers. FastAPI runs sync endpoints in a worker thread with no event loop,
  so this schedules the coroutine onto the main loop captured at startup via
  `asyncio.run_coroutine_threadsafe`. This is why `main.py`'s startup hook calls
  `manager.bind_loop(asyncio.get_running_loop())`.
- Channel-name helpers keep conventions in one place: `queue:{institution_id}`,
  `file:{reference}`, `issues:{city or 'all'}`.

Single-replica in-memory is intentional and zero-cost; the docstring notes that
scaling horizontally means swapping `broadcast` for a Redis pub/sub publish
behind the same surface.

### Notifications (`core/notifications.py`)

One entry point: `send_sms(phone, message, db=None)`.
- **Twilio-ready, lazy.** It is only used when all three of
  `twilio_account_sid` / `twilio_auth_token` / `twilio_from_number` are set;
  the `twilio` import is guarded inside `_send_via_twilio` so the dependency is
  optional. Returns `"sent"`.
- **Console dev default.** Otherwise the message is printed (`[SMS → …]`) and
  logged; returns `"logged"`.
- Either way, if a `db` session is passed, the message is persisted to
  `notifications_log`. Callers: documents/issues admin status changes, queue
  "your number is up", and market "buyer interested" notifications.

### Redis usage

Redis is **optional**. Today it backs the OTP store (auto-expiring, multi-worker
safe) with an in-memory fallback. `redis_url` is configured and the
WebSocket layer is explicitly written to be upgradable to Redis pub/sub for
multi-replica fan-out.

---

## 5. Request lifecycle

A typical authenticated, state-changing call (admin advancing the queue):

```
Browser (axios)
  │  POST /admin/queue/next   Authorization: Bearer <admin JWT>
  ▼
FastAPI app ── CORSMiddleware ──> route match (queue_admin.call_next)
  │
  ├─ Depends(get_db)         → request-scoped SQLAlchemy Session
  ├─ Depends(get_current_admin) → decode JWT, require role=admin
  │
  ├─ _resolve_institution()  → 403 unless superuser or owns institution
  ├─ domain logic (queue_service): complete current ticket, pick next waiting
  ├─ db.commit()
  ├─ send_sms(ticket.phone, …, db)   → console/Twilio + notifications_log
  ├─ manager.broadcast_sync("queue:{id}", {event:"ticket_called", ...snapshot})
  │        └── scheduled onto the startup-captured event loop
  ▼
Pydantic response_model serialises → JSON   (sync handler in threadpool)
```

Reads (e.g. `GET /institutions`) are the same minus auth/commit/broadcast. The
list endpoint enriches each institution with today's live load
(`waiting_count`, `current_number`, ETA) computed in `queue_service`.

---

## 6. Real-time updates over WebSockets

Three live channels, all driven through the same `manager`. The client opens a
socket, the server immediately pushes a `snapshot`, and every subsequent
mutation re-broadcasts the current state to that channel.

```
        ┌─────────────────────── Queue (Module 1) ───────────────────────┐
        │  client ──ws──> /ws/queue/{institution_id}   channel queue:{id} │
        │     ▲                                                            │
        │     │  on connect: {event:"snapshot", ...queue_state_payload}    │
        │     │                                                            │
        │  any of: take ticket, cancel, open/pause/close, call next/by    │
        │  number, no-show, served  ── broadcast_sync(queue:{id}, ...) ────┘
        │      events: ticket_created | ticket_cancelled | ticket_called  │
        │              | ticket_served | ticket_no_show | queue_opened     │
        │              | queue_paused | queue_closed | queue_empty         │
        └──────────────────────────────────────────────────────────────────

        ┌────────────────────── Documents (Module 2) ────────────────────┐
        │  client ──ws──> /ws/files/{reference}        channel file:{ref} │
        │  on connect: {event:"snapshot", reference, status}              │
        │  admin PUT /admin/files/{id}/status ──> broadcast_sync          │
        │      event: status_changed {old_status, status, message}        │
        └──────────────────────────────────────────────────────────────────

        ┌──────────────────────── Issues (Module 4) ─────────────────────┐
        │  channel issues:{city or 'all'}  (broadcast only — see note)    │
        │  report → issue_reported,  upvote → issue_upvoted,              │
        │  admin status → issue_status_changed,  assign → issue_assigned  │
        └──────────────────────────────────────────────────────────────────
```

Mechanics, exactly as coded:

1. The WS endpoint (`queue_ws`, `file_ws`) calls `manager.connect(channel, ws)`,
   opens a short-lived `SessionLocal` to push the initial `snapshot`, then loops
   on `receive_text()` — it ignores inbound frames; this is a pure server→client
   feed. On `WebSocketDisconnect` (or any error) it `disconnect`s.
2. State-changing **HTTP** handlers are synchronous, so after `db.commit()` they
   call `manager.broadcast_sync(channel, payload)`. That schedules
   `broadcast` onto the main event loop (captured at startup), which JSON-sends
   to every socket on the channel and prunes dead ones.
3. Queue payloads come from `queue_service.queue_state_payload` (status,
   `current_number`, `total_served`, `waiting_count`, `next_numbers`) — the same
   shape returned by the `/today` and `/admin/dashboard` REST endpoints, so the
   UI handles snapshot and live events uniformly.

> Note: the Issues module *broadcasts* on `issues:{city}` from its routers, but
> ships no `/ws/issues/...` endpoint in `issues.py` — i.e. the publish side is
> wired and ready; a subscribe endpoint can be added without touching the
> manager. Module 3 (Market) has no WebSocket channel.

---

## 7. Frontend architecture

React 18 + Vite + TypeScript SPA, React Router for routing. Bootstrapped in
`main.tsx`: `BrowserRouter` → `AuthProvider` → `App`, with `./i18n` imported for
its side effects (i18next init + initial RTL direction).

### API client (`src/api/client.ts`)

- A single axios instance with `baseURL = VITE_API_URL` (default
  `http://localhost:8100`). `WS_URL` is derived by rewriting the scheme
  (`http→ws`, `https→wss`).
- A **request interceptor** auto-attaches the right bearer token by inspecting
  the URL: `/admin/*` (except `/admin/login`) uses the admin token, everything
  else uses the citizen token.
- `tokens` wraps `localStorage` for both identities
  (`civicos_citizen_token` / `_phone`, `civicos_admin_token` / `_info`).
- `api.*` is a typed facade grouping every endpoint by module
  (`auth`, `institutions`, `tickets`, `queueAdmin`, `documents`,
  `documentsAdmin`, `listings`, `sellers`, `issues`, `issuesAdmin`).
  Response types in `api/types.ts` mirror the backend Pydantic schemas.

### Auth context (`src/context/AuthContext.tsx`)

Citizen session built on phone OTP — **the verified phone is the identity**.
`useAuth()` exposes `phone`, `isAuthenticated`, `requestOtp`, `verifyOtp`,
`logout`. `verifyOtp` exchanges the code for a JWT via `api.auth.verifyOtp`,
persists it through `tokens.setCitizen`, and stores the phone in state.
`PhoneAuthModal` drives the request→verify flow (and surfaces the dev
`debug_otp`). Admin auth is separate: `AdminProtected` gates `/admin/*` pages on
the presence of an admin token from `tokens`.

### Real-time hook (`src/hooks/useWebSocket.ts`)

`useWebSocket<T>(path)` opens `${WS_URL}${path}`, parses each JSON frame into
typed `message`, and exposes `status` (`connecting | open | closed`). It
**auto-reconnects** with exponential backoff (`2^n`, capped at 10 s), resets the
backoff on open, and cleanly closes on unmount without reconnecting. Pages like
`QueueDetail` subscribe to `/ws/queue/{id}` to render a live board.

### i18n + RTL (`src/i18n.ts`)

i18next with `react-i18next` and the browser language detector. Three locales:
`en`, `fr`, `ar` (fallback `en`); the choice is cached in `localStorage`
(`civicos_lang`). On init and on every `languageChanged`, `applyDir` sets
`<html dir>` to `rtl` for Arabic (`RTL_LANGS = ["ar"]`) or `ltr` otherwise, and
sets `<html lang>`. `LanguageSwitcher` lets users toggle at runtime.

### Routing (`src/App.tsx`)

All routes render inside a shared `Layout` (Navbar/Footer). Public pages: Home,
Queue + QueueDetail, Documents, Market + MarketDetail, Report, NotFound. Admin
pages (`/admin/queue`, `/admin/documents`, `/admin/issues`) are wrapped in
`AdminProtected`; `/admin` itself is the public AdminHub (login entry).

---

## 8. Deployment & boot

`docker-compose.yml` brings up `postgres` (16) + `redis` (7) + `backend` +
`frontend`, with an **optional** `nginx` reverse proxy (`--profile proxy`) that
serves the SPA and proxies the API and `/ws/` WebSocket upgrades through a
single origin (port 8080). The backend `entrypoint.sh` waits for PostgreSQL,
runs the **idempotent** seeder (`python -m app.seeds.seed` → `create_all` + demo
data: institutions, admins, document types, issue categories, tickets, files,
listings, issues), then launches `uvicorn app.main:app` with `--proxy-headers`.
Everything is environment-configurable, so deploying for a new city/country is a
matter of overriding env vars — no code changes.
