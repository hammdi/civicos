import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "../lib/constants";

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  return (
    <select
      aria-label="Language"
      value={i18n.language?.split("-")[0] || "en"}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      className="rounded-md border border-white/30 bg-white/10 px-2 py-1 text-sm text-white outline-none"
    >
      {SUPPORTED_LANGUAGES.map((l) => (
        <option key={l.code} value={l.code} className="text-slate-800">
          {l.label}
        </option>
      ))}
    </select>
  );
}
