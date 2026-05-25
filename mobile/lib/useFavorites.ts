import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { z } from "zod";

const favoritePoliticianSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["member", "candidate"]),
  imageUrl: z.string().optional().nullable(),
  party: z.string().optional().nullable(),
});

export type FavoritePolitician = z.infer<typeof favoritePoliticianSchema>;
export type FavoritePerson = FavoritePolitician;

const STORAGE_KEY = "favoritePoliticians";

async function readFromStorage(): Promise<FavoritePolitician[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
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

async function writeToStorage(favorites: FavoritePerson[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    // 저장 실패 시 조용히 무시
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoritePerson[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    readFromStorage().then((data) => {
      setFavorites(data);
      setLoaded(true);
    });
  }, []);

  const addFavorite = useCallback((person: FavoritePerson) => {
    setFavorites((prev) => {
      if (prev.some((f) => f.id === person.id)) return prev;
      const next = [...prev, person];
      writeToStorage(next);
      return next;
    });
  }, []);

  const removeFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.filter((f) => f.id !== id);
      writeToStorage(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (id: string): boolean => favorites.some((f) => f.id === id),
    [favorites]
  );

  return { favorites, addFavorite, removeFavorite, isFavorite, loaded };
}
