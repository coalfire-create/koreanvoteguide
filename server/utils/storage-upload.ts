// 업로드 이미지 저장 추상화.
//
// 운영: Supabase Storage(객체 스토리지)에 업로드 → 재배포에도 영속.
//   필요한 환경변수:
//     SUPABASE_URL                 예) https://xxxx.supabase.co
//     SUPABASE_SERVICE_ROLE_KEY    Supabase 대시보드 → Project Settings → API → service_role
//     SUPABASE_STORAGE_BUCKET      (선택) 기본값 "uploads" (public 버킷이어야 공개 URL 동작)
//
// 개발/미설정: 로컬 디스크(server/static/uploads)에 저장(휘발성) — fallback.

import fs from "fs/promises";
import path from "path";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "uploads";

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

const EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
};

export function extForMime(mime: string): string {
  return EXT_BY_MIME[mime] ?? ".jpg";
}

/**
 * 이미지 버퍼를 저장하고 공개적으로 접근 가능한 URL을 반환한다.
 * @param filename 확장자 포함 최종 파일명(예: "<hex>.jpg")
 */
export async function saveUploadedImage(
  filename: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  if (isSupabaseStorageConfigured()) {
    const objectPath = `community/${filename}`;
    const endpoint = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`;
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_KEY}`,
        apikey: SUPABASE_KEY as string,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "x-upsert": "true",
      },
      body: new Uint8Array(buffer),
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      throw new Error(`Supabase Storage 업로드 실패(${resp.status}): ${detail.slice(0, 200)}`);
    }
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`;
  }

  // ── Fallback: 로컬 디스크 (개발 또는 Supabase 미설정) ──
  const uploadDir = path.resolve(process.cwd(), "server/static/uploads");
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, filename), buffer);
  return `/uploads/${filename}`;
}
