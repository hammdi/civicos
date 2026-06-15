import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  LogOut,
  ChevronRight,
  LogIn,
  ShieldCheck,
  BadgeCheck,
  Wallet,
  CreditCard,
  type LucideIcon,
} from "lucide-react";

import { api } from "../api/client";
import type { MeOverview, Payment } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { MODULE_ICONS } from "../lib/icons";
import { formatDate, formatPrice } from "../lib/format";
import { firstPhoto } from "../lib/images";

import Avatar from "../components/Avatar";
import StatusBadge from "../components/StatusBadge";
import SmartImage from "../components/SmartImage";
import EmptyState from "../components/EmptyState";
import Spinner from "../components/Spinner";
import AuthModal from "../components/AuthModal";

type Tab = "overview" | "profile";

type ModuleKey = "queue" | "documents" | "market" | "reports";

// Static (non-interpolated) accent classes so Tailwind's JIT keeps them.
const CHIP: Record<ModuleKey, string> = {
  queue: "bg-queue/10 text-queue",
  documents: "bg-documents/10 text-documents",
  market: "bg-market/10 text-market",
  reports: "bg-reports/10 text-reports",
};

const TILES: {
  key: ModuleKey;
  countKey: keyof MeOverview["counts"];
}[] = [
  { key: "queue", countKey: "tickets" },
  { key: "documents", countKey: "documents" },
  { key: "market", countKey: "listings" },
  { key: "reports", countKey: "issues" },
];

/* ------------------------------------------------------------------ */
/* Reusable section shell                                              */
/* ------------------------------------------------------------------ */

function Section({
  icon: Icon,
  accent,
  title,
  empty,
  children,
}: {
  icon: LucideIcon;
  accent: ModuleKey;
  title: string;
  empty: string;
  children?: React.ReactNode;
}) {
  const isEmpty = !children || (Array.isArray(children) && children.length === 0);
  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span
          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${CHIP[accent]}`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <h3 className="text-base font-semibold text-navy">{title}</h3>
      </div>
      {isEmpty ? (
        <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          {empty}
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-slate-100">{children}</div>
      )}
    </section>
  );
}

function Row({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0 transition hover:bg-slate-50/70 -mx-2 px-2 rounded-lg"
    >
      {children}
      <ChevronRight className="ms-auto h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-slate-500 rtl:rotate-180" />
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Account page                                                       */
/* ------------------------------------------------------------------ */

export default function Account() {
  const { t } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();

  const [authOpen, setAuthOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<MeOverview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setOverview(null);
      return;
    }
    let active = true;
    setLoading(true);
    api.auth
      .overview()
      .then((data) => {
        if (active) setOverview(data);
      })
      .catch(() => {
        if (active) setOverview(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  /* ---- Gate for signed-out visitors ---- */
  if (!isAuthenticated || !user) {
    return (
      <div className="container-page py-12">
        <div className="mx-auto max-w-lg">
          <EmptyState icon="🔐" title={t("account.loginRequired")}>
            <p className="mb-5">{t("account.loginRequiredDesc")}</p>
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <LogIn className="h-4 w-4" />
              {t("common.login")}
            </button>
          </EmptyState>
        </div>
        {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
      </div>
    );
  }

  const counts = overview?.counts;

  return (
    <div className="container-page py-8 sm:py-10">
      {/* Header */}
      <header className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-7">
        <Avatar name={user.name} src={user.avatar_url} size={64} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-bold text-navy sm:text-2xl">
              {user.name}
            </h1>
            {user.is_verified && (
              <span className="badge inline-flex items-center gap-1 bg-civic-green/10 text-civic-greenDark">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t("account.verified")}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {t("account.memberSince", { date: formatDate(user.created_at) })}
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="btn-ghost inline-flex items-center justify-center gap-2 sm:self-start"
        >
          <LogOut className="h-4 w-4" />
          {t("account.signOut")}
        </button>
      </header>

      {/* Verified identity (StateSync) */}
      <IdentityCard />

      {/* Tabs */}
      <div className="mt-6 flex gap-1 rounded-2xl bg-slate-100 p-1">
        {(["overview", "profile"] as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === key
                ? "bg-white text-navy shadow-sm"
                : "text-slate-500 hover:text-navy"
            }`}
          >
            {t(`account.${key}`)}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" ? (
          loading && !overview ? (
            <Spinner label={t("common.loading")} />
          ) : (
            <OverviewTab overview={overview} counts={counts} />
          )
        ) : (
          <ProfileTab />
        )}
      </div>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overview tab                                                        */
/* ------------------------------------------------------------------ */

function OverviewTab({
  overview,
  counts,
}: {
  overview: MeOverview | null;
  counts: MeOverview["counts"] | undefined;
}) {
  const { t } = useTranslation();

  const tickets = overview?.tickets ?? [];
  const documents = overview?.documents ?? [];
  const listings = overview?.listings ?? [];
  const issues = overview?.issues ?? [];

  return (
    <div className="space-y-6">
      {/* Count tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {TILES.map(({ key, countKey }) => {
          const Icon = MODULE_ICONS[key];
          return (
            <div key={key} className="card flex items-center gap-3 p-4">
              <span
                className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${CHIP[key]}`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-none text-navy">
                  {counts ? counts[countKey] : 0}
                </p>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {t(`nav.${key === "reports" ? "report" : key}`)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* My tickets */}
      <Section
        icon={MODULE_ICONS.queue}
        accent="queue"
        title={t("account.myTickets")}
        empty={t("account.nothingTickets")}
      >
        {tickets.map((ticket) => (
          <Row key={ticket.id} to="/queue">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-queue/10 text-sm font-bold text-queue">
              {ticket.number}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-navy">
                {ticket.service_type || t("queue.getTicket")}
              </p>
              <p className="text-xs text-slate-400">{formatDate(ticket.created_at)}</p>
            </div>
            <span className="ms-auto">
              <StatusBadge status={ticket.status} />
            </span>
          </Row>
        ))}
      </Section>

      {/* My documents */}
      <Section
        icon={MODULE_ICONS.documents}
        accent="documents"
        title={t("account.myDocuments")}
        empty={t("account.nothingDocuments")}
      >
        {documents.map((doc) => (
          <Row key={doc.id} to="/documents">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-navy">
                {doc.document_type?.name || doc.reference_number}
              </p>
              <p className="text-xs text-slate-400">
                {doc.reference_number} · {formatDate(doc.submitted_at)}
              </p>
            </div>
            <span className="ms-auto">
              <StatusBadge status={doc.status} />
            </span>
          </Row>
        ))}
      </Section>

      {/* My listings */}
      <Section
        icon={MODULE_ICONS.market}
        accent="market"
        title={t("account.myListings")}
        empty={t("account.nothingListings")}
      >
        {listings.map((listing) => (
          <Row key={listing.id} to={`/market/${listing.id}`}>
            <SmartImage
              src={firstPhoto(listing.photos, listing.title, listing.category)}
              alt={listing.title}
              fallbackLabel={listing.title}
              fallbackKey={listing.category}
              className="h-11 w-11 shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-navy">{listing.title}</p>
              <p className="text-xs text-slate-400">{formatPrice(listing.price)}</p>
            </div>
            <span className="ms-auto">
              <StatusBadge status={listing.status} />
            </span>
          </Row>
        ))}
      </Section>

      {/* My reports */}
      <Section
        icon={MODULE_ICONS.reports}
        accent="reports"
        title={t("account.myReports")}
        empty={t("account.nothingReports")}
      >
        {issues.map((issue) => (
          <Row key={issue.id} to="/report">
            <SmartImage
              src={firstPhoto(issue.photos, issue.title, "reports")}
              alt={issue.title}
              fallbackLabel={issue.title}
              fallbackKey="reports"
              className="h-11 w-11 shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-navy">{issue.title}</p>
              <p className="text-xs text-slate-400">
                {issue.reference_number} · {formatDate(issue.created_at)}
              </p>
            </div>
            <span className="ms-auto">
              <StatusBadge status={issue.status} />
            </span>
          </Row>
        ))}
      </Section>

      {/* My payments */}
      <PaymentsSection initial={overview?.payments ?? []} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Identity verification (StateSync)                                  */
/* ------------------------------------------------------------------ */

function IdentityCard() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const [cin, setCin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!user) return null;
  const verified = user.identity_verified;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const res = await api.identity.verify(cin.trim());
      if (res.identity_verified) {
        await refresh();
        setMsg(t("identity.verifiedAs", { name: res.official_name || user.name }));
      } else if (!res.statesync_available) {
        setErr(t("identity.unavailable"));
      } else {
        setErr(t("identity.notFound"));
      }
    } catch {
      setErr(t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card mt-6 p-6">
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${
            verified ? "bg-civic-green/10 text-civic-greenDark" : "bg-navy/10 text-navy"
          }`}
        >
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-navy">{t("identity.title")}</h3>
          <p className="text-sm text-slate-500">{t("identity.subtitle")}</p>
        </div>
        {verified && (
          <span className="badge ms-auto inline-flex items-center gap-1 bg-civic-green/10 text-civic-greenDark">
            <BadgeCheck className="h-3.5 w-3.5" />
            {t("identity.verified")}
          </span>
        )}
      </div>

      {verified ? (
        <p className="mt-4 rounded-xl bg-civic-green/5 px-4 py-3 text-sm text-slate-600">
          {t("identity.verifiedAs", { name: user.name })} · CIN {user.national_id}
          {user.identity_verified_at &&
            ` · ${t("identity.verifiedOn", { date: formatDate(user.identity_verified_at) })}`}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="label" htmlFor="cin">
              {t("identity.nationalId")}
            </label>
            <input
              id="cin"
              className="input"
              value={cin}
              onChange={(e) => setCin(e.target.value)}
              placeholder={t("identity.placeholder")}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={busy || !cin.trim()}>
            {busy ? t("identity.verifying") : t("identity.verifyBtn")}
          </button>
        </form>
      )}

      {err && <p className="mt-3 text-sm text-reports">{err}</p>}
      {msg && (
        <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-civic-greenDark">
          <CheckCircle2 className="h-4 w-4" />
          {msg}
        </p>
      )}
      <p className="mt-3 text-xs text-slate-400">{t("identity.poweredBy")}</p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Payments (IslamicFinanceOS)                                        */
/* ------------------------------------------------------------------ */

const PAY_COLORS: Record<string, string> = {
  paid: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-700",
  refunded: "bg-slate-200 text-slate-700",
};

function PaymentBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return (
    <span className={`badge ${PAY_COLORS[status] || "bg-slate-100 text-slate-700"}`}>
      {t(`payments.${status}`, { defaultValue: status })}
    </span>
  );
}

function PaymentsSection({ initial }: { initial: Payment[] }) {
  const { t } = useTranslation();
  const [payments, setPayments] = useState<Payment[]>(initial);

  useEffect(() => setPayments(initial), [initial]);

  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-civic-green/10 text-civic-greenDark">
          <Wallet className="h-5 w-5" />
        </span>
        <h3 className="text-base font-semibold text-navy">{t("account.myPayments")}</h3>
      </div>

      {payments.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          {t("account.nothingPayments")}
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-slate-100">
          {payments.map((p) => (
            <PaymentRow
              key={p.id}
              payment={p}
              onPaid={(updated) =>
                setPayments((ps) => ps.map((x) => (x.id === updated.id ? updated : x)))
              }
            />
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-slate-400">{t("payments.poweredBy")}</p>
    </section>
  );
}

function PaymentRow({ payment, onPaid }: { payment: Payment; onPaid: (p: Payment) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<"mock" | "ifos">("mock");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pay = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await api.payments.pay(payment.id, {
        method,
        ifos_email: method === "ifos" ? email : undefined,
        ifos_password: method === "ifos" ? pwd : undefined,
      });
      onPaid(res);
      setOpen(false);
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErr(detail || t("payments.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <CreditCard className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-navy">
            {payment.description || payment.purpose}
          </p>
          <p className="text-xs text-slate-400">
            {formatPrice(payment.amount, payment.currency)}
            {payment.paid_at && ` · ${t("payments.paidOn", { date: formatDate(payment.paid_at) })}`}
          </p>
        </div>
        <span className="ms-auto flex items-center gap-2">
          <PaymentBadge status={payment.status} />
          {payment.status === "pending" && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="btn-green rounded-lg px-3 py-1 text-xs"
            >
              {t("payments.payNow")}
            </button>
          )}
        </span>
      </div>

      {open && payment.status === "pending" && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3">
          <div className="flex flex-wrap gap-2">
            {(["mock", "ifos"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  method === m
                    ? "bg-navy text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {m === "mock" ? t("payments.payMock") : t("payments.payIfos")}
              </button>
            ))}
          </div>

          {method === "ifos" && (
            <div className="mt-3 space-y-2">
              <input
                className="input"
                placeholder={t("payments.ifosEmail")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="input"
                type="password"
                placeholder={t("payments.ifosPassword")}
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
              />
            </div>
          )}

          {err && <p className="mt-2 text-sm text-reports">{err}</p>}

          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-green" disabled={busy} onClick={pay}>
              {busy ? t("payments.paying") : t("payments.confirm")}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              {t("payments.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Profile tab                                                         */
/* ------------------------------------------------------------------ */

function ProfileTab() {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [city, setCity] = useState(user?.city ?? "");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      const body: {
        name?: string;
        email?: string;
        city?: string;
        password?: string;
      } = {
        name: name.trim(),
        email: email.trim() || undefined,
        city: city.trim() || undefined,
      };
      if (password.trim()) body.password = password.trim();
      const updated = await api.auth.updateMe(body);
      updateUser(updated);
      setPassword("");
      setSaved(true);
    } catch {
      setError(t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="card mx-auto max-w-xl space-y-5 p-6 sm:p-7">
      <div>
        <label className="label" htmlFor="acc-name">
          {t("auth.fullName")}
        </label>
        <input
          id="acc-name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="acc-phone">
          {t("common.phone")}
        </label>
        <input
          id="acc-phone"
          className="input bg-slate-50 text-slate-500"
          value={user?.phone ?? ""}
          readOnly
        />
      </div>

      <div>
        <label className="label" htmlFor="acc-email">
          {t("auth.emailOptional")}
        </label>
        <input
          id="acc-email"
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="acc-city">
          {t("auth.city")}
        </label>
        <input
          id="acc-city"
          className="input"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="acc-password">
          {t("auth.password")}
        </label>
        <input
          id="acc-password"
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="••••••••"
        />
        <p className="mt-1.5 text-xs text-slate-400">{t("auth.passwordHint")}</p>
      </div>

      {error && (
        <p className="rounded-xl bg-reports/10 px-4 py-2.5 text-sm text-reports">{error}</p>
      )}
      {saved && (
        <p className="inline-flex items-center gap-2 rounded-xl bg-civic-green/10 px-4 py-2.5 text-sm font-medium text-civic-greenDark">
          <CheckCircle2 className="h-4 w-4" />
          {t("account.saved")}
        </p>
      )}

      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={busy}>
        {busy ? t("common.loading") : t("account.saveChanges")}
      </button>
    </form>
  );
}
