# Contributing to CivicOS

Thanks for your interest in improving CivicOS — an open-source civic platform that
digitalises essential daily citizen services (Digital Queue, Document Tracker,
Local Market, Urban Issue Reporter). It is designed to work for **any** city or
country, so contributions that improve portability, accessibility, and
localisation are especially welcome.

This guide covers local setup, code style, the branch/PR flow, and how to add a
new module or language.

---

## Table of contents

- [Project layout](#project-layout)
- [Development setup](#development-setup)
  - [Prerequisites](#prerequisites)
  - [Backend (FastAPI / Python)](#backend-fastapi--python)
  - [Frontend (React / Vite / TypeScript)](#frontend-react--vite--typescript)
  - [Full stack with Docker](#full-stack-with-docker)
- [Environment variables](#environment-variables)
- [Code style](#code-style)
- [Branch & PR flow](#branch--pr-flow)
- [Adding a new module](#adding-a-new-module)
- [Adding a new language](#adding-a-new-language)
- [Code of conduct](#code-of-conduct)

---

## Project layout

```
civicos/
├── backend/            FastAPI application (Python)
│   ├── app/
│   │   ├── core/       config, database, security, otp, notifications, websocket
│   │   ├── models/     SQLAlchemy models (queue, documents, market, issues, admin)
│   │   ├── routers/    HTTP + WebSocket routes (one public + one admin per module)
│   │   ├── schemas/    Pydantic request/response models
│   │   ├── services/   business logic (e.g. queue_service)
│   │   ├── seeds/      idempotent seed data
│   │   └── main.py     app factory, router registration, /health
│   ├── tests/          pytest unit tests
│   ├── requirements.txt
│   └── pytest.ini
├── frontend/           React + Vite + TypeScript single-page app
│   └── src/
│       ├── api/        axios client + shared types
│       ├── components/ reusable UI
│       ├── context/    React context (auth)
│       ├── hooks/      e.g. useWebSocket
│       ├── lib/        constants & formatting helpers
│       ├── locales/    i18n JSON files (en.json, fr.json, ar.json)
│       ├── pages/      routed pages (incl. pages/admin)
│       └── i18n.ts     i18next setup
├── docker-compose.yml  full stack (frontend, backend, postgres, redis, optional proxy)
├── Makefile            common dev commands
└── .env.example        copy to .env
```

The backend hosts four civic modules in a single FastAPI app:

| Module | Description |
| ------ | ----------- |
| Queue | Digital Queue System |
| Documents | Document Tracker |
| Market | Local Market |
| Issues | Urban Issue Reporter |

Shared infrastructure: phone-OTP citizen auth, JWT admin auth, console/Twilio
notifications, and a WebSocket fan-out for live updates.

---

## Development setup

### Prerequisites

- **Python 3.11** (the backend Docker image is `python:3.11-slim`)
- **Node.js 18+** and **npm**
- **PostgreSQL** and **Redis** if you run the backend outside Docker
- **Docker** + **Docker Compose** (optional, for the one-command full stack)

The fastest path is `docker compose up` (or `make up`), which needs no changes to
the defaults. The sections below describe running each side natively.

### Backend (FastAPI / Python)

From the `backend/` directory:

```bash
cd backend

# 1. Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run the dev server (needs a reachable Postgres/Redis or set DATABASE_URL)
uvicorn app.main:app --reload --port 8000
```

The API is then available at `http://localhost:8100`, with interactive docs at
`/docs` (Swagger) and `/redoc`, and a liveness/DB check at `/health`.

**Run the tests** (the unit suite needs no database or network):

```bash
cd backend
pip install pytest          # if not already installed
pytest                      # or: pytest -q
```

`pytest.ini` sets `pythonpath = .` and `testpaths = tests`, so run `pytest` from
the `backend/` directory. You can also use `make test` from the repo root.

> Tip: `make be-dev` runs the backend with `--reload`, and `make seed` re-runs the
> idempotent seeder inside the backend container.

### Frontend (React / Vite / TypeScript)

From the `frontend/` directory:

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Start the Vite dev server (http://localhost:3100)
npm run dev

# 3. Type-check (no emit) — run this before opening a PR
npm run typecheck
```

Other scripts:

- `npm run build` — type-check (`tsc -b`) then produce a production build (`vite build`)
- `npm run preview` — preview the production build locally

> Tip: `make fe-dev` from the repo root runs `npm install && npm run dev`.

### Full stack with Docker

From the repo root:

```bash
cp .env.example .env          # optional; sensible dev defaults already work
make up                       # docker compose up --build (frontend, backend, postgres, redis)
```

Useful targets (see `make help`):

- `make logs` — tail backend logs (**OTP codes & notifications appear here** in dev)
- `make ps` — show running services
- `make proxy` — start with the optional single-origin nginx reverse proxy on port 8080
- `make down` — stop and remove containers
- `make clean` — remove containers **and the Postgres volume (destroys data)**
- `make reset` — wipe everything and start fresh

---

## Environment variables

Copy `.env.example` to `.env` and adjust for your city/country. Everything has a
sensible development default, so `docker compose up` works with no changes. Key
variables:

| Variable | Purpose |
| -------- | ------- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_PORT` | Database connection |
| `REDIS_PORT` | Redis port |
| `BACKEND_PORT` | Backend port (default 8000) |
| `ENVIRONMENT` | `development` or `production` |
| `JWT_SECRET` | **Change in production** — long random string |
| `OTP_DEBUG_RETURN` | Return the OTP in the API response (dev only!) |
| `CORS_ORIGINS` | Comma-separated origins, or `*` for any |
| `FRONTEND_PORT` | Frontend port (default 3000) |
| `VITE_API_URL` | Base URL the frontend uses to reach the API |
| `PROXY_PORT` | Optional single-origin reverse proxy port (default 8080) |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | Leave blank to log notifications to the console; fill to enable real SMS |

**Never commit a real `.env` file or secrets.** `.env`, `.env.local`, and `*.pem`
are already git-ignored.

---

## Code style

We keep the style close to the ecosystem defaults so changes stay reviewable.

**Python (backend)**

- Follow **PEP 8**, formatted in a **Black**-like style (4-space indentation,
  double quotes, trailing commas in multi-line literals). If you have Black
  installed, running it on your changes is the easiest way to match.
- Use `from __future__ import annotations` and add **type hints** to function
  signatures (the existing modules do).
- Write clear module/function **docstrings**, as the existing `app/` modules do.
- Keep business logic in `app/services/`, data access in `app/models/`, and
  request/response shapes in `app/schemas/`. Routers stay thin.

**TypeScript / React (frontend)**

- Format in a **Prettier**-like style (2-space indentation, double quotes,
  semicolons). Match the surrounding files.
- TypeScript runs in `strict` mode — `npm run typecheck` must pass with no errors
  before you open a PR.
- Prefer functional components and hooks. Reusable UI lives in `components/`,
  routed views in `pages/`, and shared helpers in `lib/`.
- Use the `@/*` path alias (mapped to `src/*`) for imports where it improves
  clarity.
- **Never hard-code user-facing strings** — use i18n keys (see
  [Adding a new language](#adding-a-new-language)).

---

## Branch & PR flow

1. **Fork** the repository (external contributors) and clone your fork.
2. Create a **topic branch** off the default branch:
   ```bash
   git checkout -b feat/queue-sms-reminders
   ```
   Use a short prefix describing the change: `feat/`, `fix/`, `docs/`, `refactor/`,
   `test/`, or `chore/`.
3. Make focused commits with clear, imperative messages
   (e.g. `Add SMS reminder for queue position`). Keep unrelated changes in
   separate PRs.
4. Before pushing, make sure the relevant checks pass locally:
   - Backend: `pytest` (from `backend/`)
   - Frontend: `npm run typecheck` (and `npm run build` for build-affecting changes)
5. **Push** your branch and open a **Pull Request** against the default branch.
   In the PR description, explain *what* changed and *why*, list any new env vars
   or migrations, and link related issues.
6. Address review feedback by pushing additional commits to the same branch.
7. A maintainer merges once CI/review passes. Squash-merge is preferred to keep
   history tidy.

---

## Adding a new module

CivicOS modules are self-contained slices of the FastAPI app. To add one (for
example, `permits`):

1. **Models** — add `backend/app/models/permits.py` with your SQLAlchemy models,
   inheriting from the shared `Base`.
2. **Schemas** — add Pydantic request/response models under
   `backend/app/schemas/`.
3. **Service** — put business logic in `backend/app/services/permits_service.py`.
4. **Routers** — create a public router and (if needed) an admin router, mirroring
   the existing pattern (e.g. `permits.py` and `permits_admin.py`).
5. **Register** the routers and the module name in `backend/app/main.py`:
   - add the import to the `from app.routers import (...)` block,
   - add `"permits"` to the `MODULES` list,
   - add `app.include_router(permits.router)` (and the admin router) in the same
     section style as the existing modules.
6. **Seeds** — extend `backend/app/seeds/` with idempotent seed data if useful.
7. **Tests** — add unit tests under `backend/tests/`.
8. **Frontend** — add an API surface in `src/api/`, page(s) under `src/pages/`
   (and `src/pages/admin/` for admin views), wire routes in `App.tsx`, and add the
   module's UI strings to **every** locale file (see below).

---

## Adding a new language

The frontend uses **i18next** (`src/i18n.ts`). The canonical key set lives in
`src/locales/en.json`; `fr.json` and `ar.json` mirror it. To add a language
(for example, Spanish, `es`):

1. **Create the locale file** `src/locales/es.json` by copying `en.json` and
   translating the values. It must mirror **all** keys in `en.json` exactly —
   missing keys fall back to English (`fallbackLng: "en"`), so keep them in sync.
2. **Register it in `src/i18n.ts`:**
   - import the file: `import es from "./locales/es.json";`
   - add it to `resources`: `es: { translation: es },`
   - add the code to `supportedLngs`: `["en", "fr", "ar", "es"]`.
3. **Right-to-left languages:** if the language is RTL (like Arabic), add its code
   to the `RTL_LANGS` array in `src/i18n.ts`. The `applyDir` helper then sets the
   `dir` and `lang` attributes on `<html>` automatically.
4. **Add it to the language switcher** so users can select it
   (`src/components/LanguageSwitcher.tsx`).
5. Run `npm run dev` and switch languages to verify there are no missing keys or
   layout issues.

When you add new UI strings in a feature, add the corresponding key to **every**
locale file (not just `en.json`) so translations stay complete.

---

## Code of conduct

CivicOS exists to make public services more accessible, and our community should
reflect that spirit. We are committed to providing a friendly, safe, and welcoming
environment for everyone, regardless of background, identity, or experience level.

Expected behaviour:

- Be respectful, patient, and considerate in issues, reviews, and discussions.
- Assume good intent; give and accept constructive feedback gracefully.
- Welcome newcomers and help them get started.

Unacceptable behaviour includes harassment, discriminatory or demeaning comments,
personal attacks, and publishing others' private information without consent.

If you experience or witness unacceptable behaviour, please report it to the
project maintainers. Maintainers will review reports in good faith and may take
any action they deem appropriate, up to and including removing a contributor from
the project. By participating, you agree to uphold these standards.

---

Thank you for helping build CivicOS. No more physical queues. No more lost
documents. No more unanswered complaints.
