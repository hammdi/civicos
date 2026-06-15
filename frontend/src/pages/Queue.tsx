import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Ticket as TicketIcon,
  Bell,
  X,
  MapPin,
  Clock,
  Search,
  Users,
  Building2,
  Hospital,
  Landmark,
  Mail,
  Scale,
  Receipt,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { INSTITUTION_TYPES } from "../lib/constants";
import { MODULE_ICONS } from "../lib/icons";
import { formatWait, isValidPhone } from "../lib/format";
import type {
  InstitutionType,
  InstitutionWithLoad,
  Ticket,
  TicketCreateResponse,
} from "../api/types";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";

/** Lucide icon per institution type (purely decorative). */
const INSTITUTION_TYPE_ICON: Record<InstitutionType, LucideIcon> = {
  hospital: Hospital,
  municipality: Landmark,
  post: Mail,
  court: Scale,
  tax_office: Receipt,
};

/** Inline ticket-booking form shown beneath an institution card. */
function TicketForm({
  institution,
  defaultPhone,
  onClose,
}: {
  institution: InstitutionWithLoad;
  defaultPhone: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [serviceType, setServiceType] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<TicketCreateResponse | null>(null);

  const submit = async () => {
    setError(null);
    if (!isValidPhone(phone)) {
      setError(t("common.error"));
      return;
    }
    setBusy(true);
    try {
      const res = await api.tickets.create({
        institution_id: institution.id,
        phone: phone.trim(),
        service_type: serviceType.trim() || undefined,
      });
      setTicket(res);
    } catch {
      setError(t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  if (ticket) {
    return (
      <div className="mt-4 rounded-2xl border border-queue/30 bg-queue/5 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-queue">
          <TicketIcon className="h-4 w-4" />
          {t("queue.ticketTaken")}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-3xl font-extrabold text-queue tabular-nums">
              {ticket.number}
            </div>
            <div className="text-xs text-slate-500">{t("queue.yourNumber")}</div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-navy tabular-nums">
              {ticket.position}
            </div>
            <div className="text-xs text-slate-500">{t("queue.position")}</div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-navy tabular-nums">
              {formatWait(ticket.estimated_wait_minutes)}
            </div>
            <div className="text-xs text-slate-500">{t("queue.estimatedWait")}</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to={`/queue/${institution.id}`}
            className="btn-primary flex flex-1 items-center justify-center gap-2 text-center"
          >
            <Bell className="h-4 w-4" />
            {t("queue.viewLive")}
          </Link>
          <button
            className="btn-ghost inline-flex items-center gap-1.5"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
            {t("common.close")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="mb-3 text-sm font-medium text-slate-600">
        {t("queue.takeTicketFor", { name: institution.name })}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`phone-${institution.id}`}>
            {t("common.phone")}
          </label>
          <input
            id={`phone-${institution.id}`}
            className="input"
            placeholder="+216 55 123 456"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
          />
        </div>
        <div>
          <label className="label" htmlFor={`service-${institution.id}`}>
            {t("queue.serviceType")}{" "}
            <span className="text-slate-400">({t("common.optional")})</span>
          </label>
          <input
            id={`service-${institution.id}`}
            className="input"
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
          />
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-reports">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="btn-primary inline-flex items-center gap-2"
          onClick={submit}
          disabled={busy}
          type="button"
        >
          <TicketIcon className="h-4 w-4" />
          {busy ? t("common.loading") : t("queue.getTicket")}
        </button>
        <button
          className="btn-ghost inline-flex items-center gap-1.5"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

/** Single institution card with live load and a ticket action. */
function InstitutionCard({
  institution,
  defaultPhone,
  onTicketChange,
}: {
  institution: InstitutionWithLoad;
  defaultPhone: string | null;
  onTicketChange: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const closed = institution.queue_status === "closed";
  const TypeIcon = INSTITUTION_TYPE_ICON[institution.type] ?? Building2;

  return (
    <div className="card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-queue/10 text-queue">
            <TypeIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold text-navy">
              {institution.name}
            </h3>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
              <span>{t(`institutionTypes.${institution.type}`)}</span>
              <span className="text-slate-300">·</span>
              <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{institution.city}</span>
            </p>
          </div>
        </div>
        <StatusBadge status={institution.queue_status} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-queue/5 py-2.5">
          <div className="text-2xl font-extrabold text-queue tabular-nums">
            {institution.current_number || "—"}
          </div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            {t("queue.nowServing")}
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 py-2.5">
          <div className="flex items-center justify-center gap-1 text-2xl font-extrabold text-navy tabular-nums">
            <Users className="h-4 w-4 text-slate-400" />
            {institution.waiting_count}
          </div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            {t("queue.waitingCount", { count: institution.waiting_count })}
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 py-2.5">
          <div className="flex items-center justify-center gap-1 text-2xl font-extrabold text-navy tabular-nums">
            <Clock className="h-4 w-4 text-slate-400" />
            {formatWait(
              institution.estimated_wait_minutes || institution.avg_wait_minutes
            )}
          </div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            {t("queue.waitTime")}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          className="btn-primary inline-flex items-center gap-2"
          type="button"
          disabled={closed}
          onClick={() => setOpen((v) => !v)}
        >
          <TicketIcon className="h-4 w-4" />
          {t("queue.getTicket")}
        </button>
        <Link
          to={`/queue/${institution.id}`}
          className="btn-ghost inline-flex items-center gap-1.5"
        >
          {t("queue.viewLive")}
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </Link>
        {closed && (
          <span className="text-xs text-slate-400">{t("queue.queueClosed")}</span>
        )}
      </div>

      {open && !closed && (
        <TicketForm
          institution={institution}
          defaultPhone={defaultPhone}
          onClose={() => {
            setOpen(false);
            onTicketChange();
          }}
        />
      )}
    </div>
  );
}

/** The citizen's own tickets, with the ability to cancel waiting ones. */
function MyTickets({ phone, reloadKey }: { phone: string; reloadKey: number }) {
  const { t } = useTranslation();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.tickets.byPhone(phone);
      setTickets(res);
    } catch {
      setError(t("common.error"));
      setTickets([]);
    }
  }, [phone, t]);

  useEffect(() => {
    setTickets(null);
    load();
  }, [load, reloadKey]);

  const cancel = async (id: number) => {
    setBusyId(id);
    try {
      await api.tickets.cancel(id);
      await load();
    } catch {
      setError(t("common.error"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mt-12">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-navy">
        <TicketIcon className="h-5 w-5 text-queue" />
        {t("queue.myTickets")}
      </h2>
      {error && <p className="mb-3 text-sm text-reports">{error}</p>}
      {tickets === null ? (
        <Spinner />
      ) : tickets.length === 0 ? (
        <EmptyState icon="🎫" title={t("queue.noInstitutions")} />
      ) : (
        <div className="grid gap-3">
          {tickets.map((tk) => (
            <div
              key={tk.id}
              className="card flex items-center justify-between gap-3 p-4"
            >
              <div className="flex items-center gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-queue/10 text-base font-extrabold text-queue tabular-nums">
                  #{tk.number}
                </span>
                <div className="text-sm text-slate-500">
                  {tk.service_type || t("common.none")}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={tk.status} />
                {tk.status === "waiting" && (
                  <button
                    className="btn-ghost inline-flex items-center gap-1.5 text-reports"
                    type="button"
                    disabled={busyId === tk.id}
                    onClick={() => cancel(tk.id)}
                  >
                    <X className="h-4 w-4" />
                    {t("queue.cancelTicket")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function Queue() {
  const { t } = useTranslation();
  const { phone } = useAuth();
  const [searchParams] = useSearchParams();
  const QueueModuleIcon = MODULE_ICONS.queue;

  const [q, setQ] = useState("");
  const [city, setCity] = useState(searchParams.get("city") ?? "");
  const [type, setType] = useState("");
  const [institutions, setInstitutions] = useState<InstitutionWithLoad[] | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const params = useMemo(
    () => ({
      q: q.trim() || undefined,
      city: city.trim() || undefined,
      type: type || undefined,
    }),
    [q, city, type]
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.institutions.list(params);
      setInstitutions(res);
    } catch {
      setError(t("common.error"));
      setInstitutions([]);
    }
  }, [params, t]);

  useEffect(() => {
    setInstitutions(null);
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  return (
    <div className="container-page">
      <header className="mb-6 flex items-start gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-queue/10 text-queue shadow-sm">
          <QueueModuleIcon className="h-7 w-7" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-queue">
            {t("queue.liveQueue")}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-navy sm:text-3xl">
            {t("queue.title")}
          </h1>
          <p className="mt-1 text-slate-500">{t("queue.subtitle")}</p>
        </div>
      </header>

      <div className="card mb-8 grid gap-3 p-4 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <label className="label" htmlFor="queue-search">
            {t("common.search")}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute inset-y-0 my-auto h-4 w-4 text-slate-400 ltr:left-3 rtl:right-3" />
            <input
              id="queue-search"
              className="input ltr:pl-9 rtl:pr-9"
              placeholder={t("queue.searchInstitutions")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="queue-city">
            {t("common.city")}
          </label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute inset-y-0 my-auto h-4 w-4 text-slate-400 ltr:left-3 rtl:right-3" />
            <input
              id="queue-city"
              className="input ltr:pl-9 rtl:pr-9"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="queue-type">
            {t("queue.filterByType")}
          </label>
          <select
            id="queue-type"
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">{t("common.all")}</option>
            {INSTITUTION_TYPES.map((it) => (
              <option key={it} value={it}>
                {t(`institutionTypes.${it}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-reports">{error}</p>}

      {institutions === null ? (
        <Spinner label={t("common.loading")} />
      ) : institutions.length === 0 ? (
        <EmptyState icon="🏛️" title={t("queue.noInstitutions")} />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {institutions.map((inst) => (
            <InstitutionCard
              key={inst.id}
              institution={inst}
              defaultPhone={phone}
              onTicketChange={() => setReloadKey((k) => k + 1)}
            />
          ))}
        </div>
      )}

      {phone && <MyTickets phone={phone} reloadKey={reloadKey} />}
    </div>
  );
}
