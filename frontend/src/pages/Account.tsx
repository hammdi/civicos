import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  LogOut,
  ChevronRight,
  LogIn,
  type LucideIcon,
} from "lucide-react";

import { api } from "../api/client";
import type { MeOverview } from "../api/types";
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
