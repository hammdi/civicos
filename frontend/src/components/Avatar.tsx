import { useState } from "react";
import { avatarFor } from "../lib/images";

interface Props {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}

/** Round avatar: shows the given image, or falls back to a DiceBear initials
 *  avatar, and finally to text initials if even that fails to load. */
export default function Avatar({ name, src, size = 40, className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (failed) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-full bg-navy text-white font-semibold ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
        aria-label={name}
      >
        {initials || "?"}
      </div>
    );
  }

  return (
    <img
      src={src || avatarFor(name)}
      alt={name}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`rounded-full bg-navy-50 object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
