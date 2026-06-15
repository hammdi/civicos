import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Landmark, Heart } from "lucide-react";
import { MODULES } from "../lib/constants";
import { MODULE_ICONS } from "../lib/icons";

export default function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-12">
        {/* Brand blurb */}
        <div className="md:col-span-5">
          <Link to="/" className="flex items-center gap-2 font-bold text-navy">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-navy text-white">
              <Landmark className="h-5 w-5" />
            </span>
            <span className="text-lg tracking-tight">CivicOS</span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-500">
            {t("footer.vision")}
          </p>
          <p className="mt-4 text-xs font-medium text-slate-400">{t("footer.builtFor")}</p>
        </div>

        {/* Services column */}
        <div className="md:col-span-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t("footer.services")}
          </h3>
          <ul className="mt-4 space-y-3">
            {MODULES.map((m) => {
              const Icon = MODULE_ICONS[m.key];
              return (
                <li key={m.key}>
                  <Link
                    to={m.route}
                    className="group inline-flex items-center gap-2.5 text-sm text-slate-600 transition hover:text-navy"
                  >
                    <span
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${m.accent}1A`, color: m.accent }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    {t(`modules.${m.key}.title`)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Platform column */}
        <div className="md:col-span-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t("footer.company")}
          </h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li>
              <Link to="/help" className="transition hover:text-navy">
                {t("footer.help")}
              </Link>
            </li>
            <li>
              <a
                href="#"
                className="transition hover:text-navy"
                target="_blank"
                rel="noreferrer"
              >
                {t("footer.docs")}
              </a>
            </li>
            <li>
              <Link to="/admin" className="transition hover:text-navy">
                {t("footer.admin")}
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom line */}
      <div className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-slate-400 sm:flex-row sm:px-6">
          <p className="inline-flex items-center gap-1.5">
            {t("footer.openSource")}
            <Heart className="h-3.5 w-3.5 text-civic-green" />
          </p>
          <p>
            © {year} CivicOS · {t("footer.rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}
