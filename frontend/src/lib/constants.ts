// Module metadata: route, accent color and icon used across the UI.

export interface ModuleMeta {
  key: "queue" | "documents" | "market" | "reports";
  route: string;
  accent: string; // tailwind text/bg color hex
  accentClass: string; // tailwind class prefix
  icon: string; // emoji used as a lightweight icon
}

export const MODULES: ModuleMeta[] = [
  { key: "queue", route: "/queue", accent: "#2563EB", accentClass: "queue", icon: "🎫" },
  { key: "documents", route: "/documents", accent: "#EA8A0B", accentClass: "documents", icon: "📄" },
  { key: "market", route: "/market", accent: "#27AE60", accentClass: "market", icon: "🛒" },
  { key: "reports", route: "/report", accent: "#E74C3C", accentClass: "reports", icon: "📍" },
];

export const INSTITUTION_TYPES = [
  "hospital",
  "municipality",
  "post",
  "court",
  "tax_office",
] as const;

export const MARKET_CATEGORIES = [
  "food",
  "clothing",
  "electronics",
  "furniture",
  "services",
  "crafts",
  "other",
] as const;

export const ISSUE_STATUSES = [
  "reported",
  "acknowledged",
  "in_progress",
  "resolved",
  "closed",
] as const;

export const ISSUE_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const FILE_STATUSES = [
  "submitted",
  "processing",
  "ready",
  "delivered",
  "rejected",
] as const;

// Tailwind color classes per status (background + text) for badges.
export const STATUS_COLORS: Record<string, string> = {
  // queue
  waiting: "bg-blue-100 text-blue-800",
  called: "bg-amber-100 text-amber-800",
  serving: "bg-indigo-100 text-indigo-800",
  served: "bg-green-100 text-green-800",
  no_show: "bg-gray-200 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
  // documents
  submitted: "bg-blue-100 text-blue-800",
  processing: "bg-amber-100 text-amber-800",
  ready: "bg-green-100 text-green-800",
  delivered: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-700",
  // issues
  reported: "bg-blue-100 text-blue-800",
  acknowledged: "bg-amber-100 text-amber-800",
  in_progress: "bg-indigo-100 text-indigo-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-200 text-gray-700",
  // priority
  low: "bg-gray-100 text-gray-700",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-amber-100 text-amber-800",
  urgent: "bg-red-100 text-red-700",
  // listing
  active: "bg-green-100 text-green-800",
  sold: "bg-gray-200 text-gray-700",
  expired: "bg-red-100 text-red-700",
};

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "fr", label: "Français", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
] as const;
