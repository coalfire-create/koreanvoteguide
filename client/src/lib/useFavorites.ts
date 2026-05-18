import { useState, useEffect, useCallback } from "react";
import { favoritePoliticianSchema, type FavoritePolitician } from "@shared/schema";

// "userRegions" / "userRegion" 키와 분리된 독립 키 사용
const STORAGE_KEY = "favoritePoliticians";

export type { FavoritePolitician };
export type FavoritePerson = FavoritePolitician;

function readFromStorage(): FavoritePolitician[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item: unknown) => {
      const result = favoritePoliticianSchema.safeParse(item);
      return result.success ? [result.data] : [];
    });
  } catch {
    return [];
  }
}

function writeToStorage(favorites: FavoritePerson[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    // 저장 실패 시 (private 모드 등) 조용히 무시
  }
}

/**
 * 즐겨찾기 정치인 관리 훅
 *
 * @example
 * const { favorites, addFavorite, removeFavorite, isFavorite } = useFavorites();
 *
 * isFavorite(member.id)              // boolean
 * addFavorite({ id, name, type, imageUrl? })
 * removeFavorite(member.id)
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoritePerson[]>(() =>
    readFromStorage()
  );

  // 다른 탭/창에서 localStorage가 변경됐을 때 동기화
  useEffect(() => {
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setFavorites(readFromStorage());
      }
    };
    window.addEventListener("storage", handleStorageEvent);
    return () => window.removeEventListener("storage", handleStorageEvent);
  }, []);

  /** 즐겨찾기 추가 — 이미 존재하면 중복 추가 안 함 */
  const addFavorite = useCallback((person: FavoritePerson) => {
    setFavorites((prev) => {
      if (prev.some((f) => f.id === person.id)) return prev;
      const next = [...prev, person];
      writeToStorage(next);
      return next;
    });
  }, []);

  /** 즐겨찾기 제거 */
  const removeFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.filter((f) => f.id !== id);
      writeToStorage(next);
      return next;
    });
  }, []);

  /** 즐겨찾기 여부 확인 */
  const isFavorite = useCallback(
    (id: string): boolean => favorites.some((f) => f.id === id),
    [favorites]
  );

  return { favorites, addFavorite, removeFavorite, isFavorite };
}
