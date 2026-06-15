// Small formatting helpers shared across pages.

export function formatPrice(price: number, currency = "TND"): string {
  return `${Number(price).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value).getTime();
  if (Number.isNaN(d)) return "—";
  const diffMin = Math.round((d - Date.now()) / 60000);
  const abs = Math.abs(diffMin);
  if (abs < 60) return `${abs} min`;
  if (abs < 1440) return `${Math.round(abs / 60)} h`;
  return `${Math.round(abs / 1440)} d`;
}

export function formatWait(minutes: number): string {
  if (minutes <= 0) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// A safe phone validator good enough for international numbers.
export function isValidPhone(phone: string): boolean {
  return /^\+?[0-9]{6,15}$/.test(phone.replace(/[\s-]/g, ""));
}
