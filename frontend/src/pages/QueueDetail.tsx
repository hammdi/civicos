import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Radio,
  Users,
  CheckCircle2,
  MapPin,
  LayoutGrid,
  Building2,
  Hospital,
  Landmark,
  Mail,
  Scale,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import { api } from "../api/client";
import { useWebSocket } from "../hooks/useWebSocket";
import type {
  InstitutionType,
  QueueStatus,
  QueueWindow,
  TodayQueue,
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

/**
 * The live payload broadcast over `/ws/queue/{id}`. Note that the snapshot
 * carries the queue state but NOT the windows list — windows come from the
 * initial /today fetch and are preserved across live updates.
 */
interface QueueWsMessage {
  event: string;
  institution_id: number;
  queue_id: number | null;
  status: QueueStatus;
  current_number: number;
  total_served: number;
  waiting_count: number;
  next_numbers: number[];
}

export default function QueueDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const institutionId = Number(id);

  const [today, setToday] = useState<TodayQueue | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);

  const { message, status: wsStatus } = useWebSocket<QueueWsMessage>(
    Number.isFinite(institutionId) ? `/ws/queue/${institutionId}` : null
  );

  // Initial snapshot (includes windows + institution metadata).
  useEffect(() => {
    if (!Number.isFinite(institutionId)) return;
    let active = true;
    setToday(null);
    setLoadError(null);
    api.institutions
      .today(institutionId)
      .then((data) => {
        if (active) setToday(data);
      })
      .catch(() => {
        if (active) setLoadError(t("common.error"));
      });
    return () => {
      active = false;
    };
  }, [institutionId, t]);

  // Merge every live event into the displayed state.
  useEffect(() => {
    if (!message) return;
    setToday((prev) =>
      prev
        ? {
            ...prev,
            queue_id: message.queue_id ?? prev.queue_id,
            status: message.status,
            current_number: message.current_number,
            total_served: message.total_served,
            waiting_count: message.waiting_count,
            next_numbers: message.next_numbers,
          }
        : prev
    );
    // Flash the board when the served number advances.
    setPulse((p) => p + 1);
  }, [message]);

  if (loadError) {
    return (
      <div className="container-page">
        <EmptyState icon="⚠️" title={t("common.error")}>
          <Link
            to="/queue"
            className="btn-ghost mt-2 inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {t("common.back")}
          </Link>
        </EmptyState>
      </div>
    );
  }

  if (!today) {
    return (
      <div className="container-page">
        <Spinner label={t("queue.connecting")} />
      </div>
    );
  }

  const live = wsStatus === "open";
  const windows: QueueWindow[] = today.windows ?? [];
  const TypeIcon = INSTITUTION_TYPE_ICON[today.institution.type] ?? Building2;

  return (
    <div className="container-page">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link to="/queue" className="btn-ghost inline-flex items-center gap-1.5">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t("common.back")}
        </Link>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${
            live ? "bg-queue/10 text-queue" : "bg-slate-100 text-slate-400"
          }`}
        >
          <span className="relative flex h-2.5 w-2.5">
            {live && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-queue opacity-75" />
            )}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                live ? "bg-queue" : "bg-slate-300"
              }`}
            />
          </span>
          {live ? t("queue.live") : t("queue.connecting")}
        </span>
      </div>

      <header className="mb-6 flex items-start gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-queue/10 text-queue shadow-sm">
          <TypeIcon className="h-7 w-7" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-navy sm:text-3xl">
            {today.institution.name}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span>{t(`institutionTypes.${today.institution.type}`)}</span>
              <span className="text-slate-300">·</span>
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              <span>{today.institution.city}</span>
            </span>
            <StatusBadge status={today.status} />
          </p>
        </div>
      </header>

      {/* NOW SERVING big board */}
      <div
        key={pulse}
        className="relative overflow-hidden rounded-3xl border-4 border-queue/20 bg-gradient-to-b from-queue/5 to-white p-8 text-center shadow-sm"
      >
        <span
          className={`absolute top-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ltr:right-4 rtl:left-4 ${
            live ? "bg-queue/10 text-queue" : "bg-slate-100 text-slate-400"
          }`}
        >
          <Radio className={`h-3 w-3 ${live ? "animate-pulse" : ""}`} />
          {live ? t("queue.live") : t("queue.connecting")}
        </span>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-queue">
          {t("queue.nowServing")}
        </p>
        <div className="mt-2 text-7xl font-black leading-none text-queue tabular-nums sm:text-8xl">
          {today.current_number || "—"}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 text-center sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-center gap-1.5 text-3xl font-extrabold text-navy tabular-nums">
              <Users className="h-5 w-5 text-slate-400" />
              {today.waiting_count}
            </div>
            <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">
              {t("queue.waitingCount", { count: today.waiting_count })}
            </div>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-center gap-1.5 text-3xl font-extrabold text-civic-green tabular-nums">
              <CheckCircle2 className="h-5 w-5 text-civic-green/60" />
              {today.total_served}
            </div>
            <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">
              {t("queue.totalServed")}
            </div>
          </div>
          <div className="col-span-2 rounded-2xl bg-white p-4 shadow-sm sm:col-span-1">
            <div className="text-lg font-bold text-navy">
              <StatusBadge status={today.status} />
            </div>
            <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">
              {t("common.status")}
            </div>
          </div>
        </div>
      </div>

      {today.status === "closed" && (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-center text-sm text-amber-700">
          {t("queue.queueClosed")}
        </p>
      )}

      {/* Next numbers */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-navy">
          {t("queue.nextNumbers")}
        </h2>
        {today.next_numbers.length === 0 ? (
          <p className="text-sm text-slate-400">{t("admin.noOneWaiting")}</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {today.next_numbers.map((n) => (
              <div
                key={n}
                className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-queue/20 bg-white text-2xl font-extrabold text-queue tabular-nums shadow-sm"
              >
                {n}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Windows / counters */}
      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-navy">
          <LayoutGrid className="h-5 w-5 text-queue" />
          {t("queue.window")}s
        </h2>
        {windows.length === 0 ? (
          <EmptyState icon="🪟" title={t("common.none")} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {windows.map((w) => (
              <div key={w.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-500">
                    {t("queue.window")} {w.window_number}
                  </span>
                  <span className="relative flex h-2.5 w-2.5">
                    {w.current_ticket_id && (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-civic-green opacity-75" />
                    )}
                    <span
                      className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                        w.current_ticket_id ? "bg-civic-green" : "bg-slate-300"
                      }`}
                    />
                  </span>
                </div>
                <div className="mt-2 truncate text-base font-bold text-navy">
                  {w.agent_name || t("common.none")}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
