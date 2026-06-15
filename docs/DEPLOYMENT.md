# CivicOS — Deployment Guide

CivicOS is an open-source civic platform that digitalises essential daily citizen services
(digital queue, document tracker, local market, urban issue reporter). It is designed to run
for **any city or country**: you deploy the same images and change only the environment and the
seed data.

The whole stack is described by a single `docker-compose.yml` at the project root:

| Service    | Image / build        | Purpose                                                       |
|------------|----------------------|---------------------------------------------------------------|
| `postgres` | `postgres:16-alpine` | Primary datastore (data persisted in the `civicos_pgdata` volume) |
| `redis`    | `redis:7-alpine`     | OTP store + (future) WebSocket fan-out                        |
| `backend`  | `./backend`          | FastAPI API on port 8000                                      |
| `frontend` | `./frontend`         | Vite SPA built to static files, served by nginx on port 80   |
| `nginx`    | `nginx:1.27-alpine`  | **Optional** single-origin reverse proxy (profile `proxy`)   |

---

## 1. Local development quick start

Prerequisites: Docker + Docker Compose v2.

```bash
# from the project root: /path/to/civicos
cp .env.example .env          # optional — every value has a working dev default
docker compose up --build
```

That's it. Compose will:

1. Start PostgreSQL and Redis and wait for their healthchecks.
2. Build and start the backend. Its `entrypoint.sh` waits for Postgres, then runs
   `python -m app.seeds.seed` (creates all tables and seeds demo data — **idempotent**, it
   skips if any institution already exists), then launches `uvicorn app.main:app` on `:8100`.
3. Build and start the frontend (Vite build baked with `VITE_API_URL`), served by nginx.

Once up:

| URL                              | What                                    |
|----------------------------------|-----------------------------------------|
| http://localhost:3100            | Frontend SPA                            |
| http://localhost:8100            | API root                                |
| http://localhost:8100/docs       | Swagger UI                              |
| http://localhost:8100/redoc      | ReDoc                                   |
| http://localhost:8100/health     | Health check (reports DB connectivity)  |

Demo credentials seeded by `seed.py` (all use password `civicos123`):

`admin_hospital`, `admin_municipality`, `admin_post`, `admin_court`, `admin_tax`, and a
`superadmin` who can operate any institution. Log in at `/admin/login`.

Citizen auth is phone-OTP based. In development the OTP is printed to the backend console
**and** returned in the API response (because `OTP_DEBUG_RETURN=true`), so you can test without
SMS.

Useful commands:

```bash
docker compose logs -f backend          # follow backend logs (OTP codes, SMS dev output)
docker compose down                      # stop (keeps the pgdata volume)
docker compose down -v                   # stop and DELETE the database volume (fresh re-seed)
docker compose exec postgres psql -U civicos -d civicos   # open a psql shell
docker compose exec backend python -m app.seeds.seed      # re-run the seed manually
```

---

## 2. Environment variables

All variables live in `.env` (copy from `.env.example`). Every one has a sensible development
default, so `docker compose up` works with no `.env` at all. The backend also reads these via
`pydantic-settings` (`app/core/config.py`).

### Database

| Variable            | Default   | Description                                                                 |
|---------------------|-----------|-----------------------------------------------------------------------------|
| `POSTGRES_USER`     | `civicos` | Postgres role name. Used to build `DATABASE_URL` and the healthcheck.       |
| `POSTGRES_PASSWORD` | `civicos` | Postgres password. **Change in production.**                                |
| `POSTGRES_DB`       | `civicos` | Database name.                                                              |
| `POSTGRES_PORT`     | `5432`    | Host port mapped to the container's 5432.                                   |

The backend's `DATABASE_URL` is assembled by compose as
`postgresql+psycopg2://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}`.

### Redis

| Variable     | Default | Description                                                                   |
|--------------|---------|-------------------------------------------------------------------------------|
| `REDIS_PORT` | `6379`  | Host port mapped to Redis. Backend connects internally via `redis://redis:6379/0`. |

Redis backs the OTP store (`app/core/otp.py`) so codes survive across workers and auto-expire.
If Redis is unreachable, the backend **degrades gracefully** to an in-process OTP store.

### Backend

| Variable           | Default                | Description                                                                                                  |
|--------------------|------------------------|--------------------------------------------------------------------------------------------------------------|
| `BACKEND_PORT`     | `8000`                 | Host port mapped to the API container.                                                                       |
| `ENVIRONMENT`      | `development`          | `development` or `production`. `settings.is_production` is true when this equals `production` (case-insensitive). |
| `JWT_SECRET`       | `dev-secret-change-me` | HMAC key for signing admin JWTs (HS256, 30-day expiry). **Must be a long random string in production.**     |
| `OTP_DEBUG_RETURN` | `true`                 | When true, the generated OTP is returned in the API response (dev convenience). **Set to `false` in production.** |
| `CORS_ORIGINS`     | `*`                    | Comma-separated list of allowed origins, or `*` for any. Parsed into the FastAPI CORS allowlist.            |

### Frontend

| Variable        | Default                 | Description                                                                                          |
|-----------------|-------------------------|------------------------------------------------------------------------------------------------------|
| `FRONTEND_PORT` | `3000`                  | Host port mapped to the frontend nginx (container port 80).                                          |
| `VITE_API_URL`  | `http://localhost:8100` | API base URL **baked into the static bundle at build time** (it is a Docker build arg). Changing it requires a rebuild (`--build`). |

### Reverse proxy (optional)

| Variable     | Default | Description                                                          |
|--------------|---------|---------------------------------------------------------------------|
| `PROXY_PORT` | `8080`  | Host port for the optional single-origin nginx proxy (profile `proxy`). |

### Notifications (Twilio — optional)

| Variable             | Default | Description                                                                                       |
|----------------------|---------|--------------------------------------------------------------------------------------------------|
| `TWILIO_ACCOUNT_SID` | *(blank)* | Twilio account SID. Leave blank to log SMS to the console instead of sending.                  |
| `TWILIO_AUTH_TOKEN`  | *(blank)* | Twilio auth token.                                                                             |
| `TWILIO_FROM_NUMBER` | *(blank)* | Sender phone number.                                                                            |

SMS sending (`app/core/notifications.py`) only goes through Twilio when **all three** values are
present. Otherwise every message is printed to the console and recorded in the
`notifications_log` table — so the platform runs anywhere with zero external dependencies.

---

## 3. Single-origin reverse proxy (`--profile proxy`)

By default the API (`:8100`) and SPA (`:3100`) are on separate origins, which requires CORS.
For production you usually want everything on **one origin** behind one port. The `nginx`
service (compose profile `proxy`, config in `nginx/nginx.conf`) does exactly that.

```bash
# point the SPA at the proxy origin so its API calls go to the same host,
# then bring up the stack WITH the proxy
VITE_API_URL=http://localhost:8090 docker compose --profile proxy up --build
```

Then open **http://localhost:8090**. The proxy (`nginx/nginx.conf`) routes:

- **API** — any path starting with one of:
  `institutions`, `tickets`, `files`, `document-types`, `listings`, `sellers`, `issues`,
  `issue-categories`, `auth`, `admin`, `health`, `docs`, `redoc`, `openapi.json` → `backend:8100`
- **WebSockets** — `/ws/` (with `Upgrade`/`Connection` headers and a 3600s read timeout) → `backend:8100`
- **Everything else** — `/` → `frontend:80` (the SPA)

The proxy passes `X-Forwarded-For` / `X-Forwarded-Proto`, and the backend already runs uvicorn
with `--proxy-headers` (see `entrypoint.sh`), so client IP and scheme are honoured.

> Important: because `VITE_API_URL` is baked at build time, you must rebuild the frontend
> (`--build`) whenever you change it.

---

## 4. Production hardening checklist

Do **all** of the following before exposing CivicOS publicly:

1. **`JWT_SECRET`** — set to a long random string. Generate one:
   ```bash
   openssl rand -hex 48
   ```
   Anyone who knows this can forge admin tokens.
2. **`ENVIRONMENT=production`** — flips `settings.is_production` on.
3. **`OTP_DEBUG_RETURN=false`** — stops the OTP being returned in API responses (otherwise
   anyone can log in as any phone number).
4. **`CORS_ORIGINS`** — replace `*` with your real origin(s), comma-separated, e.g.
   `CORS_ORIGINS=https://civic.mytown.gov,https://admin.mytown.gov`. Note the API sends
   `allow_credentials=true`; do not pair that with `*` in production.
5. **Twilio credentials** — set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
   so OTP/status SMS are actually delivered (all three required, or it falls back to console).
6. **Database credentials** — change `POSTGRES_USER` / `POSTGRES_PASSWORD` away from `civicos`,
   and do not expose `POSTGRES_PORT` publicly (remove the host port mapping if the DB only needs
   to be reachable inside the compose network).
7. **Postgres backups** — schedule regular dumps of the `civicos_pgdata` volume:
   ```bash
   # nightly logical backup
   docker compose exec -T postgres pg_dump -U civicos -d civicos | gzip > civicos-$(date +%F).sql.gz

   # restore
   gunzip -c civicos-2026-06-15.sql.gz | docker compose exec -T postgres psql -U civicos -d civicos
   ```
   Drive this from cron / a managed backup job and store the dumps off-host.
8. **TLS termination** — run the stack behind the `proxy` profile and terminate HTTPS in front
   of it (managed load balancer, or your own nginx/Caddy/Traefik with Let's Encrypt). Forward to
   the proxy's `PROXY_PORT`; the backend already trusts `X-Forwarded-Proto` via `--proxy-headers`.
9. **Confirm** `/health` returns `{"status":"ok", ...}` (it reports `degraded` if the DB is
   unreachable).

A minimal production `.env`:

```env
ENVIRONMENT=production
JWT_SECRET=<openssl rand -hex 48 output>
OTP_DEBUG_RETURN=false
CORS_ORIGINS=https://civic.mytown.gov
POSTGRES_USER=civicos_prod
POSTGRES_PASSWORD=<strong random>
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_FROM_NUMBER=+1xxxxxxxxxx
VITE_API_URL=https://civic.mytown.gov
PROXY_PORT=8080
```

---

## 5. Deploying for a NEW city / country from scratch

CivicOS is intentionally generic: city/country specifics live entirely in the **seed data**, not
the code. To stand up a fresh deployment for a new place:

```bash
# 1. Clone and configure
git clone <your fork of civicos> && cd civicos
cp .env.example .env
# edit .env per the production checklist above
```

2. **Customise the seed data** (this is the city/country layer). Edit
   `backend/app/seeds/seed.py` — the constants near the top drive everything:
   - `COUNTRY` — e.g. `"Tunisia"` → your country.
   - `CITIES` — list of your cities.
   - `NEIGHBORHOODS` — map of city → neighborhoods (used by market/issues).
   - `INSTITUTIONS` — list of `(name, type, city, avg_wait_minutes)`. Valid `type` values used
     elsewhere: `hospital`, `municipality`, `post`, `court`, `tax_office`.
   - `DOCUMENT_TYPES` — `(name, institution_type, [required_documents], avg_processing_days)`.
   - `ISSUE_CATEGORIES` — `(name, icon, responsible_dept)`.
   - The map coordinates inside `seed_issues` (`coords` dict) per city for the issue map.

   Tip: the seed uses a fixed RNG (`random.Random(42)`) so demo data is reproducible. For a real
   deployment you can trim `seed_queues_and_tickets`, `seed_files`, `seed_market`, `seed_issues`
   (the demo content) and keep only `seed_institutions`, `seed_admins`, `seed_document_types`,
   and the issue-category creation in `run()`.

```bash
# 3. Build and start
docker compose --profile proxy up --build -d

# 4. The backend entrypoint auto-runs the seed on first boot (idempotent).
#    Verify it landed:
docker compose logs backend | grep -i seed
```

5. **Change the default admin passwords immediately.** The seed creates admins with password
   `civicos123` (constant `DEFAULT_PASSWORD`). Either change `DEFAULT_PASSWORD` before first seed,
   or update the hashes after (see next section). Put HTTPS in front (section 4).

Re-seeding behaviour: the seed is skipped if any institution already exists
(`already_seeded()`), so it is safe on every reboot. To re-seed from clean, wipe the volume:
`docker compose down -v && docker compose up --build`.

---

## 6. Adding institutions, document types & issue categories

There is **no admin UI/endpoint to create these entities** — the admin routers only operate
existing queues/files/issues. They are managed via the **seed pattern** (recommended, version
controlled) or directly in the database.

### Option A — seed pattern (recommended)

Add entries to the constants in `backend/app/seeds/seed.py`:

- **Institution** → append to `INSTITUTIONS`:
  `("Gabès Municipality", "municipality", "Gabès", 12)`
- **Document type** → append to `DOCUMENT_TYPES`:
  `("Marriage Certificate", "municipality", ["ID copy", "Witness IDs"], 4)`
  (the seed links it to the first institution of that type)
- **Issue category** → append to `ISSUE_CATEGORIES`:
  `("Noise Complaint", "🔊", "Environmental Health")`

Then re-run against a **fresh** DB (the idempotent guard prevents partial re-seeding into an
already-seeded DB):

```bash
docker compose down -v
docker compose up --build
```

### Option B — insert directly into the database (for an already-seeded prod DB)

When you can't wipe production, insert rows by hand. Open a psql shell and add records to the
underlying tables (models: `Institution` in `app/models/queue.py`, `DocumentType` in
`app/models/documents.py`, `IssueCategory` in `app/models/issues.py`):

```bash
docker compose exec postgres psql -U civicos -d civicos
```

```sql
-- New institution
INSERT INTO institutions (name, type, city, country, address, avg_wait_minutes, is_active)
VALUES ('Gabès Municipality', 'municipality', 'Gabès', 'Tunisia',
        '12 Avenue Habib Bourguiba, Gabès', 12, true)
RETURNING id;

-- New document type (link to an institution id from above)
INSERT INTO document_types (name, institution_id, required_documents, avg_processing_days)
VALUES ('Marriage Certificate', <institution_id>,
        '["ID copy","Witness IDs"]'::json, 4);

-- New issue category
INSERT INTO issue_categories (name, icon, responsible_dept)
VALUES ('Noise Complaint', '🔊', 'Environmental Health');
```

(`required_documents` and `photos` are JSON columns.) New tables are created automatically on
boot via `Base.metadata.create_all`; there is no separate migration tool.

### Adding / rotating admin accounts

Admins live in the `admins` table (`app/models/admin.py`) with a bcrypt-style `password_hash`
produced by `app.core.security.hash_password`. To create or reset one without re-seeding:

```bash
docker compose exec backend python - <<'PY'
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.admin import Admin
db = SessionLocal()
admin = db.query(Admin).filter_by(username="admin_municipality").first()
admin.password_hash = hash_password("a-new-strong-password")
db.commit()
print("updated", admin.username)
PY
```

---

## 7. Scaling notes

For a single backend replica the stack is complete as-is: OTPs are stored in Redis (with an
in-memory fallback) and WebSocket fan-out is handled by an **in-process** `ConnectionManager`
(`app/core/websocket.py`). Clients subscribe to named channels (`queue:<institution_id>`,
`file:<reference>`, `issues:<city>`) and receive live JSON broadcasts.

**The in-process WebSocket manager does not span replicas.** A broadcast triggered on one backend
replica is only delivered to WebSocket clients connected to *that same replica*. So if you run
multiple backend replicas behind a load balancer, live updates will be partial.

To scale the backend horizontally:

1. **Run multiple backend replicas.** Compose can do this for quick tests
   (`docker compose up --scale backend=3`), but note `container_name: civicos-backend` in the
   compose file pins a single name — remove/override `container_name` (or move to a real
   orchestrator like Kubernetes / ECS) before scaling. Put the load balancer / proxy in front.
2. **Move WebSocket fan-out to Redis pub/sub.** Redis is already in the stack and already wired
   for the OTP store. The manager is built for this swap — the module docstring states: *"To
   scale horizontally, swap `broadcast` for a Redis pub/sub publish — the public surface stays
   identical."* Concretely:
   - On `broadcast`/`broadcast_sync`, `PUBLISH` the message to a Redis channel named after the
     CivicOS channel instead of (or in addition to) writing to local sockets.
   - Each replica runs a background `SUBSCRIBE` loop that, on receiving a message, delivers it to
     its **local** subscribers of that channel (the existing local-delivery code).
   - The channel-name helpers (`queue_channel`, `file_channel`, `issues_channel`) already give
     you stable channel keys to publish on.
   This makes a broadcast on any replica reach every connected client regardless of which replica
   it landed on. No client-facing or router code changes — only the internals of
   `app/core/websocket.py`.
3. **Database & Redis** become the shared state tier — scale Postgres with a managed
   service / read replicas as load grows; keep Redis as the single coordination point for OTPs
   and pub/sub.
