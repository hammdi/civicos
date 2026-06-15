import { useTranslation } from "react-i18next";
import { STATUS_COLORS } from "../lib/constants";

export default function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const cls = STATUS_COLORS[status] ?? "bg-slate-100 text-slate-700";
  const label = t(`statuses.${status}`, { defaultValue: status });
  return <span className={`badge ${cls}`}>{label}</span>;
}
