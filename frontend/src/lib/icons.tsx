import {
  Ticket,
  FileText,
  ShoppingBag,
  MapPin,
  type LucideIcon,
} from "lucide-react";

// Each module's meaningful icon (replaces the old emoji).
export const MODULE_ICONS: Record<"queue" | "documents" | "market" | "reports", LucideIcon> = {
  queue: Ticket,
  documents: FileText,
  market: ShoppingBag,
  reports: MapPin,
};

// Lucide icon name per market category (used on listing cards).
export const CATEGORY_ICON: Record<string, string> = {
  food: "Apple",
  clothing: "Shirt",
  electronics: "Smartphone",
  furniture: "Sofa",
  services: "Wrench",
  crafts: "Palette",
  other: "Package",
};
