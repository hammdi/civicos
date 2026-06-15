// Image helpers. All meaningful, with reliable fallbacks so a flaky network
// never leaves a broken image — <SmartImage> swaps to these placeholders.

export const HERO_ILLUSTRATION = "/illustrations/hero.svg";

const ACCENTS: Record<string, string> = {
  queue: "2563EB",
  documents: "EA8A0B",
  market: "27AE60",
  reports: "E74C3C",
  food: "27AE60",
  clothing: "8E44AD",
  electronics: "2563EB",
  furniture: "B7791F",
  services: "0E7490",
  crafts: "D946A0",
  other: "64748B",
};

/** A deterministic, friendly avatar from a name (DiceBear initials, no key). */
export function avatarFor(name: string | null | undefined, color = "1B4F72"): string {
  const seed = encodeURIComponent((name || "Citizen").trim() || "Citizen");
  return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=${color}`;
}

/** A branded inline-SVG placeholder (data URI) — used as the image fallback. */
export function placeholderImage(label = "CivicOS", key = "other"): string {
  const color = ACCENTS[key] || "1B4F72";
  const text = label.slice(0, 18);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='480'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='#${color}'/><stop offset='1' stop-color='#1B4F72'/>
    </linearGradient></defs>
    <rect width='640' height='480' fill='url(#g)'/>
    <text x='50%' y='50%' fill='#ffffff' fill-opacity='0.9' font-family='Inter,sans-serif'
      font-size='30' font-weight='700' text-anchor='middle' dominant-baseline='middle'>${text}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** First usable photo of a listing/issue, or a themed placeholder. */
export function firstPhoto(photos: string[] | undefined, label: string, key = "other"): string {
  if (photos && photos.length && photos[0]) return photos[0];
  return placeholderImage(label, key);
}
