import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import type { ModuleMeta } from "../lib/constants";
import { MODULE_ICONS } from "../lib/icons";

export default function ModuleCard({ module }: { module: ModuleMeta }) {
  const { t } = useTranslation();
  const Icon = MODULE_ICONS[module.key];

  return (
    <Link
      to={module.route}
      className="card group flex flex-col gap-4 p-6 transition hover:-translate-y-1 hover:shadow-md"
      style={{ borderTopColor: module.accent, borderTopWidth: 4 }}
    >
      <span
        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{ backgroundColor: `${module.accent}1A`, color: module.accent }}
      >
        <Icon className="h-6 w-6" />
      </span>

      <div className="space-y-1.5">
        <h3 className="text-lg font-bold text-navy">{t(`modules.${module.key}.title`)}</h3>
        <p className="text-sm leading-relaxed text-slate-500">
          {t(`modules.${module.key}.desc`)}
        </p>
      </div>

      <span
        className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold"
        style={{ color: module.accent }}
      >
        {t("home.open")}
        <ArrowRight className="h-4 w-4 rtl-flip transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
