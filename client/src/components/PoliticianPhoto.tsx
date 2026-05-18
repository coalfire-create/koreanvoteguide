import { useState, useMemo, useEffect, useRef } from "react";
import { POLITICIAN_PHOTOS } from "@/lib/politician-photos";
import { Skeleton } from "@/components/ui/skeleton";

export interface PoliticianPhotoProps {
  name: string;
  photo?: string | null;
  resolvedUrl?: string | null; // pre-fetched from /api/politician-photos/batch
  monaCd?: string | null;
  context?: string | null;     // disambiguation hint (e.g. "국민의힘") for the fallback API
  size?: number;
  className?: string;       // extra classes applied to the <img>
  avatarClassName?: string; // classes for the fallback/background avatar div
  lazy?: boolean;
}

export function PoliticianPhoto({
  name, photo, resolvedUrl, monaCd, context, size,
  className, avatarClassName, lazy = true,
}: PoliticianPhotoProps) {
  const [srcIndex, setSrcIndex] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Source priority: hardcoded override > assembly official (monaCd) > explicit prop > batch-resolved > name-based fallback.
  // monaCd 기반 공식 국회 사진이 두 번째 — 동명이인이 있어도 monaCd는 유일하므로 항상 본인 사진.
  // DB(photo prop)나 name 검색(동명이인 위험)보다 앞에 위치.
  const sources = useMemo(() => {
    const hardcoded = POLITICIAN_PHOTOS[name] ?? null;
    const assemblyPhoto = monaCd ? `/api/photo/assembly/${monaCd}` : null;
    const ctxParam = context ? `&context=${encodeURIComponent(context)}` : "";
    const dynamicFallback = `/api/politician-photo?name=${encodeURIComponent(name)}${monaCd ? `&monaCd=${monaCd}` : ""}${ctxParam}`;
    return [hardcoded, assemblyPhoto, photo, resolvedUrl, dynamicFallback].filter(Boolean) as string[];
  }, [photo, resolvedUrl, name, monaCd, context]);

  // sources[0]이 바뀌면 (새 URL이 추가되면) srcIndex 리셋 — 이전에 실패한 인덱스로 고정되는 버그 방지.
  const prevFirst = useRef(sources[0]);
  useEffect(() => {
    if (prevFirst.current !== sources[0]) {
      prevFirst.current = sources[0];
      setSrcIndex(0);
      setImgLoaded(false);
    }
  }, [sources]);

  const src = srcIndex < sources.length ? sources[srcIndex] : null;
  const sizeStyle = size ? { width: size, height: size } : undefined;

  const handleLoad = () => setImgLoaded(true);
  const handleError = () => {
    setImgLoaded(false);
    setSrcIndex((prev) => prev + 1);
  };

  return (
    <div className="relative w-full h-full overflow-hidden group" style={sizeStyle}>
      {/* Layer 1 — Avatar: always visible as the bottom fallback */}
      <div
        className={`absolute inset-0 flex items-center justify-center select-none bg-gradient-to-br from-gray-100 to-gray-200 ${
          avatarClassName ?? "text-gray-400 font-black text-xl"
        }`}
      >
        <span className="opacity-40">{name.charAt(0)}</span>
      </div>

      {/* Layer 2 — Skeleton: shimmer while the photo is in-flight */}
      {src && !imgLoaded && (
        <Skeleton className="absolute inset-0 w-full h-full rounded-none" />
      )}

      {/* Layer 3 — Photo: fades in smoothly once loaded; on error tries next source */}
      {src && (
        <>
          <img
            key={src}
            src={src}
            alt={name}
            loading={lazy ? "lazy" : "eager"}
            decoding="async"
            onLoad={handleLoad}
            onError={handleError}
            className={`absolute inset-0 w-full h-full object-cover object-top transition-all duration-700 ease-in-out group-hover:scale-110 ${
              imgLoaded ? "opacity-100" : "opacity-0"
            } ${className ?? ""}`}
          />
          {/* Layer 4 — Gradient Overlay for depth */}
          {imgLoaded && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none opacity-60 transition-opacity group-hover:opacity-40" />
          )}
        </>
      )}
    </div>
  );
}
