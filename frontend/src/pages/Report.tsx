import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MapPin,
  Megaphone,
  Search,
  Map as MapIcon,
  LocateFixed,
  Phone,
  Tag,
  Type as TypeIcon,
  AlignLeft,
  Building2,
  ImagePlus,
  ThumbsUp,
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  CalendarDays,
} from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ISSUE_PRIORITIES } from "../lib/constants";
import { formatDate, formatDateTime, isValidPhone } from "../lib/format";
import { firstPhoto } from "../lib/images";
import SmartImage from "../components/SmartImage";
import type {
  Issue,
  IssueCategory,
  IssuePriority,
  IssueStats,
} from "../api/types";
import Spinner from "../components/Spinner";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";

type Tab = "report" | "track" | "map";

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-slate-400",
  medium: "bg-queue",
  high: "bg-documents",
  urgent: "bg-reports",
};

// Build an OpenStreetMap embed URL with a small bounding box around the marker.
function osmEmbedUrl(lat: number, lng: number): string {
  const d = 0.01;
  const bbox = [lng - d, lat - d, lng + d, lat + d].join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function MapEmbed({ lat, lng }: { lat: number; lng: number }) {
  return (
    <iframe
      title="map"
      className="h-56 w-full rounded-xl border border-slate-200"
      src={osmEmbedUrl(lat, lng)}
      loading="lazy"
    />
  );
}

export default function Report() {
  const { t } = useTranslation();
  const { phone } = useAuth();

  const [tab, setTab] = useState<Tab>("report");
  const [categories, setCategories] = useState<IssueCategory[]>([]);

  useEffect(() => {
    api.issues
      .categories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const categoryName = useCallback(
    (id: number | null | undefined, fallback?: IssueCategory | null) => {
      if (fallback) return `${fallback.icon ? `${fallback.icon} ` : ""}${fallback.name}`;
      const c = categories.find((x) => x.id === id);
      return c ? `${c.icon ? `${c.icon} ` : ""}${c.name}` : t("common.none");
    },
    [categories, t]
  );

  const tabs: { key: Tab; label: string; icon: typeof Megaphone }[] = [
    { key: "report", label: t("report.reportIssue"), icon: Megaphone },
    { key: "track", label: t("report.trackReport"), icon: Search },
    { key: "map", label: t("report.browseMap"), icon: MapIcon },
  ];

  return (
    <div className="container-page">
      <header className="mb-8 flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-reports/12 text-reports shadow-sm">
          <MapPin className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-reports">
            {t("nav.report")}
          </p>
          <h1 className="text-2xl font-bold text-navy sm:text-3xl">
            {t("report.title")}
          </h1>
          <p className="mt-1 text-slate-500">{t("report.subtitle")}</p>
        </div>
      </header>

      <div
        className="mb-6 flex flex-wrap gap-2 border-b border-slate-200"
        role="tablist"
      >
        {tabs.map((x) => {
          const isActive = tab === x.key;
          const Icon = x.icon;
          return (
            <button
              key={x.key}
              role="tab"
              aria-selected={isActive}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "border-reports text-reports"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
              onClick={() => setTab(x.key)}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {x.label}
            </button>
          );
        })}
      </div>

      {tab === "report" && (
        <ReportTab
          phone={phone}
          categories={categories}
        />
      )}
      {tab === "track" && (
        <TrackTab phone={phone} categoryName={categoryName} />
      )}
      {tab === "map" && <MapTab categoryName={categoryName} />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Report a problem                                                           */
/* -------------------------------------------------------------------------- */

function ReportTab({
  phone,
  categories,
}: {
  phone: string | null;
  categories: IssueCategory[];
}) {
  const { t } = useTranslation();

  const [reporterPhone, setReporterPhone] = useState(phone ?? "");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<IssuePriority>("medium");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [photo, setPhoto] = useState("");
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Issue | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (phone && !reporterPhone) setReporterPhone(phone);
  }, [phone, reporterPhone]);

  const latNum = lat.trim() === "" ? null : Number(lat);
  const lngNum = lng.trim() === "" ? null : Number(lng);
  const hasValidCoords =
    latNum !== null &&
    lngNum !== null &&
    !Number.isNaN(latNum) &&
    !Number.isNaN(lngNum);

  const useMyLocation = () => {
    setError(null);
    if (!navigator.geolocation) {
      setError(t("common.error"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => {
        setError(t("common.error"));
        setLocating(false);
      }
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isValidPhone(reporterPhone)) {
      setError(t("common.error"));
      return;
    }
    if (!title.trim()) {
      setError(t("common.error"));
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        reporter_phone: reporterPhone.trim(),
        title: title.trim(),
        priority,
      };
      if (categoryId !== "") body.category_id = categoryId;
      if (description.trim()) body.description = description.trim();
      if (address.trim()) body.address = address.trim();
      if (city.trim()) body.city = city.trim();
      if (photo.trim()) body.photos = [photo.trim()];
      if (hasValidCoords) {
        body.location_lat = latNum;
        body.location_lng = lngNum;
      }
      const issue = await api.issues.report(body);
      setResult(issue);
    } catch {
      setError(t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setResult(null);
    setCategoryId("");
    setTitle("");
    setDescription("");
    setPriority("medium");
    setAddress("");
    setCity("");
    setPhoto("");
    setLat("");
    setLng("");
  };

  if (result) {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-civic-green/15 text-civic-green">
          <CheckCircle2 className="h-8 w-8" aria-hidden />
        </div>
        <h2 className="mt-4 text-lg font-bold text-navy">{result.title}</h2>
        <p className="mt-3 rounded-xl bg-civic-green/10 px-4 py-3 font-medium text-civic-greenDark">
          {t("report.reportSubmitted", { ref: result.reference_number })}
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <StatusBadge status={result.status} />
          <StatusBadge status={result.priority} />
        </div>
        <button
          className="btn-primary mt-6 bg-reports hover:bg-reports/90 focus:ring-reports"
          onClick={reset}
        >
          <Megaphone className="h-4 w-4" aria-hidden />
          {t("report.reportIssue")}
        </button>
      </div>
    );
  }

  return (
    <form className="card mx-auto max-w-xl p-6" onSubmit={submit}>
      <div className="grid gap-4">
        <div>
          <label className="label" htmlFor="rp-phone">
            {t("common.phone")}
          </label>
          <div className="relative">
            <Phone
              className="pointer-events-none absolute inset-y-0 my-auto h-4 w-4 text-slate-400 ms-3"
              aria-hidden
            />
            <input
              id="rp-phone"
              className="input ps-9"
              type="tel"
              placeholder="+216 55 123 456"
              value={reporterPhone}
              onChange={(e) => setReporterPhone(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label className="label flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-reports" aria-hidden />
            {t("report.category")}
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategoryId("")}
              aria-pressed={categoryId === ""}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                categoryId === ""
                  ? "border-reports bg-reports/10 text-reports"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {t("common.all")}
            </button>
            {categories.map((c) => {
              const active = categoryId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? "border-reports bg-reports/10 text-reports"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {c.icon && <span aria-hidden>{c.icon}</span>}
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="label flex items-center gap-1.5" htmlFor="rp-title">
            <TypeIcon className="h-3.5 w-3.5 text-reports" aria-hidden />
            {t("report.issueTitle")}
          </label>
          <input
            id="rp-title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label flex items-center gap-1.5" htmlFor="rp-desc">
            <AlignLeft className="h-3.5 w-3.5 text-reports" aria-hidden />
            {t("report.description")}
          </label>
          <textarea
            id="rp-desc"
            className="input min-h-[96px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="label">{t("report.priority")}</label>
          <div className="flex flex-wrap gap-2">
            {ISSUE_PRIORITIES.map((p) => {
              const active = priority === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? "border-reports bg-reports/10 text-reports"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${PRIORITY_DOT[p] ?? "bg-slate-400"}`}
                    aria-hidden
                  />
                  {t(`priority.${p}`)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label flex items-center gap-1.5" htmlFor="rp-address">
              <MapPin className="h-3.5 w-3.5 text-reports" aria-hidden />
              {t("report.address")}
            </label>
            <input
              id="rp-address"
              className="input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div>
            <label className="label flex items-center gap-1.5" htmlFor="rp-city">
              <Building2 className="h-3.5 w-3.5 text-reports" aria-hidden />
              {t("common.city")}
            </label>
            <input
              id="rp-city"
              className="input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label flex items-center gap-1.5" htmlFor="rp-photo">
            <ImagePlus className="h-3.5 w-3.5 text-reports" aria-hidden />
            {t("report.photo")}{" "}
            <span className="font-normal text-slate-400">
              ({t("common.optional")})
            </span>
          </label>
          <input
            id="rp-photo"
            className="input"
            type="url"
            placeholder="https://…"
            value={photo}
            onChange={(e) => setPhoto(e.target.value)}
          />
        </div>

        <fieldset className="rounded-xl border border-slate-200 p-4">
          <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold text-slate-600">
            <MapPin className="h-4 w-4 text-reports" aria-hidden />
            {t("report.pinLocation")}
          </legend>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="rp-lat">
                {t("report.latitude")}
              </label>
              <input
                id="rp-lat"
                className="input"
                inputMode="decimal"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="rp-lng">
                {t("report.longitude")}
              </label>
              <input
                id="rp-lng"
                className="input"
                inputMode="decimal"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
              />
            </div>
          </div>
          <button
            type="button"
            className="btn-ghost"
            onClick={useMyLocation}
            disabled={locating}
          >
            <LocateFixed className="h-4 w-4 text-reports" aria-hidden />
            {t("report.useMyLocation")}
          </button>
          {hasValidCoords && (
            <div className="mt-3">
              <MapEmbed lat={latNum} lng={lngNum} />
            </div>
          )}
        </fieldset>

        {error && (
          <p className="flex items-center gap-2 text-sm text-reports">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            {error}
          </p>
        )}

        <button
          className="btn-primary w-full bg-reports hover:bg-reports/90 focus:ring-reports"
          type="submit"
          disabled={busy}
        >
          <Megaphone className="h-4 w-4" aria-hidden />
          {busy ? t("common.loading") : t("common.submit")}
        </button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Track a report                                                             */
/* -------------------------------------------------------------------------- */

function TrackTab({
  phone,
  categoryName,
}: {
  phone: string | null;
  categoryName: (
    id: number | null | undefined,
    fallback?: IssueCategory | null
  ) => string;
}) {
  const { t } = useTranslation();
  const [reference, setReference] = useState("");
  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [voting, setVoting] = useState(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reference.trim()) return;
    setLoading(true);
    setError(null);
    setNotFound(false);
    setIssue(null);
    try {
      const found = await api.issues.track(reference.trim());
      setIssue(found);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const upvote = async () => {
    if (!issue) return;
    const voter = phone ?? "";
    if (!isValidPhone(voter)) {
      setError(t("auth.mustLogin"));
      return;
    }
    setVoting(true);
    setError(null);
    try {
      await api.issues.upvote(issue.id, voter);
      setIssue({ ...issue, upvote_count: issue.upvote_count + 1 });
    } catch {
      setError(t("common.error"));
    } finally {
      setVoting(false);
    }
  };

  const hasCoords =
    issue?.location_lat != null && issue?.location_lng != null;

  return (
    <div className="mx-auto max-w-2xl">
      <form
        className="card mb-6 flex flex-col gap-3 p-4 sm:flex-row"
        onSubmit={search}
      >
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute inset-y-0 my-auto h-4 w-4 text-slate-400 ms-3"
            aria-hidden
          />
          <input
            className="input ps-9 font-mono"
            placeholder={t("documents.referencePlaceholder")}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            aria-label={t("documents.referenceNumber")}
          />
        </div>
        <button
          className="btn-primary bg-reports hover:bg-reports/90 focus:ring-reports"
          type="submit"
          disabled={loading}
        >
          <Search className="h-4 w-4" aria-hidden />
          {t("documents.track")}
        </button>
      </form>

      {loading && <Spinner label={t("common.loading")} />}

      {notFound && !loading && (
        <EmptyState icon="🔍" title={t("common.notFound")}>
          {t("documents.notFound")}
        </EmptyState>
      )}

      {issue && !loading && (
        <article className="card overflow-hidden">
          {issue.photos.length > 0 && (
            <SmartImage
              src={firstPhoto(issue.photos, issue.title, "reports")}
              alt={issue.title}
              fallbackLabel={issue.title}
              fallbackKey="reports"
              className="h-48 w-full object-cover"
            />
          )}
          <div className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-navy">{issue.title}</h2>
                <p className="mt-1 font-mono text-sm text-slate-400">
                  {issue.reference_number}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={issue.status} />
                <StatusBadge status={issue.priority} />
              </div>
            </div>

            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <Tag className="mt-0.5 h-4 w-4 shrink-0 text-reports" aria-hidden />
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">
                    {t("report.category")}
                  </dt>
                  <dd className="text-sm text-slate-700">
                    {categoryName(issue.category_id, issue.category)}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <CalendarDays
                  className="mt-0.5 h-4 w-4 shrink-0 text-reports"
                  aria-hidden
                />
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">
                    {t("common.date")}
                  </dt>
                  <dd className="text-sm text-slate-700">
                    {formatDate(issue.created_at)}
                  </dd>
                </div>
              </div>
              {issue.address && (
                <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 sm:col-span-2">
                  <MapPin
                    className="mt-0.5 h-4 w-4 shrink-0 text-reports"
                    aria-hidden
                  />
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">
                      {t("report.address")}
                    </dt>
                    <dd className="text-sm text-slate-700">
                      {issue.address}
                      {issue.city ? `, ${issue.city}` : ""}
                    </dd>
                  </div>
                </div>
              )}
            </dl>

            {issue.description && (
              <p className="mt-4 whitespace-pre-line text-slate-700">
                {issue.description}
              </p>
            )}

            {hasCoords && (
              <div className="mt-4">
                <MapEmbed
                  lat={issue.location_lat as number}
                  lng={issue.location_lng as number}
                />
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                className="btn-green"
                onClick={upvote}
                disabled={voting}
                type="button"
              >
                <ThumbsUp className="h-4 w-4" aria-hidden />
                {t("report.upvote")}
              </button>
              <span className="text-sm text-slate-500">
                {t("report.supporters", { count: issue.upvote_count })}
              </span>
            </div>

            {error && (
              <p className="mt-3 flex items-center gap-2 text-sm text-reports">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                {error}
              </p>
            )}

            {issue.resolution_note && (
              <div className="mt-5 rounded-xl border border-civic-green/20 bg-civic-green/8 p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-civic-greenDark">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  {t("report.resolutionNote")}
                </p>
                <p className="mt-1 text-civic-greenDark">{issue.resolution_note}</p>
              </div>
            )}

            {issue.updates && issue.updates.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <ClipboardList className="h-4 w-4 text-reports" aria-hidden />
                  {t("documents.history")}
                </h3>
                <ol className="relative space-y-5 border-s-2 border-reports/25 ps-5">
                  {issue.updates.map((u) => (
                    <li key={u.id} className="relative">
                      <span className="absolute -start-[1.65rem] top-1 grid h-4 w-4 place-items-center rounded-full bg-reports ring-4 ring-reports/15" />
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={u.status} />
                        <span className="text-xs text-slate-400">
                          {formatDateTime(u.updated_at)}
                        </span>
                      </div>
                      {u.message && (
                        <p className="mt-1 text-sm text-slate-700">{u.message}</p>
                      )}
                      {u.photo && (
                        <SmartImage
                          src={u.photo}
                          alt=""
                          fallbackLabel={issue.title}
                          fallbackKey="reports"
                          className="mt-2 h-24 rounded-lg border border-slate-200 object-cover"
                        />
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </article>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Issues map                                                                 */
/* -------------------------------------------------------------------------- */

function MapTab({
  categoryName,
}: {
  categoryName: (
    id: number | null | undefined,
    fallback?: IssueCategory | null
  ) => string;
}) {
  const { t } = useTranslation();
  const [cityInput, setCityInput] = useState("");
  const [city, setCity] = useState<string>("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [stats, setStats] = useState<IssueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (c: string) => {
    setLoading(true);
    setError(false);
    try {
      const params = c ? { city: c } : undefined;
      const [list, s] = await Promise.all([
        api.issues.browse(params),
        api.issues.stats(c || undefined),
      ]);
      setIssues(list);
      setStats(s);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(city);
  }, [city, load]);

  const applyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setCity(cityInput.trim());
  };

  // Center the optional map on the first issue with coordinates.
  const pinned = useMemo(
    () =>
      issues.find(
        (i) => i.location_lat != null && i.location_lng != null
      ) ?? null,
    [issues]
  );

  return (
    <div className="mx-auto max-w-3xl">
      <form
        className="card mb-6 flex flex-col gap-3 p-4 sm:flex-row"
        onSubmit={applyFilter}
      >
        <div className="relative flex-1">
          <Building2
            className="pointer-events-none absolute inset-y-0 my-auto h-4 w-4 text-slate-400 ms-3"
            aria-hidden
          />
          <input
            className="input ps-9"
            placeholder={t("home.searchPlaceholder")}
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            aria-label={t("common.city")}
          />
        </div>
        <button
          className="btn-primary bg-reports hover:bg-reports/90 focus:ring-reports"
          type="submit"
        >
          <Search className="h-4 w-4" aria-hidden />
          {t("common.search")}
        </button>
      </form>

      {stats && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-reports">{stats.total}</div>
            <div className="text-xs uppercase tracking-wide text-slate-400">
              {t("report.totalIssues")}
            </div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-civic-green">
              {Math.round(stats.resolved_rate * 100)}%
            </div>
            <div className="text-xs uppercase tracking-wide text-slate-400">
              {t("report.resolvedRate")}
            </div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-navy">
              {stats.avg_resolution_days != null
                ? `${Math.round(stats.avg_resolution_days)} ${t("report.days")}`
                : "—"}
            </div>
            <div className="text-xs uppercase tracking-wide text-slate-400">
              {t("report.avgResolution")}
            </div>
          </div>
        </div>
      )}

      {pinned && (
        <div className="mb-6">
          <MapEmbed
            lat={pinned.location_lat as number}
            lng={pinned.location_lng as number}
          />
        </div>
      )}

      {loading && <Spinner label={t("common.loading")} />}

      {error && !loading && (
        <EmptyState icon="⚠️" title={t("common.error")}>
          <button className="btn-ghost mt-2" onClick={() => load(city)}>
            {t("common.retry")}
          </button>
        </EmptyState>
      )}

      {!loading && !error && issues.length === 0 && (
        <EmptyState icon="📍" title={t("common.notFound")} />
      )}

      {!loading && !error && issues.length > 0 && (
        <ul className="space-y-3">
          {issues.map((issue) => (
            <li key={issue.id} className="card p-4 transition hover:shadow-md">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-reports/12 text-reports">
                    <MapPin className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-navy">
                      {issue.title}
                    </h3>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {categoryName(issue.category_id, issue.category)}
                      {issue.city ? ` · ${issue.city}` : ""}
                    </p>
                    {issue.address && (
                      <p className="text-xs text-slate-400">{issue.address}</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={issue.status} />
                    <StatusBadge status={issue.priority} />
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                    <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                    {t("report.supporters", { count: issue.upvote_count })}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
