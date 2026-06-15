import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Pencil, Bell } from "lucide-react";
import { api } from "../../api/client";
import { FILE_STATUSES } from "../../lib/constants";
import { formatDate, formatDateTime } from "../../lib/format";
import type { FileRecord } from "../../api/types";
import Spinner from "../../components/Spinner";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";

type ActionKind = "status" | "notify";

interface ActiveAction {
  file: FileRecord;
  kind: ActionKind;
}

export default function AdminDocuments() {
  const { t } = useTranslation();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveAction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = statusFilter ? { status: statusFilter } : undefined;
      const data = await api.documentsAdmin.list(params);
      setFiles(data);
    } catch {
      setError(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const onActionDone = async () => {
    setActive(null);
    await load();
  };

  return (
    <div className="container-page">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-documents/10 text-documents">
            <FileText className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-navy">{t("admin.files")}</h1>
            <p className="text-sm text-slate-500">{t("admin.documentsModule")}</p>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="label" htmlFor="status-filter">
            {t("common.status")}
          </label>
          <select
            id="status-filter"
            className="input min-w-[12rem]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">{t("common.all")}</option>
            {FILE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`statuses.${s}`, { defaultValue: s })}
              </option>
            ))}
          </select>
        </div>
      </header>

      {loading ? (
        <Spinner label={t("common.loading")} />
      ) : error ? (
        <EmptyState icon="⚠️" title={t("common.error")}>
          <button className="btn-ghost mt-2" onClick={() => void load()}>
            {t("common.retry")}
          </button>
        </EmptyState>
      ) : files.length === 0 ? (
        <EmptyState icon="📄" title={t("documents.notFound")} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="card hidden overflow-x-auto p-0 md:block">
            <table className="w-full text-start text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-start text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 text-start">{t("documents.referenceNumber")}</th>
                  <th className="px-4 py-3 text-start">{t("documents.documentType")}</th>
                  <th className="px-4 py-3 text-start">{t("common.phone")}</th>
                  <th className="px-4 py-3 text-start">{t("common.status")}</th>
                  <th className="px-4 py-3 text-start">{t("documents.submittedAt")}</th>
                  <th className="px-4 py-3 text-start">{t("documents.expectedReady")}</th>
                  <th className="px-4 py-3 text-end">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-navy">
                      {f.reference_number}
                    </td>
                    <td className="px-4 py-3">{f.document_type?.name ?? "—"}</td>
                    <td className="px-4 py-3" dir="ltr">
                      {f.citizen_phone}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={f.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(f.submitted_at)}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(f.expected_ready_date)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          className="btn-ghost px-3 py-1 text-xs"
                          onClick={() => setActive({ file: f, kind: "status" })}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                          {t("admin.updateStatus")}
                        </button>
                        <button
                          className="btn-primary px-3 py-1 text-xs"
                          onClick={() => setActive({ file: f, kind: "notify" })}
                        >
                          <Bell className="h-3.5 w-3.5" aria-hidden />
                          {t("admin.notify")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {files.map((f) => (
              <div key={f.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-navy">
                    {f.reference_number}
                  </span>
                  <StatusBadge status={f.status} />
                </div>
                <p className="mt-1 font-medium text-slate-700">{f.document_type?.name ?? "—"}</p>
                <p className="mt-1 text-sm text-slate-500" dir="ltr">
                  {f.citizen_phone}
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-1 text-xs text-slate-500">
                  <dt>{t("documents.submittedAt")}</dt>
                  <dd className="text-end">{formatDate(f.submitted_at)}</dd>
                  <dt>{t("documents.expectedReady")}</dt>
                  <dd className="text-end">{formatDate(f.expected_ready_date)}</dd>
                </dl>
                <div className="mt-3 flex gap-2">
                  <button
                    className="btn-ghost flex-1 justify-center px-3 py-1.5 text-xs"
                    onClick={() => setActive({ file: f, kind: "status" })}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    {t("admin.updateStatus")}
                  </button>
                  <button
                    className="btn-primary flex-1 justify-center px-3 py-1.5 text-xs"
                    onClick={() => setActive({ file: f, kind: "notify" })}
                  >
                    <Bell className="h-3.5 w-3.5" aria-hidden />
                    {t("admin.notify")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {active && (
        <FileActionModal
          file={active.file}
          kind={active.kind}
          onClose={() => setActive(null)}
          onDone={onActionDone}
        />
      )}
    </div>
  );
}

function FileActionModal({
  file,
  kind,
  onClose,
  onDone,
}: {
  file: FileRecord;
  kind: ActionKind;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string>(file.status);
  const [message, setMessage] = useState("");
  const [expectedDate, setExpectedDate] = useState(file.expected_ready_date ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (kind === "status") {
        await api.documentsAdmin.updateStatus(file.id, {
          status,
          message: message.trim() || undefined,
          expected_date: expectedDate || undefined,
        });
      } else {
        await api.documentsAdmin.notify(file.id, message.trim() || undefined);
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
          {kind === "status" ? t("admin.updateStatus") : t("admin.notify")}
        </h3>
        <p className="mt-1 font-mono text-xs text-slate-400">{file.reference_number}</p>

        <div className="mt-4 flex flex-col gap-4">
          {kind === "status" && (
            <>
              <div>
                <label className="label" htmlFor="new-status">
                  {t("common.status")}
                </label>
                <select
                  id="new-status"
                  className="input"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {FILE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`statuses.${s}`, { defaultValue: s })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="expected-date">
                  {t("admin.expectedDate")}{" "}
                  <span className="text-slate-400">({t("common.optional")})</span>
                </label>
                <input
                  id="expected-date"
                  type="date"
                  className="input"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                />
              </div>
            </>
          )}

          <div>
            <label className="label" htmlFor="message">
              {t("admin.message")}{" "}
              <span className="text-slate-400">({t("common.optional")})</span>
            </label>
            <textarea
              id="message"
              className="input min-h-[5rem]"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="mt-5 flex gap-2">
          <button className="btn-ghost flex-1" disabled={busy} onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn-primary flex-1" disabled={busy} onClick={() => void submit()}>
            {kind === "status" ? t("common.save") : t("common.send")}
          </button>
        </div>
      </div>
    </div>
  );
}
