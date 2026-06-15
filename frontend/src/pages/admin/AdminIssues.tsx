import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, Pencil, UserCheck, ChevronUp } from "lucide-react";
import { api } from "../../api/client";
import { ISSUE_STATUSES, ISSUE_PRIORITIES, STATUS_COLORS } from "../../lib/constants";
import { formatDate, relativeTime } from "../../lib/format";
import type { Issue } from "../../api/types";
import Spinner from "../../components/Spinner";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";

type ActionKind = "status" | "assign";

interface ActiveAction {
  issue: Issue;
  kind: ActionKind;
}

function PriorityBadge({ priority }: { priority: string }) {
  const { t } = useTranslation();
  const cls = STATUS_COLORS[priority] ?? "bg-slate-100 text-slate-700";
  return <span className={`badge ${cls}`}>{t(`priority.${priority}`, { defaultValue: priority })}</span>;
}

export default function AdminIssues() {
  const { t } = useTranslation();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveAction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | undefined> = {};
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (cityFilter.trim()) params.city = cityFilter.trim();
      const data = await api.issuesAdmin.list(
        Object.keys(params).length ? params : undefined
      );
      setIssues(data);
    } catch {
      setError(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, cityFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const onActionDone = async () => {
    setActive(null);
    await load();
  };

  return (
    <div className="container-page">
      <header className="mb-6 flex items-center gap-3">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-reports/10 text-reports">
          <MapPin className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-navy">{t("admin.issues")}</h1>
          <p className="text-sm text-slate-500">{t("admin.issuesModule")}</p>
        </div>
      </header>

      <div className="card mb-6 grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="issue-status-filter">
            {t("common.status")}
          </label>
          <select
            id="issue-status-filter"
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">{t("common.all")}</option>
            {ISSUE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`statuses.${s}`, { defaultValue: s })}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="issue-priority-filter">
            {t("report.priority")}
          </label>
          <select
            id="issue-priority-filter"
            className="input"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="">{t("common.all")}</option>
            {ISSUE_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {t(`priority.${p}`, { defaultValue: p })}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="issue-city-filter">
            {t("common.city")}
          </label>
          <input
            id="issue-city-filter"
            className="input"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            placeholder={t("common.allCities")}
          />
        </div>
      </div>

      {loading ? (
        <Spinner label={t("common.loading")} />
      ) : error ? (
        <EmptyState icon="⚠️" title={t("common.error")}>
          <button className="btn-ghost mt-2" onClick={() => void load()}>
            {t("common.retry")}
          </button>
        </EmptyState>
      ) : issues.length === 0 ? (
        <EmptyState icon="📍" title={t("common.none")} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="card hidden overflow-x-auto p-0 lg:block">
            <table className="w-full text-start text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 text-start">{t("documents.referenceNumber")}</th>
                  <th className="px-4 py-3 text-start">{t("report.issueTitle")}</th>
                  <th className="px-4 py-3 text-start">{t("report.category")}</th>
                  <th className="px-4 py-3 text-start">{t("report.priority")}</th>
                  <th className="px-4 py-3 text-start">{t("common.status")}</th>
                  <th className="px-4 py-3 text-start">{t("common.city")}</th>
                  <th className="px-4 py-3 text-start">{t("report.upvote")}</th>
                  <th className="px-4 py-3 text-start">{t("common.date")}</th>
                  <th className="px-4 py-3 text-end">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((i) => (
                  <tr key={i.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-navy">
                      {i.reference_number}
                    </td>
                    <td className="max-w-[16rem] truncate px-4 py-3 font-medium text-slate-700">
                      {i.title}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{i.category?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={i.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={i.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-500">{i.city ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <ChevronUp className="h-3.5 w-3.5 text-reports" aria-hidden />
                        {i.upvote_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{relativeTime(i.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          className="btn-ghost px-3 py-1 text-xs"
                          onClick={() => setActive({ issue: i, kind: "status" })}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                          {t("admin.updateStatus")}
                        </button>
                        <button
                          className="btn-primary px-3 py-1 text-xs"
                          onClick={() => setActive({ issue: i, kind: "assign" })}
                        >
                          <UserCheck className="h-3.5 w-3.5" aria-hidden />
                          {t("admin.assign")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile / tablet cards */}
          <div className="flex flex-col gap-3 lg:hidden">
            {issues.map((i) => (
              <div key={i.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-navy">
                    {i.reference_number}
                  </span>
                  <div className="flex flex-wrap justify-end gap-1">
                    <PriorityBadge priority={i.priority} />
                    <StatusBadge status={i.status} />
                  </div>
                </div>
                <p className="mt-2 font-semibold text-slate-700">{i.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {i.category?.name ?? "—"}
                  {i.city ? ` · ${i.city}` : ""}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <ChevronUp className="h-3.5 w-3.5 text-reports" aria-hidden />
                    {i.upvote_count}
                  </span>
                  <span>{formatDate(i.created_at)}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    className="btn-ghost flex-1 justify-center px-3 py-1.5 text-xs"
                    onClick={() => setActive({ issue: i, kind: "status" })}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    {t("admin.updateStatus")}
                  </button>
                  <button
                    className="btn-primary flex-1 justify-center px-3 py-1.5 text-xs"
                    onClick={() => setActive({ issue: i, kind: "assign" })}
                  >
                    <UserCheck className="h-3.5 w-3.5" aria-hidden />
                    {t("admin.assign")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {active && (
        <IssueActionModal
          issue={active.issue}
          kind={active.kind}
          onClose={() => setActive(null)}
          onDone={onActionDone}
        />
      )}
    </div>
  );
}

function IssueActionModal({
  issue,
  kind,
  onClose,
  onDone,
}: {
  issue: Issue;
  kind: ActionKind;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string>(issue.status);
  const [message, setMessage] = useState("");
  const [department, setDepartment] = useState(issue.assigned_dept ?? "");
  const [priority, setPriority] = useState<string>(issue.priority);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (kind === "assign" && !department.trim()) {
      setError(t("common.error"));
      return;
    }
    setBusy(true);
    try {
      if (kind === "status") {
        await api.issuesAdmin.updateStatus(issue.id, {
          status,
          message: message.trim() || undefined,
        });
      } else {
        await api.issuesAdmin.assign(issue.id, {
          department: department.trim(),
          priority: priority || undefined,
        });
      }
      await onDone();
    } catch {
      setError(t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-navy">
          {kind === "status" ? t("admin.updateStatus") : t("admin.assign")}
        </h3>
        <p className="mt-1 font-mono text-xs text-slate-400">{issue.reference_number}</p>

        <div className="mt-4 flex flex-col gap-4">
          {kind === "status" ? (
            <>
              <div>
                <label className="label" htmlFor="issue-new-status">
                  {t("common.status")}
                </label>
                <select
                  id="issue-new-status"
                  className="input"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {ISSUE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`statuses.${s}`, { defaultValue: s })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="issue-message">
                  {t("admin.message")}{" "}
                  <span className="text-slate-400">({t("common.optional")})</span>
                </label>
                <textarea
                  id="issue-message"
                  className="input min-h-[5rem]"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="label" htmlFor="issue-department">
                  {t("admin.department")}
                </label>
                <input
                  id="issue-department"
                  className="input"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="issue-priority">
                  {t("report.priority")}{" "}
                  <span className="text-slate-400">({t("common.optional")})</span>
                </label>
                <select
                  id="issue-priority"
                  className="input"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  {ISSUE_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {t(`priority.${p}`, { defaultValue: p })}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="mt-5 flex gap-2">
          <button className="btn-ghost flex-1" disabled={busy} onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn-primary flex-1" disabled={busy} onClick={() => void submit()}>
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
