import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Compass, Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="container-page">
      <div className="mx-auto flex min-h-[65vh] max-w-lg flex-col items-center justify-center text-center">
        <div className="relative mb-6">
          <span
            aria-hidden
            className="absolute inset-0 -z-10 m-auto h-40 w-40 rounded-full bg-navy-100 blur-2xl"
          />
          <div className="grid h-24 w-24 place-items-center rounded-3xl bg-navy text-white shadow-lg">
            <Compass className="h-11 w-11" aria-hidden />
          </div>
        </div>

        <p className="bg-gradient-to-br from-navy to-navy-600 bg-clip-text text-7xl font-extrabold leading-none text-transparent sm:text-8xl">
          404
        </p>

        <h1 className="mt-4 text-xl font-bold text-slate-700 sm:text-2xl">
          {t("common.notFound")}
        </h1>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          The page you are looking for doesn’t exist or has moved.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/" className="btn-primary">
            <Home className="h-4 w-4" aria-hidden />
            {t("nav.home")}
          </Link>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-4 w-4 rtl-flip" aria-hidden />
            {t("common.back")}
          </button>
        </div>

        <p className="mt-10 text-xs font-medium uppercase tracking-wider text-slate-400">
          {t("common.appName")}
        </p>
      </div>
    </div>
  );
}
