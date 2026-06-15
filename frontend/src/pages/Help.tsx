import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronRight,
  Mail,
  Search,
  LifeBuoy,
  User as UserIcon,
  Bell,
  type LucideIcon,
} from "lucide-react";
import { MODULES } from "../lib/constants";
import { MODULE_ICONS } from "../lib/icons";

interface Guide {
  key: "queue" | "documents" | "market" | "reports";
  route: string;
  accentClass: string;
  title: string;
  desc: string;
}

export default function Help() {
  const { t } = useTranslation();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const guideText: Record<Guide["key"], string> = {
    queue: t("help.guideQueue"),
    documents: t("help.guideDocuments"),
    market: t("help.guideMarket"),
    reports: t("help.guideReports"),
  };

  const guides: Guide[] = MODULES.map((module) => ({
    key: module.key,
    route: module.route,
    accentClass: module.accentClass,
    title: t(`modules.${module.key}.title`),
    desc: guideText[module.key],
  }));

  const faqs = [1, 2, 3, 4, 5, 6].map((n) => ({
    q: t(`help.q${n}`),
    a: t(`help.a${n}`),
  }));

  const contactEmail = t("help.contactEmail");

  return (
    <div className="bg-slate-50">
      {/* Header */}
      <section className="bg-gradient-to-br from-navy via-navy to-slate-900 text-white">
        <div className="container-page py-14 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-200">
              <LifeBuoy className="h-4 w-4" aria-hidden="true" />
              {t("nav.help")}
            </span>
            <h1 className="mt-5 text-3xl font-extrabold leading-tight sm:text-4xl">
              {t("help.title")}
            </h1>
            <p className="mt-4 text-base text-slate-200 sm:text-lg">
              {t("help.subtitle")}
            </p>

            <div className="relative mx-auto mt-8 max-w-lg">
              <Search
                className="pointer-events-none absolute inset-y-0 my-auto h-5 w-5 text-slate-400 ms-4"
                aria-hidden="true"
              />
              <input
                type="search"
                placeholder={t("help.searchPlaceholder")}
                aria-label={t("help.searchPlaceholder")}
                className="input w-full text-navy ps-12"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Service guides */}
      <section className="container-page py-12 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {t("nav.services")}
        </p>
        <h2 className="mt-1 text-2xl font-bold text-navy">
          {t("help.guidesTitle")}
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {guides.map((guide) => {
            const Icon = MODULE_ICONS[guide.key];
            return (
              <Link
                key={guide.key}
                to={guide.route}
                className="card group flex flex-col p-6 transition-shadow hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
              >
                <span
                  className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-${guide.accentClass}/10 text-${guide.accentClass}`}
                >
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-navy">
                  {guide.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
                  {guide.desc}
                </p>
                <span
                  className={`mt-4 inline-flex items-center gap-1 text-sm font-semibold text-${guide.accentClass}`}
                >
                  {t("common.viewDetails")}
                  <ChevronRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* How your request is handled — actor / interface flow */}
      <section className="border-y border-slate-100 bg-white">
        <div className="container-page py-12 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t("flow.subtitle")}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-navy">{t("flow.title")}</h2>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {MODULES.map((module) => {
              const Icon = MODULE_ICONS[module.key];
              const steps: {
                label: string;
                Step: LucideIcon;
                text: string;
                where?: string;
                accent?: boolean;
              }[] = [
                {
                  label: t("flow.youSubmit"),
                  Step: UserIcon,
                  text: t(`flow.${module.key}.citizen`),
                },
                {
                  label: `${t("flow.processedBy")} · ${t(`flow.${module.key}.actor`)}`,
                  Step: Icon,
                  text: t(`flow.${module.key}.process`),
                  where: t(`flow.${module.key}.where`),
                  accent: true,
                },
                {
                  label: t("flow.youNotified"),
                  Step: Bell,
                  text: t(`flow.${module.key}.notify`),
                },
              ];
              return (
                <div key={module.key} className="card p-6">
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${module.accent}1A`, color: module.accent }}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="text-lg font-semibold text-navy">
                      {t(`modules.${module.key}.title`)}
                    </h3>
                  </div>

                  <ol className="mt-5 space-y-1">
                    {steps.map((s, i) => (
                      <li key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border"
                            style={
                              s.accent
                                ? {
                                    backgroundColor: module.accent,
                                    color: "#fff",
                                    borderColor: module.accent,
                                  }
                                : { borderColor: "#e2e8f0", color: "#64748b" }
                            }
                          >
                            <s.Step className="h-4 w-4" aria-hidden="true" />
                          </span>
                          {i < steps.length - 1 && (
                            <span className="my-1 h-6 w-px bg-slate-200" aria-hidden="true" />
                          )}
                        </div>
                        <div className="pb-3">
                          <p className="text-sm font-semibold text-navy">{s.label}</p>
                          <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{s.text}</p>
                          {s.where && (
                            <span className="mt-1.5 inline-block rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-500">
                              {s.where}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ accordion */}
      <section className="container-page pb-12 sm:pb-16">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          FAQ
        </p>
        <h2 className="mt-1 text-2xl font-bold text-navy">
          {t("help.faqTitle")}
        </h2>

        <div className="mt-8 mx-auto max-w-3xl space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            const panelId = `faq-panel-${index}`;
            const buttonId = `faq-button-${index}`;
            return (
              <div key={index} className="card overflow-hidden p-0">
                <h3>
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="flex w-full items-center justify-between gap-4 p-5 text-start transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-navy/40"
                  >
                    <span className="text-base font-semibold text-navy">
                      {faq.q}
                    </span>
                    <ChevronDown
                      className={`h-5 w-5 flex-shrink-0 text-slate-400 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  hidden={!isOpen}
                  className="px-5 pb-5 text-sm leading-relaxed text-slate-600"
                >
                  {faq.a}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Contact card */}
      <section className="container-page pb-16 sm:pb-24">
        <div className="mx-auto max-w-3xl">
          <div className="card flex flex-col items-center gap-6 p-8 text-center sm:flex-row sm:items-center sm:text-start">
            <span className="inline-flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-navy/10 text-navy">
              <Mail className="h-7 w-7" aria-hidden="true" />
            </span>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-navy">
                {t("help.contactTitle")}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {t("help.contactDesc")}
              </p>
            </div>
            <a
              href={`mailto:${contactEmail}`}
              className="btn-primary whitespace-nowrap"
            >
              {contactEmail}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
