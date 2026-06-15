# CivicOS

> **No more physical queues. No more lost documents. No more unanswered complaints.**

CivicOS is an open-source civic platform that digitalises the essential daily
services citizens depend on. It is built to work for **any city or country** —
ship the same stack, reseed it for your institutions, and go live.

The platform bundles **four civic modules** behind one FastAPI backend and one
React frontend, with shared phone-OTP citizen auth, JWT admin auth, and live
WebSocket updates.

| Module | Arabic | What it does |
| --- | --- | --- |
| **Digital Queue System** | الطابور الرقمي | Take a ticket from your phone, watch the queue move in real time, skip the physical line. |
| **Document Tracker** | تتبع الوثائق | Follow an administrative file (ID, passport, certificate…) by reference number, from *submitted* to *ready for pickup*. |
| **Local Market** | السوق المحلي | A neighbourhood marketplace for goods and services with verified sellers, ratings and orders. |
| **Urban Issue Reporter** | بلاغ مشكل | Report potholes, broken lights, garbage, water leaks — pin them on a map, upvote, and track the fix. |

---

## Quick Start

You only need **Docker** and **Docker Compose**. Everything has sensible
development defaults, so it boots with zero configuration.

```bash
cp .env.example .env
docker compose up --build
```

Then open:

| Service | URL |
| --- | --- |
| Frontend (citizen + admin SPA) | http://localhost:3100 |
| API docs (Swagger / OpenAPI) | http://localhost:8100/docs |
| API docs (ReDoc) | http://localhost:8100/redoc |
| Health check | http://localhost:8100/health |

> Optional: run everything behind a single-origin reverse proxy on port `8080`
> with `docker compose --profile proxy up --build`.

The database schema is created and **seeded with demo data** automatically on
first boot (10 institutions across 3 cities, queue tickets, document files,
market listings, and urban issues).

---

## Demo Accounts

Seeded on first boot. **All passwords are `civicos123`.** Log in via the admin
panel (`POST /admin/login`).

| Username | Role | Manages |
| --- | --- | --- |
| `admin_hospital` | Institution admin | Hospital |
| `admin_municipality` | Institution admin | Municipality / City Hall |
| `admin_post` | Institution admin | Post office |
| `admin_court` | Institution admin | Court |
| `admin_tax` | Institution admin | Tax office |
| `superadmin` | Super admin | Any institution |

### Demo citizen accounts

Citizens have **real accounts** (name, profile, avatar, personal dashboard).
Seeded demo citizens — sign in by phone code, or use the password where shown:

| Phone | Name | Password | Pre-loaded data |
| --- | --- | --- | --- |
| `+21655000001` | Amine Ben Salah | `demo1234` | tickets, documents, listings, reports |
| `+21655000004` | Ines Khelifi | `demo1234` | — |
| `+21655000002/3/5` | (others) | phone code only | — |

The primary demo account `+21655000001` has data across all four modules, so
its **My account** dashboard (`/account`) is populated out of the box.

### How citizen authentication works

Citizens authenticate with their **phone number** (no password required), and
can optionally set a password:

1. **Register** — `POST /auth/register` `{ phone, name, email?, password?, city? }`
   creates the account and sends an OTP.
2. **Request a code** — `POST /auth/request-otp` `{ phone }`. The one-time code is
   **printed to the backend console** and — because `OTP_DEBUG_RETURN=true` in
   development — also **returned in the response** (`debug_otp`).
3. **Verify** — `POST /auth/verify-otp` `{ phone, otp }` returns a **30-day JWT**
   plus the user profile.
4. **Optional password login** — `POST /auth/login` `{ identifier, password }`
   (identifier = phone or email).
5. **Profile & dashboard** — `GET /auth/me`, `PUT /auth/me`, and
   `GET /me/overview` (all the citizen's tickets, documents, listings & reports
   in one call).

> In production, set `OTP_DEBUG_RETURN=false` and fill in the Twilio variables
> (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`) to send
> codes as real SMS instead of printing them to the console.

---

## Architecture

```
                         ┌────────────────────────────┐
                         │        Citizens / Admins     │
                         └──────────────┬───────────────┘
                                        │ HTTP + WebSocket
                                        ▼
                ┌──────────────────────────────────────────────┐
                │   Frontend  (React + Vite + Tailwind, :3100)  │
                │   citizen SPA + admin panel · i18n (AR/EN)    │
                └──────────────────────┬───────────────────────┘
                                       │  REST  +  WebSocket
                                       ▼
                ┌──────────────────────────────────────────────┐
                │   Backend  (FastAPI + SQLAlchemy, :8100)      │
                │                                              │
                │   Queue · Documents · Market · Issues         │
                │   Phone-OTP auth · JWT admin auth             │
                │   WebSocket fan-out for live updates          │
                └───────────┬──────────────────────┬───────────┘
                            │                      │
                            ▼                      ▼
                 ┌────────────────────┐   ┌────────────────────┐
                 │  PostgreSQL :5432  │   │     Redis :6379     │
                 │  (system of record)│   │  (OTP / live state) │
                 └────────────────────┘   └────────────────────┘
```

- **WebSockets** push live updates to citizens and admins — e.g. the queue
  moving (`/ws/queue/...`) and document status changes (`/ws/files/...`).
- All four modules are mounted in a single FastAPI app
  (`backend/app/main.py`).

---

## Module Overview

| # | Module | Arabic | Key endpoints |
| --- | --- | --- | --- |
| 1 | Digital Queue | الطابور الرقمي | `/institutions`, `/tickets`, `/ws/queue/...`, `/admin/queue/*`, `/admin/dashboard`, `/admin/stats` |
| 2 | Document Tracker | تتبع الوثائق | `/files`, `/document-types`, `/ws/files/...`, `/admin/files`, `/admin/files/{id}/...` |
| 3 | Local Market | السوق المحلي | `/listings`, `/sellers/...` |
| 4 | Urban Issue Reporter | بلاغ مشكل | `/issues`, `/issue-categories`, `/admin/issues/*` |
| — | Shared auth | المصادقة | `/auth/request-otp`, `/auth/verify-otp`, `/admin/login` |

Explore them all interactively at http://localhost:8100/docs.

---

## How Any City Can Deploy This

CivicOS ships with Tunisian demo data, but **nothing is hard-coded to one
country**. To run it for your own city:

1. **Clone and configure.** `cp .env.example .env`, then set a strong
   `JWT_SECRET`, set `ENVIRONMENT=production`, and `OTP_DEBUG_RETURN=false`.
2. **Wire up SMS.** Add your `TWILIO_*` credentials so OTP codes are sent as
   real SMS.
3. **Lock down origins.** Set `CORS_ORIGINS` to your real frontend domain(s)
   instead of `*`, and point `VITE_API_URL` at your public API.
4. **Reseed for your institutions.** Edit the lists in
   `backend/app/seeds/seed.py` (`COUNTRY`, `CITIES`, `NEIGHBORHOODS`,
   `INSTITUTIONS`, `DOCUMENT_TYPES`, `ISSUE_CATEGORIES`, `MARKET_ITEMS`) to
   match your geography and services — or skip the seed entirely and create
   data through the admin panel.
5. **Deploy.** `docker compose up --build -d` on your server, optionally behind
   the bundled Nginx proxy (`--profile proxy`) for a single public origin.

---

## How to Add a New Institution

An institution has a **type** (e.g. `hospital`, `municipality`, `post`,
`court`, `tax_office`), a city, an address, and an average wait time. To add
one:

1. **Add the institution.** Append an entry to the `INSTITUTIONS` list in
   `backend/app/seeds/seed.py` as `(name, type, city, avg_wait_minutes)` — or
   create it at runtime through the admin/queue endpoints.
2. **(Optional) Add document types.** If the institution issues documents,
   add entries to `DOCUMENT_TYPES` as
   `(name, institution_type, [required documents], avg_processing_days)`.
3. **Assign an admin.** Either reuse the matching seeded admin for that
   institution type, or add a new `Admin` account (the seed creates one admin
   per institution type plus a `superadmin` who can operate any institution).
4. **Reseed / restart.** Bring the stack back up; the seed is idempotent and
   skips if data already exists, so wipe the `civicos_pgdata` volume if you
   want a fresh reseed.

---

## Roadmap & Future Integrations

CivicOS is designed to plug into a larger civic/fintech ecosystem. Two
integrations are on the horizon:

- **StateSync** — keep CivicOS institution and document records in sync with a
  national government data layer (single source of truth across agencies).
- **IslamicFinanceOS** — Sharia-compliant payments and financing for market
  orders and government fees (stamp fees, processing charges, etc.).

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for details and timelines.

---

## Tech Stack

**Backend**
- Python · [FastAPI](https://fastapi.tiangolo.com/) · Uvicorn
- SQLAlchemy 2 (ORM) · Pydantic v2 · pydantic-settings
- PostgreSQL 16 · Redis 7
- JWT auth (python-jose) · password hashing (passlib + bcrypt)
- WebSockets for live updates · Twilio (optional production SMS)

**Frontend**
- React 18 · TypeScript · [Vite](https://vitejs.dev/)
- Tailwind CSS
- React Router · Axios
- i18next + react-i18next (Arabic / English, RTL-ready)

**Infrastructure**
- Docker + Docker Compose
- Optional Nginx reverse proxy (single-origin profile)

---
---

<div dir="rtl" lang="ar">

# CivicOS — نظام الخدمات المدنية

> **لا طوابير حضورية بعد اليوم. لا وثائق ضائعة. لا شكاوى دون إجابة.**

CivicOS منصّة مدنية مفتوحة المصدر تُرقمن الخدمات اليومية الأساسية التي يحتاجها
المواطن. صُمّمت لتعمل في **أي مدينة أو دولة** — انشر نفس المنظومة، أعد تعبئتها
بمؤسّساتك، وانطلق.

تجمع المنصّة **أربع وحدات مدنية** خلف خادم FastAPI واحد وواجهة React واحدة، مع
مصادقة المواطن عبر رمز الهاتف (OTP)، ومصادقة المشرفين عبر JWT، وتحديثات حيّة
عبر WebSocket.

| الوحدة | الاسم العربي | الوظيفة |
| --- | --- | --- |
| **Digital Queue System** | الطابور الرقمي | خذ تذكرتك من هاتفك، وتابع تقدّم الطابور لحظيًّا، وتجاوز الصفّ الحضوري. |
| **Document Tracker** | تتبع الوثائق | تابع ملفّك الإداري (بطاقة تعريف، جواز سفر، شهادة…) برقم مرجعي، من *مُودَع* إلى *جاهز للاستلام*. |
| **Local Market** | السوق المحلي | سوق حيّ للسلع والخدمات مع بائعين موثَّقين وتقييمات وطلبات شراء. |
| **Urban Issue Reporter** | بلاغ مشكل | بلّغ عن الحُفر وإنارة الشوارع المعطّلة والنفايات وتسرّب المياه — حدّدها على الخريطة، صوّت لها، وتابع إصلاحها. |

---

## البدء السريع

تحتاج فقط إلى **Docker** و **Docker Compose**. كل القيم لها افتراضات تطويرية
معقولة، لذا تنطلق المنظومة دون أي إعداد.

```bash
cp .env.example .env
docker compose up --build
```

ثم افتح:

| الخدمة | الرابط |
| --- | --- |
| الواجهة (تطبيق المواطن + المشرف) | http://localhost:3100 |
| توثيق الـ API (Swagger / OpenAPI) | http://localhost:8100/docs |
| توثيق الـ API (ReDoc) | http://localhost:8100/redoc |
| فحص الصحّة | http://localhost:8100/health |

> اختياري: شغّل كل شيء خلف وكيل عكسي بأصل واحد على المنفذ `8080` عبر
> `docker compose --profile proxy up --build`.

يُنشأ مخطّط قاعدة البيانات و **تُعبَّأ بياناتٌ تجريبية** تلقائيًّا عند أول
تشغيل (10 مؤسّسات في 3 مدن، تذاكر طوابير، ملفّات وثائق، إعلانات سوق، وبلاغات
حضرية).

---

## الحسابات التجريبية

تُنشأ عند أول تشغيل. **كل كلمات المرور هي `civicos123`.** سجّل الدخول عبر لوحة
المشرف (`POST /admin/login`).

| اسم المستخدم | الدور | يدير |
| --- | --- | --- |
| `admin_hospital` | مشرف مؤسّسة | المستشفى |
| `admin_municipality` | مشرف مؤسّسة | البلدية |
| `admin_post` | مشرف مؤسّسة | البريد |
| `admin_court` | مشرف مؤسّسة | المحكمة |
| `admin_tax` | مشرف مؤسّسة | قباضة الأداءات (الضرائب) |
| `superadmin` | مشرف عام | أي مؤسّسة |

### كيف يعمل دخول المواطن (OTP)

لا يحتاج المواطن إلى كلمة مرور — يُصادَق عبر **رقم هاتفه**:

1. `POST /auth/request-otp` مع `{ "phone": "+216..." }`.
   يُطبَع الرمز لمرّة واحدة في **سجلّ الخادم (console)**، وبما أنّ
   `OTP_DEBUG_RETURN=true` في وضع التطوير، فإنّه **يُعاد أيضًا في استجابة
   الـ API** (`debug_otp`) للتسهيل.
2. `POST /auth/verify-otp` مع الهاتف + الرمز لمبادلتهما برمز **JWT للمواطن
   صالح 30 يومًا**.

> في الإنتاج، اضبط `OTP_DEBUG_RETURN=false` واملأ متغيّرات Twilio
> (`TWILIO_ACCOUNT_SID`، `TWILIO_AUTH_TOKEN`، `TWILIO_FROM_NUMBER`) لإرسال
> الرموز كرسائل SMS حقيقية بدل طباعتها في السجلّ.

---

## البنية المعمارية

```
                         ┌────────────────────────────┐
                         │        المواطنون / المشرفون   │
                         └──────────────┬───────────────┘
                                        │ HTTP + WebSocket
                                        ▼
                ┌──────────────────────────────────────────────┐
                │   الواجهة  (React + Vite + Tailwind, :3100)    │
                │   تطبيق المواطن + لوحة المشرف · i18n (AR/EN)   │
                └──────────────────────┬───────────────────────┘
                                       │  REST  +  WebSocket
                                       ▼
                ┌──────────────────────────────────────────────┐
                │   الخادم  (FastAPI + SQLAlchemy, :8100)        │
                │                                              │
                │   الطابور · الوثائق · السوق · البلاغات         │
                │   مصادقة OTP للهاتف · مصادقة JWT للمشرف        │
                │   بثّ WebSocket للتحديثات الحيّة               │
                └───────────┬──────────────────────┬───────────┘
                            │                      │
                            ▼                      ▼
                 ┌────────────────────┐   ┌────────────────────┐
                 │  PostgreSQL :5432  │   │     Redis :6379     │
                 │  (سجلّ الحقيقة)     │   │  (OTP / حالة حيّة)  │
                 └────────────────────┘   └────────────────────┘
```

- **WebSockets** تدفع التحديثات الحيّة للمواطنين والمشرفين — مثل تقدّم الطابور
  (`/ws/queue/...`) وتغيّر حالة الوثيقة (`/ws/files/...`).
- الوحدات الأربع جميعها مُركَّبة في تطبيق FastAPI واحد
  (`backend/app/main.py`).

---

## نظرة عامة على الوحدات

| # | الوحدة | الاسم العربي | أهمّ المسارات |
| --- | --- | --- | --- |
| 1 | Digital Queue | الطابور الرقمي | `/institutions`, `/tickets`, `/ws/queue/...`, `/admin/queue/*`, `/admin/dashboard`, `/admin/stats` |
| 2 | Document Tracker | تتبع الوثائق | `/files`, `/document-types`, `/ws/files/...`, `/admin/files`, `/admin/files/{id}/...` |
| 3 | Local Market | السوق المحلي | `/listings`, `/sellers/...` |
| 4 | Urban Issue Reporter | بلاغ مشكل | `/issues`, `/issue-categories`, `/admin/issues/*` |
| — | المصادقة المشتركة | المصادقة | `/auth/request-otp`, `/auth/verify-otp`, `/admin/login` |

استكشفها كلّها تفاعليًّا على http://localhost:8100/docs.

---

## كيف يمكن لأي مدينة نشر هذا

تأتي CivicOS ببيانات تجريبية تونسية، لكن **لا شيء مربوط ببلد واحد**. لتشغيلها
لمدينتك:

1. **استنسخ واضبط.** `cp .env.example .env`، ثم اضبط `JWT_SECRET` قويًّا،
   و `ENVIRONMENT=production`، و `OTP_DEBUG_RETURN=false`.
2. **اربط الرسائل القصيرة.** أضف بيانات `TWILIO_*` لإرسال رموز OTP كرسائل SMS
   حقيقية.
3. **قيّد الأصول (Origins).** اضبط `CORS_ORIGINS` على نطاق واجهتك الحقيقي بدل
   `*`، ووجّه `VITE_API_URL` إلى الـ API العمومي.
4. **أعد التعبئة بمؤسّساتك.** عدّل القوائم في `backend/app/seeds/seed.py`
   (`COUNTRY`، `CITIES`، `NEIGHBORHOODS`، `INSTITUTIONS`، `DOCUMENT_TYPES`،
   `ISSUE_CATEGORIES`، `MARKET_ITEMS`) لتناسب جغرافيتك وخدماتك — أو تجاوز
   التعبئة تمامًا وأنشئ البيانات من لوحة المشرف.
5. **انشر.** `docker compose up --build -d` على خادمك، اختياريًّا خلف وكيل
   Nginx المرفق (`--profile proxy`) لأصل عمومي واحد.

---

## كيفية إضافة مؤسّسة جديدة

للمؤسّسة **نوع** (مثل `hospital`، `municipality`، `post`، `court`،
`tax_office`)، ومدينة، وعنوان، ومتوسّط زمن انتظار. لإضافة واحدة:

1. **أضِف المؤسّسة.** أضِف مدخلًا إلى قائمة `INSTITUTIONS` في
   `backend/app/seeds/seed.py` بالشكل
   `(name, type, city, avg_wait_minutes)` — أو أنشئها أثناء التشغيل عبر
   مسارات المشرف/الطابور.
2. **(اختياري) أضِف أنواع الوثائق.** إن كانت المؤسّسة تُصدر وثائق، أضِف مداخل
   إلى `DOCUMENT_TYPES` بالشكل
   `(name, institution_type, [الوثائق المطلوبة], avg_processing_days)`.
3. **عيّن مشرفًا.** إمّا أن تعيد استخدام المشرف المُعبّأ المطابق لنوع المؤسّسة،
   أو أضِف حساب `Admin` جديدًا (يُنشئ التعبئة مشرفًا واحدًا لكل نوع مؤسّسة
   إضافةً إلى `superadmin` يمكنه تشغيل أي مؤسّسة).
4. **أعِد التعبئة / التشغيل.** أعِد تشغيل المنظومة؛ التعبئة عديمة الأثر
   (idempotent) وتتجاوز إن وُجدت بيانات مسبقًا، لذا امسح حجم
   `civicos_pgdata` إن أردت تعبئة جديدة من الصفر.

---

## خارطة الطريق والتكاملات المستقبلية

صُمّمت CivicOS لتندمج في منظومة مدنية/مالية أوسع. تكاملان في الأفق:

- **StateSync** — مزامنة سجلّات المؤسّسات والوثائق في CivicOS مع طبقة بيانات
  حكومية وطنية (مصدر حقيقة واحد عبر كل الإدارات).
- **IslamicFinanceOS** — مدفوعات وتمويل متوافقان مع الشريعة لطلبات السوق
  والرسوم الحكومية (رسوم الطوابع، رسوم المعالجة، إلخ).

انظر [`docs/ROADMAP.md`](docs/ROADMAP.md) للتفاصيل والجداول الزمنية.

---

## المنظومة التقنية

**الخادم (Backend)**
- Python · FastAPI · Uvicorn
- SQLAlchemy 2 (ORM) · Pydantic v2 · pydantic-settings
- PostgreSQL 16 · Redis 7
- مصادقة JWT (python-jose) · تجزئة كلمات المرور (passlib + bcrypt)
- WebSockets للتحديثات الحيّة · Twilio (اختياري للإنتاج SMS)

**الواجهة (Frontend)**
- React 18 · TypeScript · Vite
- Tailwind CSS
- React Router · Axios
- i18next + react-i18next (عربي / إنجليزي، يدعم RTL)

**البنية التحتية**
- Docker + Docker Compose
- وكيل Nginx عكسي اختياري (ملف تعريف الأصل الواحد)

</div>
