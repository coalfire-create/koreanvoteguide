import { useState } from "react";
import { POLITICIAN_PHOTOS } from "@/lib/politician-photos";

export interface PoliticianPhotoProps {
  name: string;
  photo?: string | null;
  resolvedUrl?: string | null; // pre-fetched from /api/politician-photos/batch
  monaCd?: string | null;
  size?: number;
  className?: string;       // extra classes applied to the <img>
  avatarClassName?: string; // classes for the fallback/background avatar div
  lazy?: boolean;
}

export function PoliticianPhoto({
  name, photo, resolvedUrl, monaCd, size,
  className, avatarClassName, lazy = true,
}: PoliticianPhotoProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Source priority: explicit prop > batch-resolved > hardcoded Wikipedia map > dynamic API fallback
  const hardcoded = POLITICIAN_PHOTOS[name] ?? null;
  const assemblyProxy = monaCd && /^\d+$/.test(monaCd) ? `/api/photo/assembly/${monaCd}` : null;
  const dynamicFallback = `/api/politician-photo?name=${encodeURIComponent(name)}${monaCd ? `&monaCd=${monaCd}` : ""}`;
  const src = imgError ? null : (photo || resolvedUrl || hardcoded || assemblyProxy || dynamicFallback);

  const sizeStyle = size ? { width: size, height: size } : undefined;

  return (
    <div className="relative w-full h-full" style={sizeStyle}>
      {/* Avatar: always visible as base layer — no network request needed */}
      <div
        className={`absolute inset-0 flex items-center justify-center select-none ${
          avatarClassName ?? "bg-gray-200 text-gray-500 font-black text-xl"
        }`}
      >
        {name.charAt(0)}
      </div>

      {/* Photo: loads lazily, fades in over the avatar once ready */}
      {src && (
        <img
          src={src}
          alt={name}
          loading={lazy ? "lazy" : "eager"}
          decoding="async"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
          className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-300 ${
            imgLoaded ? "opacity-100" : "opacity-0"
          } ${className ?? ""}`}
        />
      )}
    </div>
  );
}
