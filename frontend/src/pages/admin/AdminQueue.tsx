import { useCallback, useEffect, useState } from "react";
import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Ticket,
  Play,
  Pause,
  Square,
  SkipForward,
  Check,
  UserX,
  ChevronLeft,
  Building2,
  Clock,
  Users,
  CheckCircle2,
} from "lucide-react";
import { api, tokens } from "../../api/client";
import type { QueueStats, TodayQueue } from "../../api/types";
import Spinner from "../../components/Spinner";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { formatWait } from "../../lib/format";

export default function AdminQueue() {
  const { t } = useTranslation();
  const info = tokens.adminInfo();

  // Superadmins (institution_id == null) must choose an institution; agents
  // may override for testing. The override drives every API call.
  const [instId, setInstId] = useState<number | undefined>(
    info?.institution_id ?? undefined
  );
  const [instInput, setInstInput] = useState<string>(
    info?.institution_id != null ? String(info.institution_id) : ""
  );

  const [board, setBoard] = useState<TodayQueue | null>(null);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [windows, setWindows] = useState(3);

  const refresh = useCallback(async () => {
    if (instId == null) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [dash, st] = await Promise.all([
        api.queueAdmin.dashboard(instId),
        api.queueAdmin.stats(instId).catch(() => null),
      ]);
      setBoard(dash);
      if (st) setStats(st);
    } catch {
      setError(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [instId, t]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  // Helper to wrap an admin action: run it, surface errors, then refresh.
  async function run(action: () => Promise<unknown>, onNotFound?: string) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (err: unknown) {
      const status =
        typeof err === "object" && err !== null && "response" in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined;
      if (status === 404 && onNotFound) {
        setNotice(onNotFound);
        await refresh();
      } else {
        setError(t("common.error"));
      }
    } finally {
      setBusy(false);
    }
  }

  function applyInstitution() {
    const parsed = Number.parseInt(instInput, 10);
    setInstId(Number.isFinite(parsed) && parsed > 0 ? parsed : undefined);
  }

  const canOverride = info?.institution_id == null;
  const activeTicketIds = board
    ? board.windows
        .map((w) => w.current_ticket_id)
        .filter((id): id is number => id != null)
    : [];

  // --- No institution selected (superadmin) --------------------------------
  if (instId == null && !loading) {
    return (
      <div className="container-page">
        <Header />
        <EmptyState icon="🏛️" title={t("admin.selectInstitution")}>
          <div className="mt-3 flex items-center justify-center gap-2">
            <input
              className="input w-32"
              type="number"
              min={1}
              value={instInput}
              onChange={(e) => setInstInput(e.target.value)}
              aria-label={t("admin.selectInstitution")}
            />
            <button type="button" className="btn-primary" onClick={applyInstitution}>
              {t("common.submit")}
            </button>
          </div>
        </EmptyState>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container-page">
        <Header />
        <Spinner label={t("common.loading")} />
      </div>
    );
  }

  const status = board?.status ?? "closed";

  return (
    <div className="container-page">
      <Header />

      {/* Institution selector for superadmins / override */}
      {canOverride && (
        <div className="card mb-4 flex flex-wrap items-end gap-2 p-4">
          <div>
            <label className="label" htmlFor="inst-override">
              {t("admin.selectInstitution")}
            </label>
            <input
              id="inst-override"
              className="input w-32"
              type="number"
              min={1}
              value={instInput}
              onChange={(e) => setInstInput(e.target.value)}
            />
          </div>
          <button type="button" className="btn-ghost" onClick={applyInstitution}>
            {t("common.submit")}
          </button>
        </div>
      )}

      {notice && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">
          {notice}
        </p>
      )}
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          <span>{error}</span>
          <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => void refresh()}>
            {t("common.retry")}
          </button>
        </div>
      )}

      {/* Institution + queue status */}
      {board && (
        <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-queue/10 text-queue">
              <Building2 className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-bold text-navy">{board.institution.name}</h2>
              <p className="text-sm text-slate-500">{board.institution.city}</p>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label={t("statuses.served")}
            value={stats.served}
            icon={CheckCircle2}
            accent="text-civic-green"
            chip="bg-green-100 text-green-700"
          />
          <StatCard
            label={t("statuses.waiting")}
            value={stats.waiting}
            icon={Users}
            accent="text-queue"
            chip="bg-queue/10 text-queue"
          />
          <StatCard
            label={t("statuses.no_show")}
            value={stats.no_show}
            icon={UserX}
            accent="text-slate-500"
            chip="bg-slate-100 text-slate-500"
          />
          <StatCard
            label={t("queue.waitTime")}
            value={formatWait(stats.avg_wait_minutes)}
            icon={Clock}
            accent="text-navy"
            chip="bg-navy-50 text-navy"
          />
        </div>
      )}

      {/* Queue lifecycle controls */}
      <div className="card mb-4 p-4">
        <h3 className="mb-3 font-semibold text-navy">{t("admin.liveQueue")}</h3>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label" htmlFor="windows">
              {t("queue.window")}
            </label>
            <input
              id="windows"
              className="input w-20"
              type="number"
              min={1}
              max={20}
              value={windows}
              onChange={(e) => setWindows(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
            />
          </div>
          <button
            type="button"
            className="btn-green"
            disabled={busy || status === "open"}
            onClick={() => void run(() => api.queueAdmin.open(instId, windows))}
          >
            <Play className="h-4 w-4" aria-hidden />
            {t("admin.openQueue")}
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={busy || status !== "open"}
            onClick={() => void run(() => api.queueAdmin.pause(instId))}
          >
            <Pause className="h-4 w-4" aria-hidden />
            {t("admin.pauseQueue")}
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={busy || status === "closed"}
            onClick={() => void run(() => api.queueAdmin.close(instId))}
          >
            <Square className="h-4 w-4" aria-hidden />
            {t("admin.closeQueue")}
          </button>
          <button
            type="button"
            className="btn-primary ms-auto"
            disabled={busy || status !== "open"}
            onClick={() => void run(() => api.queueAdmin.next(instId), t("admin.noOneWaiting"))}
          >
            <SkipForward className="h-4 w-4" aria-hidden />
            {t("admin.callNext")}
          </button>
        </div>
      </div>

      {/* Now serving */}
      <div className="card mb-4 flex flex-col items-center gap-1 bg-navy p-6 text-center text-white">
        <span className="text-xs font-medium uppercase tracking-wide text-white/50">
          {t("queue.nowServing")}
        </span>
        <span className="text-6xl font-extrabold tabular-nums">
          {board && board.current_number > 0 ? board.current_number : "—"}
        </span>
        {board && (
          <span className="text-sm text-white/60">
            {t("queue.totalServed")}: {board.total_served} ·{" "}
            {t("queue.waitingCount", { count: board.waiting_count })}
          </span>
        )}
      </div>

      {/* Windows */}
      {board && board.windows.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 font-semibold text-navy">{t("queue.window")}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {board.windows.map((w) => (
              <div key={w.id} className="card flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold text-navy">
                    {t("queue.window")} {w.window_number}
                  </p>
                  <p className="text-sm text-slate-500">{w.agent_name ?? t("common.none")}</p>
                </div>
                <div className="flex flex-col gap-1">
                  {w.current_ticket_id != null ? (
                    <>
                      <button
                        type="button"
                        className="btn-green px-3 py-1 text-xs"
                        disabled={busy}
                        onClick={() =>
                          void run(() => api.queueAdmin.served(w.current_ticket_id as number))
                        }
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden />
                        {t("admin.markServed")}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost px-3 py-1 text-xs"
                        disabled={busy}
                        onClick={() =>
                          void run(() => api.queueAdmin.noShow(w.current_ticket_id as number))
                        }
                      >
                        <UserX className="h-3.5 w-3.5" aria-hidden />
                        {t("admin.noShow")}
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">{t("common.none")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {activeTicketIds.length === 0 && (
            <p className="mt-2 text-xs text-slate-400">{t("common.none")}</p>
          )}
        </div>
      )}

      {/* Waiting list */}
      <div>
        <h3 className="mb-2 font-semibold text-navy">{t("queue.nextNumbers")}</h3>
        {board && board.next_numbers.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {board.next_numbers.map((number) => (
              <button
                key={number}
                type="button"
                className="card flex min-w-[4rem] flex-col items-center px-4 py-3 transition hover:border-queue hover:shadow-sm disabled:opacity-50"
                disabled={busy || status !== "open"}
                title={t("admin.callNext")}
                onClick={() => void run(() => api.queueAdmin.call(number, instId))}
              >
                <span className="text-2xl font-bold tabular-nums text-queue">{number}</span>
                <span className="text-[11px] text-slate-400">{t("statuses.waiting")}</span>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState icon="🙌" title={t("admin.noOneWaiting")} />
        )}
      </div>
    </div>
  );

  function Header() {
    return (
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-queue/10 text-queue">
            <Ticket className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-navy">{t("admin.liveQueue")}</h1>
            {info && <p className="text-sm text-slate-500">{info.full_name}</p>}
          </div>
        </div>
        <Link to="/admin" className="btn-ghost">
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
          {t("common.back")}
        </Link>
      </div>
    );
  }
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  chip,
}: {
  label: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
  accent: string;
  chip: string;
}) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${chip}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div>
        <p className={`text-2xl font-bold tabular-nums leading-none ${accent}`}>{value}</p>
        <p className="mt-1 text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}
