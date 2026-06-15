import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Sparkles,
  ArrowRight,
  Ticket,
  FileText,
  ShoppingBag,
  MapPin,
  Building2,
  Globe,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { api } from "../api/client";
import { MODULES } from "../lib/constants";
import { MODULE_ICONS } from "../lib/icons";
import { HERO_ILLUSTRATION } from "../lib/images";
import { useAuth } from "../context/AuthContext";

interface LandingStats {
  queues: number;
  documents: number;
  listings: number;
  issues: number;
}

export default function Home() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [stats, setStats] = useState<LandingStats | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      // Each endpoint is independent — fetch in parallel and degrade gracefully
      // if any single call fails (settled results, not all-or-nothing).
      const [institutions, issueStats, listings] = await Promise.allSettled([
        api.institutions.list(),
        api.issues.stats(),
        api.listings.browse(),
      ]);

      if (cancelled) return;

      const institutionsList =
        institutions.status === "fulfilled" ? institutions.value : [];

      setStats({
        queues: institutionsList.filter((i) => i.queue_status === "open").length,
        documents:
          institutionsList.length > 0 ? institutionsList.length : 0,
        listings: listings.status === "fulfilled" ? listings.value.length : 0,
        issues: issueStats.status === "fulfilled" ? issueStats.value.total : 0,
      });
    }

    void loadStats();
    return () => {
      cancelled = true;
    };
  }, []);

  const statTiles: {
    key: keyof LandingStats;
    label: string;
    icon: typeof Ticket;
    accent: string;
  }[] = [
    { key: "queues", label: t("landing.statQueues"), icon: Ticket, accent: "#2563EB" },
    { key: "documents", label: t("landing.statDocuments"), icon: FileText, accent: "#EA8A0B" },
    { key: "listings", label: t("landing.statListings"), icon: ShoppingBag, accent: "#27AE60" },
    { key: "issues", label: t("landing.statIssues"), icon: MapPin, accent: "#E74C3C" },
  ];

  const steps: { title: string; desc: string }[] = [
    { title: t("landing.step1Title"), desc: t("landing.step1Desc") },
    { title: t("landing.step2Title"), desc: t("landing.step2Desc") },
    { title: t("landing.step3Title"), desc: t("landing.step3Desc") },
  ];

  // Split the hero title so the highlighted phrase renders in civic-green.
  const heroTitle = t("landing.heroTitle");
  const heroHighlight = t("landing.heroHighlight");
  const highlightIndex = heroTitle.toLowerCase().indexOf(heroHighlight.toLowerCase());
  const heroBefore =
    highlightIndex >= 0 ? heroTitle.slice(0, highlightIndex) : heroTitle;
  const heroMatch =
    highlightIndex >= 0
      ? heroTitle.slice(highlightIndex, highlightIndex + heroHighlight.length)
      : "";
  const heroAfter =
    highlightIndex >= 0
      ? heroTitle.slice(highlightIndex + heroHighlight.length)
      : "";

  return (
    <div className="overflow-hidden">
      {/* 1 — Hero */}
      <section className="relative bg-gradient-to-b from-white to-navy-50/40">
        <div className="container-page grid items-center gap-10 py-12 sm:py-20 lg:grid-cols-2 lg:gap-16">
          <div>
            <span className="badge gap-1.5 bg-civic-green/10 text-civic-greenDark">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {t("landing.badge")}
            </span>

            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-navy sm:text-5xl lg:text-6xl">
              {heroMatch ? (
                <>
                  {heroBefore}
                  <span className="text-civic-green">{heroMatch}</span>
                  {heroAfter}
                </>
              ) : (
                heroTitle
              )}
            </h1>

            <p className="mt-5 max-w-xl text-base text-slate-600 sm:text-lg">
              {t("landing.heroSubtitle")}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/account" className="btn-green px-6 py-3 text-base">
                {t("landing.ctaPrimary")}
                <ArrowRight className="h-4 w-4 rtl-flip" aria-hidden />
              </Link>
              <a href="#services" className="btn-ghost px-6 py-3 text-base">
                {t("landing.ctaSecondary")}
              </a>
            </div>

            <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
              <CheckCircle2 className="h-4 w-4 text-civic-green" aria-hidden />
              {t("landing.trustedBy")}
            </p>
          </div>

          <div className="relative">
            <div className="rounded-3xl bg-navy-50 p-6 shadow-sm ring-1 ring-navy-100 sm:p-10">
              <img
                src={HERO_ILLUSTRATION}
                alt=""
                className="mx-auto w-full max-w-md"
                aria-hidden
              />
            </div>
          </div>
        </div>
      </section>

      {/* 2 — Live stats strip */}
      <section className="border-y border-slate-100 bg-white">
        <div className="container-page py-10 sm:py-12">
          <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
            {statTiles.map(({ key, label, icon: Icon, accent }) => {
              const value = stats ? stats[key] : null;
              return (
                <div
                  key={key}
                  className="card flex items-center gap-4 p-5"
                >
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${accent}1A`, color: accent }}
                  >
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <dd className="text-2xl font-extrabold text-navy sm:text-3xl">
                      {value === null ? (
                        <span className="inline-block h-7 w-12 animate-pulse rounded bg-slate-200 align-middle" />
                      ) : (
                        value.toLocaleString()
                      )}
                    </dd>
                    <dt className="mt-0.5 truncate text-xs font-medium text-slate-500 sm:text-sm">
                      {label}
                    </dt>
                  </div>
                </div>
              );
            })}
          </dl>
        </div>
      </section>

      {/* 3 — Services grid */}
      <section id="services" className="container-page py-16 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-civic-green">
            {t("nav.services")}
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
            {t("landing.servicesTitle")}
          </h2>
          <p className="mt-4 text-base text-slate-600">
            {t("landing.servicesSubtitle")}
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((module) => {
            const Icon = MODULE_ICONS[module.key];
            return (
              <Link
                key={module.key}
                to={module.route}
                className="card group relative flex flex-col gap-4 overflow-hidden p-6 transition hover:-translate-y-1 hover:shadow-md"
              >
                <span
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ backgroundColor: module.accent }}
                  aria-hidden
                />
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: `${module.accent}1A`, color: module.accent }}
                >
                  <Icon className="h-7 w-7" aria-hidden />
                </span>
                <h3 className="text-lg font-bold text-navy">
                  {t(`modules.${module.key}.title`)}
                </h3>
                <p className="text-sm leading-relaxed text-slate-500">
                  {t(`modules.${module.key}.desc`)}
                </p>
                <span
                  className="mt-auto inline-flex items-center gap-1 text-sm font-semibold"
                  style={{ color: module.accent }}
                >
                  {t("home.open")}
                  <ChevronRight className="h-4 w-4 rtl-flip transition group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 4 — How it works */}
      <section className="bg-navy-50/50">
        <div className="container-page py-16 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-civic-green">
              {t("landing.howSubtitle")}
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
              {t("landing.howTitle")}
            </h2>
          </div>

          <ol className="mt-12 grid gap-8 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={i} className="card relative flex flex-col gap-3 p-7">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy text-lg font-extrabold text-white">
                  {i + 1}
                </span>
                <h3 className="text-lg font-bold text-navy">{step.title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">
                  {step.desc}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 5 — Institutions CTA band */}
      <section className="container-page py-16 sm:py-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy via-navy to-slate-900 p-8 text-white sm:p-12">
          <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto]">
            <div>
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                <Building2 className="h-7 w-7" aria-hidden />
              </span>
              <h2 className="mt-5 text-2xl font-bold sm:text-3xl">
                {t("landing.institutionsTitle")}
              </h2>
              <p className="mt-3 max-w-2xl text-base text-slate-200">
                {t("landing.institutionsDesc")}
              </p>
            </div>
            <Link
              to="/admin"
              className="btn bg-white px-6 py-3 text-base text-navy hover:bg-slate-100"
            >
              {t("landing.institutionsCta")}
              <ArrowRight className="h-4 w-4 rtl-flip" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* 6 — Languages note */}
      <section className="border-y border-slate-100 bg-white">
        <div className="container-page flex flex-col items-center gap-4 py-12 text-center sm:flex-row sm:gap-6 sm:text-start">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-civic-green/10 text-civic-green">
            <Globe className="h-7 w-7" aria-hidden />
          </span>
          <div>
            <h2 className="text-xl font-bold text-navy">
              {t("landing.languagesTitle")}
            </h2>
            <p className="mt-1 text-sm text-slate-600 sm:text-base">
              {t("landing.languagesDesc")}
            </p>
          </div>
        </div>
      </section>

      {/* 7 — Final CTA band */}
      <section className="bg-gradient-to-br from-civic-green to-civic-greenDark">
        <div className="container-page py-16 text-center sm:py-24">
          <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {t("landing.finalTitle")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/90 sm:text-lg">
            {t("landing.finalSubtitle")}
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              to="/account"
              className="btn bg-white px-7 py-3 text-base text-civic-greenDark hover:bg-slate-100"
            >
              {isAuthenticated ? t("nav.account") : t("landing.finalCta")}
              <ArrowRight className="h-4 w-4 rtl-flip" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
