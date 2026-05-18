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

  // Source priority: hardcoded override > explicit prop > batch-resolved > server-side fallback.
  // 하드코딩이 가장 우선 — DB(legislators.photoUrl)에 잘못된 사진이 들어가도(동명이인 등) 손으로 박은 정답이 이김.
  // 하드코딩에 없는 이름은 자연스럽게 기존 우선순위(photo prop → resolvedUrl → server fallback)로 fall through.
  const sources = useMemo(() => {
    const hardcoded = POLITICIAN_PHOTOS[name] ?? null;
    const ctxParam = context ? `&context=${encodeURIComponent(context)}` : (monaCd ? "" : "");
    const dynamicFallback = `/api/politician-photo?name=${encodeURIComponent(name)}${monaCd ? `&monaCd=${monaCd}` : ""}${ctxParam}`;
    return [hardcoded, photo, resolvedUrl, dynamicFallback].filter(Boolean) as string[];
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
