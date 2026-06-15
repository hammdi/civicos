import { useState } from "react";
import { placeholderImage } from "../lib/images";

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /** Label + accent key for the fallback placeholder. */
  fallbackLabel?: string;
  fallbackKey?: string;
}

/** An <img> that degrades gracefully to a branded placeholder on error. */
export default function SmartImage({ src, alt, fallbackLabel, fallbackKey, ...rest }: Props) {
  const [failed, setFailed] = useState(false);
  const finalSrc = failed ? placeholderImage(fallbackLabel ?? alt, fallbackKey) : src;
  return (
    <img
      src={finalSrc}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      {...rest}
    />
  );
}
