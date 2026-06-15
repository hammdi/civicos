import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FileText,
  Search,
  FolderOpen,
  FilePlus2,
  Phone,
  CalendarDays,
  CalendarCheck,
  StickyNote,
  CheckCircle2,
  ChevronRight,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";
import { api, tokens } from "../api/client";
import type { DocumentType, FileRecord, FileStatus } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../hooks/useWebSocket";
import { formatDate, formatDateTime, isValidPhone } from "../lib/format";
import Spinner from "../components/Spinner";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";

type TabKey = "track" | "mine" | "new";

interface FileWsMessage {
  event: "snapshot" | "status_changed";
  reference: string;
  status: FileStatus;
  old_status?: string | null;
  message?: string | null;
}

function errorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null) {
    const maybe = err as {
      response?: { status?: number; data?: { detail?: string } };
    };
    if (maybe.response?.status === 404) return "__notfound__";
    if (maybe.response?.data?.detail) return maybe.response.data.detail;
  }
  return fallback;
}

/* -------------------------------------------------------------------------- */
/* Track by reference                                                         */
/* -------------------------------------------------------------------------- */
function TrackTab({ initialRef }: { initialRef?: string | null }) {
  const { t } = useTranslation();
  const [input, setInput] = useState(initialRef ?? "");
  const [reference, setReference] = useState<string | null>(null);
  const [file, setFile] = useState<FileRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Live status updates for the currently tracked file.
  const { message: wsMessage } = useWebSocket<FileWsMessage>(
    reference ? `/ws/files/${encodeURIComponent(reference)}` : null
  );

  useEffect(() => {
    if (!wsMessage || !file) return;
    if (wsMessage.reference !== file.reference_number) return;
    if (wsMessage.status && wsMessage.status !== file.status) {
      setFile((prev) => (prev ? { ...prev, status: wsMessage.status } : prev));
    }
  }, [wsMessage, file]);

  const lookup = useCallback(async (ref: string) => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    setFile(null);
    try {
      const result = await api.documents.track(ref);
      setFile(result);
      setReference(result.reference_number);
    } catch (err) {
      const msg = errorMessage(err, "error");
      if (msg === "__notfound__") setNotFound(true);
      else setError(msg);
      setReference(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-lookup when arriving via a deep-link (/documents?ref=...).
  useEffect(() => {
    if (initialRef && initialRef.trim()) void lookup(initialRef.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRef]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const ref = input.trim();
    if (!ref) return;
    void lookup(ref);
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={onSubmit}
        className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label htmlFor="track-ref" className="label">
            {t("documents.referenceNumber")}
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute inset-y-0 my-auto h-4 w-4 text-slate-400 ms-3"
              aria-hidden
            />
            <input
              id="track-ref"
              className="input ps-9 font-mono"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("documents.referencePlaceholder")}
              autoComplete="off"
            />
          </div>
        </div>
        <button
          type="submit"
          className="btn-primary bg-documents hover:bg-documents/90 focus:ring-documents"
          disabled={loading || !input.trim()}
        >
          <Search className="h-4 w-4" aria-hidden />
          {t("documents.track")}
        </button>
      </form>

      {loading && <Spinner label={t("common.loading")} />}

      {!loading && error && (
        <EmptyState icon="⚠️" title={t("common.error")}>
          {error}
        </EmptyState>
      )}

      {!loading && notFound && (
        <EmptyState icon="🔎" title={t("documents.notFound")} />
      )}

      {!loading && file && <FileDetail file={file} />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* File detail card with history timeline                                     */
/* -------------------------------------------------------------------------- */
function FileDetail({ file }: { file: FileRecord }) {
  const { t } = useTranslation();
  const updates = file.updates ?? [];

  const facts: { icon: typeof CalendarDays; label: string; value: string }[] = [
    {
      icon: CalendarDays,
      label: t("documents.submittedAt"),
      value: formatDate(file.submitted_at),
    },
    {
      icon: CalendarCheck,
      label: t("documents.expectedReady"),
      value: formatDate(file.expected_ready_date),
    },
  ];

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-documents/5 p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-documents/15 text-documents">
            <FileText className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="font-mono text-lg font-semibold text-navy">
              {file.reference_number}
            </p>
            <p className="text-sm text-slate-500">
              {file.document_type?.name ?? `#${file.document_type_id}`}
            </p>
          </div>
        </div>
        <StatusBadge status={file.status} />
      </div>

      <div className="space-y-5 p-5">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {facts.map((f) => (
            <div
              key={f.label}
              className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3"
            >
              <f.icon className="mt-0.5 h-4 w-4 shrink-0 text-documents" aria-hidden />
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {f.label}
                </dt>
                <dd className="text-sm font-medium text-slate-700">{f.value}</dd>
              </div>
            </div>
          ))}
          {file.notes && (
            <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 sm:col-span-2">
              <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-documents" aria-hidden />
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {t("documents.notes")}
                </dt>
                <dd className="text-sm text-slate-700">{file.notes}</dd>
              </div>
            </div>
          )}
        </dl>

        <div>
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-700">
            <ClipboardList className="h-4 w-4 text-documents" aria-hidden />
            {t("documents.history")}
          </h3>
          {updates.length === 0 ? (
            <p className="text-sm text-slate-400">{t("common.none")}</p>
          ) : (
            <ol className="space-y-5 border-s-2 border-documents/25 ps-5">
              {updates.map((u) => (
                <li key={u.id} className="relative">
                  <span className="absolute -start-[1.65rem] top-1 grid h-4 w-4 place-items-center rounded-full bg-documents ring-4 ring-documents/15" />
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={u.new_status} />
                    <span className="text-xs text-slate-400">
                      {formatDateTime(u.updated_at)}
                    </span>
                  </div>
                  {u.message && (
                    <p className="mt-1 text-sm text-slate-600">{u.message}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* My documents                                                               */
/* -------------------------------------------------------------------------- */
function MineTab() {
  const { t } = useTranslation();
  const { phone: authPhone } = useAuth();
  const [phone, setPhone] = useState(authPhone ?? tokens.citizenPhone() ?? "");
  const [files, setFiles] = useState<FileRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: string) => {
    setLoading(true);
    setError(null);
    setFiles(null);
    try {
      const result = await api.documents.byPhone(p);
      setFiles(result);
    } catch (err) {
      setError(errorMessage(err, "error") === "__notfound__" ? null : errorMessage(err, "error"));
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const p = phone.trim();
    if (!isValidPhone(p)) return;
    void load(p);
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={onSubmit}
        className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label htmlFor="mine-phone" className="label">
            {t("common.phone")}
          </label>
          <div className="relative">
            <Phone
              className="pointer-events-none absolute inset-y-0 my-auto h-4 w-4 text-slate-400 ms-3"
              aria-hidden
            />
            <input
              id="mine-phone"
              type="tel"
              className="input ps-9"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+216 ..."
              autoComplete="tel"
            />
          </div>
        </div>
        <button
          type="submit"
          className="btn-primary bg-documents hover:bg-documents/90 focus:ring-documents"
          disabled={loading || !isValidPhone(phone.trim())}
        >
          <FolderOpen className="h-4 w-4" aria-hidden />
          {t("documents.loadMine")}
        </button>
      </form>

      {loading && <Spinner label={t("common.loading")} />}

      {!loading && error && (
        <EmptyState icon="⚠️" title={t("common.error")}>
          {error}
        </EmptyState>
      )}

      {!loading && !error && files && files.length === 0 && (
        <EmptyState icon="📭" title={t("documents.notFound")} />
      )}

      {!loading && files && files.length > 0 && (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {files.map((file) => (
            <li key={file.id}>
              <Link
                to={`/documents?ref=${encodeURIComponent(file.reference_number)}`}
                className="card group block h-full p-5 transition hover:-translate-y-0.5 hover:border-documents/40 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-documents/12 text-documents">
                      <FileText className="h-4 w-4" aria-hidden />
                    </span>
                    <p className="font-mono font-semibold text-navy">
                      {file.reference_number}
                    </p>
                  </div>
                  <StatusBadge status={file.status} />
                </div>
                <p className="mt-3 text-sm text-slate-500">
                  {file.document_type?.name ?? `#${file.document_type_id}`}
                </p>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    {t("documents.submittedAt")}: {formatDate(file.submitted_at)}
                  </span>
                  <ChevronRight
                    className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:text-documents rtl-flip"
                    aria-hidden
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* New request                                                                */
/* -------------------------------------------------------------------------- */
function NewRequestTab() {
  const { t } = useTranslation();
  const { phone: authPhone } = useAuth();

  const [types, setTypes] = useState<DocumentType[] | null>(null);
  const [typesError, setTypesError] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [phone, setPhone] = useState(authPhone ?? tokens.citizenPhone() ?? "");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<FileRecord | null>(null);

  const loadTypes = useCallback(async () => {
    setTypesError(false);
    setTypes(null);
    try {
      const result = await api.documents.types();
      setTypes(result);
    } catch {
      setTypesError(true);
    }
  }, []);

  useEffect(() => {
    void loadTypes();
  }, [loadTypes]);

  const selected = types?.find((dt) => dt.id === selectedId) ?? null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (selectedId === null) return;
    const p = phone.trim();
    if (!isValidPhone(p)) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const file = await api.documents.submit({
        citizen_phone: p,
        document_type_id: selectedId,
        notes: notes.trim() || undefined,
      });
      setResult(file);
    } catch (err) {
      setSubmitError(errorMessage(err, "error"));
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setResult(null);
    setSelectedId(null);
    setNotes("");
  };

  if (result) {
    return (
      <div className="card mx-auto max-w-md space-y-4 p-8 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-civic-green/15 text-civic-green">
          <CheckCircle2 className="h-8 w-8" aria-hidden />
        </div>
        <h3 className="font-semibold text-slate-700">
          {t("documents.requestSubmitted")}
        </h3>
        <p className="rounded-xl bg-documents/10 px-4 py-3 font-mono text-2xl font-bold tracking-wide text-documents">
          {result.reference_number}
        </p>
        <p className="text-sm text-slate-500">
          {result.document_type?.name ?? ""}
        </p>
        <button type="button" className="btn-ghost" onClick={reset}>
          <FilePlus2 className="h-4 w-4" aria-hidden />
          {t("documents.submitNew")}
        </button>
      </div>
    );
  }

  if (types === null && !typesError) {
    return <Spinner label={t("common.loading")} />;
  }

  if (typesError) {
    return (
      <EmptyState icon="⚠️" title={t("common.error")}>
        <button type="button" className="btn-ghost mt-2" onClick={() => void loadTypes()}>
          {t("common.retry")}
        </button>
      </EmptyState>
    );
  }

  if (types && types.length === 0) {
    return <EmptyState icon="📄" title={t("documents.notFound")} />;
  }

  return (
    <form onSubmit={onSubmit} className="card mx-auto max-w-2xl space-y-5 p-6">
      <div>
        <label htmlFor="doc-type" className="label">
          {t("documents.documentType")}
        </label>
        <select
          id="doc-type"
          className="input"
          value={selectedId ?? ""}
          onChange={(e) =>
            setSelectedId(e.target.value ? Number(e.target.value) : null)
          }
          required
        >
          <option value="" disabled>
            {t("documents.documentType")}
          </option>
          {types?.map((dt) => (
            <option key={dt.id} value={dt.id}>
              {dt.name}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <div className="rounded-xl border border-documents/20 bg-documents/8 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-documents">
            <CalendarDays className="h-4 w-4" aria-hidden />
            {t("documents.processingDays", { days: selected.avg_processing_days })}
          </p>
          {selected.required_documents.length > 0 && (
            <div className="mt-3">
              <p className="label">{t("documents.requiredDocuments")}</p>
              <ul className="mt-1 space-y-1.5 text-sm text-slate-600">
                {selected.required_documents.map((doc, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-documents"
                      aria-hidden
                    />
                    <span>{doc}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div>
        <label htmlFor="new-phone" className="label">
          {t("common.phone")}
        </label>
        <div className="relative">
          <Phone
            className="pointer-events-none absolute inset-y-0 my-auto h-4 w-4 text-slate-400 ms-3"
            aria-hidden
          />
          <input
            id="new-phone"
            type="tel"
            className="input ps-9"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+216 ..."
            autoComplete="tel"
            required
          />
        </div>
      </div>

      <div>
        <label htmlFor="new-notes" className="label">
          {t("documents.notes")}{" "}
          <span className="font-normal text-slate-400">({t("common.optional")})</span>
        </label>
        <textarea
          id="new-notes"
          className="input min-h-[5rem]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>

      {submitError && (
        <p className="flex items-center gap-2 text-sm text-reports">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          {submitError}
        </p>
      )}

      <button
        type="submit"
        className="btn-primary w-full bg-documents hover:bg-documents/90 focus:ring-documents sm:w-auto"
        disabled={submitting || selectedId === null || !isValidPhone(phone.trim())}
      >
        <FilePlus2 className="h-4 w-4" aria-hidden />
        {submitting ? t("common.loading") : t("documents.submitRequest")}
      </button>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Page shell with tabs                                                        */
/* -------------------------------------------------------------------------- */
export default function Documents() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabKey>("track");

  // Deep-link: /documents?ref=... opens the track tab (lookup re-triggered by mount).
  const initialRef =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("ref")
      : null;

  const tabs: { key: TabKey; label: string; icon: typeof Search }[] = [
    { key: "track", label: t("documents.trackByReference"), icon: Search },
    { key: "mine", label: t("documents.myDocuments"), icon: FolderOpen },
    { key: "new", label: t("documents.submitNew"), icon: FilePlus2 },
  ];

  return (
    <div className="container-page">
      <header className="mb-8 flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-documents/12 text-documents shadow-sm">
          <FileText className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-documents">
            {t("nav.documents")}
          </p>
          <h1 className="text-2xl font-bold text-navy sm:text-3xl">
            {t("documents.title")}
          </h1>
          <p className="mt-1 text-slate-500">{t("documents.subtitle")}</p>
        </div>
      </header>

      <div
        role="tablist"
        aria-label={t("documents.title")}
        className="mb-6 flex flex-wrap gap-2 border-b border-slate-200"
      >
        {tabs.map((tb) => {
          const isActive = tab === tb.key;
          const Icon = tb.icon;
          return (
            <button
              key={tb.key}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => setTab(tb.key)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "border-documents text-documents"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {tb.label}
            </button>
          );
        })}
      </div>

      {tab === "track" && <TrackTab key={initialRef ?? "track"} initialRef={initialRef} />}
      {tab === "mine" && <MineTab />}
      {tab === "new" && <NewRequestTab />}
    </div>
  );
}
