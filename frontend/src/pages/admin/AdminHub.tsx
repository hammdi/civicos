import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ShieldCheck, LogOut, ChevronRight, Lock, User as UserIcon } from "lucide-react";
import { api, tokens } from "../../api/client";
import Spinner from "../../components/Spinner";
import { MODULES } from "../../lib/constants";
import { MODULE_ICONS } from "../../lib/icons";

interface AdminModuleLink {
  to: string;
  labelKey: "admin.queueModule" | "admin.documentsModule" | "admin.issuesModule";
  iconKey: "queue" | "documents" | "reports";
  accentClass: string;
}

const ADMIN_LINKS: AdminModuleLink[] = [
  { to: "/admin/queue", labelKey: "admin.queueModule", iconKey: "queue", accentClass: "queue" },
  { to: "/admin/documents", labelKey: "admin.documentsModule", iconKey: "documents", accentClass: "documents" },
  { to: "/admin/issues", labelKey: "admin.issuesModule", iconKey: "reports", accentClass: "reports" },
];

export default function AdminHub() {
  const { t } = useTranslation();
  const [info, setInfo] = useState(() => tokens.adminInfo());
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await api.auth.adminLogin(username.trim(), password);
      tokens.setAdmin(token);
      setInfo(token);
      setPassword("");
    } catch {
      setError(t("admin.loginFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  function handleLogout() {
    tokens.clearAdmin();
    setInfo(null);
    setUsername("");
    setPassword("");
  }

  // --- Login view ----------------------------------------------------------
  if (!tokens.admin() || !info) {
    return (
      <div className="container-page">
        <div className="mx-auto max-w-md">
          <div className="card overflow-hidden p-0">
            <div className="bg-navy px-6 py-8 text-center text-white sm:px-8">
              <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <ShieldCheck className="h-7 w-7" aria-hidden />
              </div>
              <h1 className="text-xl font-bold">{t("admin.login")}</h1>
              <p className="mt-1 text-sm text-white/60">{t("common.appName")}</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4 p-6 sm:p-8" noValidate>
              <div>
                <label className="label" htmlFor="admin-username">
                  {t("admin.username")}
                </label>
                <div className="relative">
                  <UserIcon
                    className="pointer-events-none absolute inset-y-0 my-auto h-4 w-4 text-slate-400 ms-3"
                    aria-hidden
                  />
                  <input
                    id="admin-username"
                    className="input ps-9"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="admin-password">
                  {t("admin.password")}
                </label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute inset-y-0 my-auto h-4 w-4 text-slate-400 ms-3"
                    aria-hidden
                  />
                  <input
                    id="admin-password"
                    className="input ps-9"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="btn-primary w-full justify-center"
                disabled={submitting || !username.trim() || !password}
              >
                {submitting ? t("common.loading") : t("admin.signIn")}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // --- Authenticated hub ---------------------------------------------------
  if (submitting) {
    return (
      <div className="container-page">
        <Spinner label={t("common.loading")} />
      </div>
    );
  }

  return (
    <div className="container-page">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-navy text-white shadow-sm">
            <ShieldCheck className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t("admin.dashboard")}
            </p>
            <h1 className="text-2xl font-bold text-navy">
              {t("admin.welcome", { name: info.full_name })}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              @{info.username}
              {info.institution_type
                ? ` · ${t(`institutionTypes.${info.institution_type}`, { defaultValue: info.institution_type })}`
                : ""}
            </p>
          </div>
        </div>
        <button type="button" className="btn-ghost self-start" onClick={handleLogout}>
          <LogOut className="h-4 w-4" aria-hidden />
          {t("common.logout")}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_LINKS.map((link) => {
          const accent = MODULES.find((m) => m.accentClass === link.accentClass)?.accent;
          const Icon = MODULE_ICONS[link.iconKey];
          return (
            <Link
              key={link.to}
              to={link.to}
              className="card group flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-md"
              style={accent ? { borderInlineStartColor: accent, borderInlineStartWidth: 4 } : undefined}
            >
              <div
                className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-${link.accentClass}/10 text-${link.accentClass}`}
              >
                <Icon className="h-6 w-6" aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className={`font-semibold text-${link.accentClass}`}>{t(link.labelKey)}</h2>
                <p className="text-sm text-slate-500">{t("admin.dashboard")}</p>
              </div>
              <ChevronRight
                className="ms-auto h-5 w-5 shrink-0 text-slate-300 transition group-hover:text-navy rtl:rotate-180"
                aria-hidden
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
