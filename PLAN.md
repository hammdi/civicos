# CivicOS — Roadmap to Real Value

> What the MVP has, what's missing, and the order to build it so CivicOS becomes
> something citizens use daily and cities actually deploy.

**Value equation.** CivicOS is valuable when it delivers all three at once:
1. **Citizens save time & gain trust** — no queue, no lost file, visible status.
2. **Institutions save cost** — less front-desk load, fewer phone calls, clear stats.
3. **It deploys anywhere** — any city/country, self-serve onboarding, open source.

The MVP proves the idea. The items below are what turn a demo into a product.

---

## ✅ Where we are (MVP, done)

- 4 modules: Queue, Documents, Market, Issues — full CRUD + admin dashboards.
- Real citizen accounts (phone OTP + optional password, profile, `/account` dashboard).
- Admin JWT auth, institution-scoped; super-admin.
- Real-time via WebSockets (queue board, file/issue updates).
- Trilingual AR (RTL) / FR / EN, landing + help pages, brand UI.
- Dockerized, auto-seeded, pushed to GitHub.

---

## 🔴 Priority 0 — Make it deployable for real (production hardening)

Without these, it can't run in front of real citizens. *Mostly invisible, all essential.*

| Gap | Why it matters | Effort |
| --- | --- | --- |
| **DB migrations (Alembic)** — replaces `create_all` | Schema can evolve without wiping data | S |
| **OTP rate-limiting + lockout** | Today OTP can be brute-forced/spammed (SMS cost + abuse) | S |
| **Refresh tokens + revocation / logout-all** | 30-day JWT can't be revoked if a phone is lost | M |
| **Real notifications**: live Twilio SMS **+ email (SMTP)** + in-app inbox + delivery status | The whole promise is "you get notified" — currently console-only | M |
| **Secrets & config hygiene** (strong `JWT_SECRET`, `OTP_DEBUG_RETURN=false`, locked CORS, TLS) | Basic security posture for production | S |
| **Audit log** (who changed what file/issue/ticket) | Accountability & trust for a civic system | S |
| **CI/CD** (GitHub Actions: lint, typecheck, pytest, build, docker) | Stops regressions; credibility for an open-source project | S |
| **Test coverage** (API integration tests + Playwright e2e) | 5 unit tests today → need real coverage of the flows | M |
| **Observability** (structured logs, Sentry, health/readiness, Prometheus metrics) | You can't run what you can't see | M |
| **Privacy/legal** (data export & delete, consent, Privacy Policy + ToS pages, retention) | Legal requirement for citizen data | M |

---

## 🟠 Priority 1 — The features that create the value

These are *why a citizen opens the app* and *why a city signs up*.

| Feature | What's missing today | Value | Effort |
| --- | --- | --- | --- |
| **Appointment scheduling** (book a time slot) | Queue is walk-in only. Real "no queue" = reserve a slot in advance, with capacity, opening hours, and **services per institution** (a hospital has many departments) | ★★★★★ | M |
| **Document e-upload + e-delivery + e-signature** | Files are *tracked* but citizens can't **upload required docs** or **download the finished signed document** (needs S3/MinIO storage, virus scan, PDF signing) | ★★★★★ | M |
| **Payments for fees** | Passport/tax/market fees can't be paid. Integrate **IslamicFinanceOS** (interest-free escrow, zakat) + card fallback, with receipts | ★★★★☆ | M |
| **Identity verification (StateSync)** | Accounts aren't linked to a national ID → limited legal validity. KYC + **single citizen identity** via StateSync | ★★★★☆ | M |
| **Interactive maps (Leaflet)** | You already store `location_lat/lng` on issues — pin them on a real map with clustering; location-based market browsing | ★★★☆☆ | S |
| **PWA + web push** | Most citizens are on phones — installable app, offline cache, **push notifications** | ★★★★☆ | M |
| **Market: seller order management + moderation** | Orders are created but the seller can't **accept/decline** them from `/account`; no abuse/spam reporting or content moderation | ★★★☆☆ | M |
| **Smart ETA & notifications** | "Your number in ~15 min" using historical service times instead of a flat average | ★★★☆☆ | M |

---

## 🟢 Priority 2 — Scale & ecosystem (valuable to *many* cities)

| Item | Why | Effort |
| --- | --- | --- |
| **Multi-tenancy** — per-city/country isolation, self-serve institution onboarding, white-label branding | The "works for ANY city" promise made real | L |
| **Public transparency dashboards** — open data: avg wait per institution, resolution rates, SLA breaches | Delivers the *transparency* part of the vision; great for press/adoption | M |
| **Open API + webhooks** — third-party & inter-agency integration | Turns StateSync / IslamicFinanceOS connectors from docs into reality | M |
| **Analytics** — institution KPIs, citizen satisfaction, demand forecasting | Lets cities justify and optimize | M |
| **Accessibility (WCAG 2.1 AA) + more languages** | Civic tech must be usable by everyone | M |

---

## ⚡ Quick wins (high value / low effort) — start here

1. **Leaflet map** for issues & market (data already exists). — *1 day*
2. **Email notifications (SMTP)** + in-app notification inbox. — *1–2 days*
3. **Alembic migrations** + **GitHub Actions CI**. — *1–2 days*
4. **OTP rate-limit + refresh tokens**. — *1–2 days*
5. **Seller order accept/decline** in `/account` (orders already exist). — *1 day*
6. **Appointment slots** (extends the existing `queues`/`tickets` model). — *3–4 days*

---

## 📅 Suggested sequence

- **Sprint 1 — Production-ready:** Alembic · CI · OTP rate-limit + refresh tokens · live SMS + email · Sentry · secrets hygiene.
- **Sprint 2 — Core value:** appointment scheduling · document upload/e-delivery · Leaflet maps.
- **Sprint 3 — Money & identity:** payments (IslamicFinanceOS) · StateSync identity verification.
- **Sprint 4 — Scale:** multi-tenancy · transparency dashboards · open API/webhooks · PWA + push.

---

## Ecosystem integrations (your other projects)

- **StateSync** → citizen **identity & document portability** (one national identity, verified accounts, cross-institution records).
- **IslamicFinanceOS** → **payments & settlement** for fees and the Local Market (halal escrow, zakat calculation, receipts).

Both are already named as future integrations in `docs/ROADMAP.md`; Sprint 3 makes them concrete via the Open API + webhooks layer.

*Effort key: S = ~1–2 days · M = ~3–5 days · L = 1–2 weeks.*
