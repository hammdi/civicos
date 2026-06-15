# CivicOS Roadmap

CivicOS is an open-source civic platform that digitalises essential daily citizen
services. It ships as a single FastAPI backend plus a React/Vite frontend, is
fully portable (any city or country deploys the same image and only changes
environment variables), and works offline of any paid third party by default —
SMS falls back to `console.log`, OTP storage falls back to in-memory, and the
WebSocket fan-out runs in-process.

This document describes where CivicOS is today, the phased plan to mature it, and
two forward-looking integrations — **StateSync** (a national e-government
identity/records backbone) and **IslamicFinanceOS** (an Islamic-finance
settlement layer for the Local Market and fee payments).

---

## Where we are today (the MVP)

The platform currently runs **four civic modules** behind one API
(`backend/app/main.py`), sharing a single auth and notification layer:

| # | Module | Arabic | What it does |
|---|--------|--------|--------------|
| 1 | **Digital Queue System** | الطابور الرقمي | Citizens take a remote ticket at an institution (hospital, municipality, post, court, tax office); admins call/serve windows; the board updates live over WebSockets (`queue:{institution_id}`). |
| 2 | **Document Tracker** | تتبع الوثائق | Citizens track an administrative file by human-friendly reference number (`REF-2026-XXXXX`) through `submitted → processing → ready → delivered/rejected`, with a per-file live channel (`file:{reference}`). |
| 3 | **Local Market** | السوق المحلي | Browse/sell/contact/review local listings, scoped by city and neighborhood, with seller profiles and ratings. Selling is phone-OTP gated. |
| 4 | **Urban Issue Reporter** | بلاغ مشكل | Citizens report geolocated urban issues with photos, upvote them, and follow status updates; issues fan out on `issues:{city}`. |

### Shared foundations already in place

- **Citizen identity = phone number.** There are no citizen passwords. A phone
  OTP (`/auth/request-otp`, `/auth/verify-otp`) is exchanged for a 30-day JWT
  whose `sub` is the phone number and whose `role` is `citizen`
  (`backend/app/core/security.py`). Every record that belongs to a citizen keys
  off that phone (`citizen_phone`, `reporter_phone`, `buyer_phone`,
  `seller.phone`, `voter_phone`).
- **Admin identity.** Username/password (bcrypt) → JWT with `role: admin` plus
  institution context (`institution_id`, `institution_type`, `is_superuser`).
- **Notifications.** `send_sms()` logs to console and the `notifications_log`
  table in development; a lazy Twilio sender activates automatically when
  `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` are set
  (`backend/app/core/notifications.py`).
- **OTP store.** Redis (`REDIS_URL`) when reachable, transparent in-memory
  fallback otherwise (`backend/app/core/otp.py`).
- **Live updates.** In-process `ConnectionManager` fan-out
  (`backend/app/core/websocket.py`) — documented as swappable for Redis pub/sub
  to scale horizontally without changing the public surface.
- **i18n.** Frontend ships English, French, and Arabic with automatic RTL
  (`frontend/src/i18n.ts`).
- **Config-as-environment.** Everything in `backend/app/core/config.py` is
  overridable via env; sensible dev defaults let it boot with zero config.

> Anything below this line is **planned**. None of the StateSync or
> IslamicFinanceOS endpoints, tables, or env vars exist in the codebase yet;
> they are design targets, with integration points chosen to fit the structures
> that already exist.

---

## Phased roadmap

### Phase 0 — Now (MVP, shipped)

- Four modules live behind one API, one Docker Compose stack.
- Phone-OTP citizen auth + admin auth.
- Console/Twilio notifications, Redis-optional OTP, in-process WebSockets.
- EN/FR/AR with RTL.

### Phase 1 — Next: harden and operationalise

1. **Real SMS / Twilio rollout.**
   - Move from the lazy single-path sender to a pluggable provider interface
     (`Notifier`) so Twilio, a local telco aggregator, or WhatsApp Business can
     be selected per deployment via env.
   - Add delivery-status callbacks: a `POST /webhooks/twilio/status` endpoint
     that reconciles `notifications_log.status` from Twilio message events
     (`queued → sent → delivered → failed`).
   - Add per-tenant sender IDs, rate limiting / OTP throttling, and retry with
     backoff. Turn `OTP_DEBUG_RETURN` off by contract in production.
2. **Payments (fee collection).** Introduce a settlement-agnostic payment layer
   (see the dedicated section below) so citizens can pay document-processing
   fees (Module 2) and so the Local Market (Module 3) can move from
   "contact the seller" to real orders. This phase establishes the abstractions
   that both classic rails (cards, mobile money) and IslamicFinanceOS plug into.
3. **Multi-tenant, per-city instances.**
   - Today institutions/listings/issues already carry `city` (and `country` on
     institutions). Phase 1 promotes "tenant" to a first-class concept: a
     `tenant` (city/region) row, a `tenant_id` on the core tables, and tenant
     resolution from host/subdomain (e.g. `tunis.civicos.app`) or an
     `X-Tenant` header.
   - Per-tenant config (branding, languages, fee schedules, SMS sender),
     per-tenant admin scoping, and row-level isolation. Operators can run one
     shared deployment for many cities or a dedicated instance per city from the
     same image.
4. **Offline-first PWA.**
   - Service worker + app manifest; cache the shells of all four modules.
   - Offline-tolerant flows: queue your ticket, draft an issue report (with
     photo + GPS), or save a market draft while offline; sync on reconnect.
   - Background sync queue keyed on the citizen's phone JWT; optimistic UI for
     status that later reconciles against the WebSocket channels.
5. **Analytics dashboards.** Build on the data already captured —
   `wait_minutes` and `total_served` (queue), `avg_processing_days` vs. actual
   (documents), `views`/orders/ratings (market), `upvote_count` and
   resolution times (issues) — to give admins per-institution and per-city
   operational dashboards (throughput, SLA breaches, hotspots map).
6. **Accessibility audits.** WCAG 2.2 AA pass across the React app: focus
   management, color contrast, screen-reader labels, keyboard navigation,
   and verified RTL parity for Arabic. Add automated axe checks to CI.
7. **More languages.** Generalise beyond EN/FR/AR — add a contributor workflow
   for `frontend/src/locales/*.json`, per-tenant default language, and ensure
   every new RTL language is registered in `RTL_LANGS`.

### Phase 2 — National & financial integrations

- **StateSync integration** — bind CivicOS citizen identity and document
  records to a national e-government backbone (single citizen identity,
  cross-institution document portability, shared audit trail). See below.
- **IslamicFinanceOS integration** — route Local Market orders and civic fee
  payments through an interest-free, halal-compliant settlement layer with
  built-in escrow and zakat calculation. See below.

### Phase 3 — Platform & ecosystem

- Public, versioned API + webhooks catalogue for third-party civic apps.
- Plugin model for additional modules (transport, utilities, permits) that
  reuse the shared identity, notification, and WebSocket layers.
- Federation between tenants (e.g. a citizen who moves cities keeps their
  StateSync identity and document portability).

---

## StateSync (future integration)

**StateSync** is envisioned as a national e-government backbone providing three
things CivicOS does not own today:

1. **Single citizen identity** — a national citizen identifier (NID) that is
   stable across every institution and city.
2. **Cross-institution document portability** — a document issued by one body
   (a birth certificate, an ID, a tax clearance) can be presented to another
   without the citizen physically re-submitting it.
3. **A shared, tamper-evident audit trail** — every read/write against a
   citizen's records is logged centrally.

CivicOS already keys every citizen record on a phone number; StateSync adds the
authoritative national identity layer on top of that, without throwing away the
phone-first UX.

### Integration point 1 — Shared identity (federated OTP → NID)

- **Today:** `verify-otp` issues a JWT with `sub = phone`, `role = citizen`.
- **With StateSync:** after OTP verification, CivicOS calls StateSync to resolve
  the phone to a national identity and enrich the token:

  ```
  POST {STATESYNC_BASE_URL}/v1/identity/resolve
  Authorization: Bearer {STATESYNC_CLIENT_TOKEN}     # CivicOS service credential
  { "phone": "+216..." , "tenant": "tunis" }
  → 200 { "nid": "TN-1990-0000123", "verified_level": "phone|kyc",
          "display_name": "…", "linked_institutions": [...] }
  ```

  The returned `nid` is embedded as an additional claim in the CivicOS JWT
  (`sub` stays the phone for backward compatibility; a new `nid` claim carries
  the national identity). For high-assurance actions, CivicOS can redirect to
  StateSync for an OIDC-style step-up (`STATESYNC_OIDC_ISSUER`,
  `STATESYNC_CLIENT_ID`, `STATESYNC_CLIENT_SECRET`) and accept a StateSync
  id_token as proof of a KYC-verified identity.
- **New config (planned):** `STATESYNC_BASE_URL`, `STATESYNC_CLIENT_ID`,
  `STATESYNC_CLIENT_SECRET`, `STATESYNC_OIDC_ISSUER`, `STATESYNC_AUDIT_WEBHOOK`.

### Integration point 2 — Document portability

CivicOS Module 2 (Document Tracker) becomes a node on StateSync's document
graph. Each CivicOS `File` (with its `reference_number`, `document_type`, and
status timeline in `file_updates`) is mirrored as a StateSync record:

- **Push** — when a file reaches `ready`/`delivered`, CivicOS publishes the
  issued document's metadata and a verifiable hash:

  ```
  POST {STATESYNC_BASE_URL}/v1/documents
  { "nid": "...", "type": "national_id_copy",
    "issuer": { "institution_id": 12, "tenant": "tunis" },
    "reference": "REF-2026-AB3KQ", "status": "ready",
    "issued_at": "...", "hash": "sha256:…" }
  ```

- **Pull** — when a citizen starts a new file that requires prerequisite
  documents (CivicOS already models `document_types.required_documents`),
  CivicOS queries StateSync for portable copies the citizen already holds,
  so they are not re-collected:

  ```
  GET {STATESYNC_BASE_URL}/v1/citizens/{nid}/documents?type=birth_certificate
  ```

  Matched prerequisites are auto-satisfied; only genuinely missing items are
  requested from the citizen.

### Integration point 3 — Shared audit trail (webhooks)

- CivicOS emits an event to StateSync for every state transition it already
  records — queue tickets called/served, `file_updates`, issue status changes,
  market orders — so the national audit log is complete:

  ```
  POST {STATESYNC_AUDIT_WEBHOOK}
  X-CivicOS-Signature: hmac-sha256(body, STATESYNC_AUDIT_SECRET)
  { "event": "document.status_changed", "nid": "...", "tenant": "tunis",
    "reference": "REF-2026-AB3KQ", "old": "processing", "new": "ready",
    "actor": "admin:12", "at": "..." }
  ```

- **Inbound** — StateSync can notify CivicOS of upstream changes (e.g. an
  identity merge, a revoked document) via a CivicOS-hosted endpoint
  `POST /webhooks/statesync` (HMAC-verified with a shared secret), letting
  CivicOS invalidate cached identity or flag dependent files.

### Trust & privacy posture

- Service-to-service calls use a CivicOS service credential, not the citizen's
  token; the citizen's token only ever proves "this phone/NID is present."
- All sync is per-tenant scoped and consented; CivicOS never stores more
  national PII than the `nid` plus what each module already needs.

---

## IslamicFinanceOS (future integration)

**IslamicFinanceOS** is envisioned as an Islamic-finance settlement layer that
CivicOS can route money through for two flows that exist or are planned in the
product:

- **Local Market (Module 3)** — turning today's "contact the seller" (`Order`
  rows in `pending/accepted/rejected/completed`) into real, settled
  transactions.
- **Civic fee payments** — fees for document processing (Module 2) and any
  paid institutional service.

The differentiator is **Sharia compliance by construction**: no interest (riba),
funds held in escrow rather than lent, automatic zakat calculation, and rails
that only touch halal-compliant instruments.

### Integration point 1 — Interest-free escrow on Market orders

- **Today:** creating an `Order` notifies the seller by SMS; no money moves.
- **With IslamicFinanceOS:** an order opens an **escrow hold** instead of a
  charge. Funds are captured from the buyer and held — never lent out or
  accruing interest — until the buyer confirms delivery, at which point they
  release to the seller; otherwise they refund.

  ```
  POST {IFOS_BASE_URL}/v1/escrow/create
  Authorization: Bearer {IFOS_CLIENT_TOKEN}
  { "buyer_ref": "+216...", "seller_ref": "+216...",
    "amount": "120.00", "currency": "TND",
    "listing": "civicos:listing:4821", "tenant": "tunis",
    "contract": "murabaha|wakala", "negotiable": true }
  → 201 { "escrow_id": "esc_…", "state": "held", "pay_url": "…" }
  ```

  CivicOS maps escrow states onto the order lifecycle it already has:
  `held → accepted`, `released → completed`, `refunded → rejected`. The seller's
  `total_sales` increments only on `released`.

### Integration point 2 — Zakat calculation on transactions

- For each settled transaction (and, optionally, on a seller's accumulated
  eligible balance), CivicOS asks IslamicFinanceOS to compute zakat and can
  offer the citizen a one-tap contribution to a registered zakat fund:

  ```
  POST {IFOS_BASE_URL}/v1/zakat/calculate
  { "subject_ref": "+216...", "basis": "transaction|holdings",
    "amount": "120.00", "currency": "TND",
    "as_of": "2026-06-15" }
  → 200 { "zakatable": "120.00", "rate": 0.025, "due": "3.00",
          "nisab_met": true }
  ```

  The result is surfaced in the receipt; if the citizen opts in, a second
  escrow/transfer routes the `due` amount to a chosen fund — fully optional and
  never auto-deducted.

### Integration point 3 — Halal-compliant payment rails for civic fees

- Document and service fees (Module 2) settle through IslamicFinanceOS rather
  than a conventional gateway:

  ```
  POST {IFOS_BASE_URL}/v1/payments/charge
  { "payer_ref": "+216...", "amount": "15.00", "currency": "TND",
    "memo": "Document fee REF-2026-AB3KQ",
    "reference": "REF-2026-AB3KQ", "tenant": "tunis",
    "rails": ["mobile_money", "bank_transfer"] }     # no interest-bearing credit
  → 201 { "payment_id": "pay_…", "state": "pending", "pay_url": "…" }
  ```

  A `File` advances out of `submitted` only once the linked payment reaches
  `settled`.

### Integration point 4 — Settlement webhooks

- IslamicFinanceOS notifies CivicOS of money-movement events via a
  CivicOS-hosted, HMAC-verified endpoint `POST /webhooks/ifos`:

  ```
  X-IFOS-Signature: hmac-sha256(body, IFOS_WEBHOOK_SECRET)
  { "event": "escrow.released" | "payment.settled" | "escrow.refunded",
    "escrow_id": "esc_…", "reference": "civicos:listing:4821",
    "amount": "120.00", "at": "..." }
  ```

  CivicOS reconciles the corresponding `Order` / `File` status on receipt and
  fires its existing WebSocket fan-out so the buyer's and seller's screens
  update live — reusing the same channel mechanism the platform already runs.

### Shared identity between the two

When both integrations are live, the `payer_ref` / `buyer_ref` passed to
IslamicFinanceOS can be the StateSync `nid` rather than a raw phone, giving a
single consistent identity across identity, records, and money — with
escrow and zakat tied to a verified citizen, and every settlement event also
landing in the StateSync audit trail.

### New config (planned)

`IFOS_BASE_URL`, `IFOS_CLIENT_ID`, `IFOS_CLIENT_SECRET`, `IFOS_WEBHOOK_SECRET`,
`IFOS_DEFAULT_CONTRACT` (e.g. `wakala`), `IFOS_ZAKAT_FUND_ID`.

---

## Guiding principles (unchanged across phases)

- **Portable by default** — one image, configured entirely by environment;
  every external dependency (SMS, payments, identity) is optional and
  gracefully degrades.
- **Phone-first, identity-ready** — the phone number remains the citizen's
  everyday handle; national identity (StateSync) layers on without breaking it.
- **Live, not polled** — new flows reuse the existing WebSocket channels.
- **Open and inclusive** — multilingual, RTL-first-class, and accessible.
