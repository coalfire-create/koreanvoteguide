import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Megaphone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Announcement } from "@shared/schema";

const SEEN_KEY = "announcement_seen_ids";

function getSeenIds(): Set<number> {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

function markSeen(id: number) {
  const seen = getSeenIds();
  seen.add(id);
  sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
}

export function AnnouncementBanner() {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<Announcement | null>(null);

  const { data } = useQuery<Announcement | null>({
    queryKey: ["/api/announcements/active"],
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!data) return;
    const seen = getSeenIds();
    if (seen.has(data.id)) return;
    setCurrent(data);
    setVisible(true);

    const timer = setTimeout(() => {
      setVisible(false);
      markSeen(data.id);
    }, 10000);

    return () => clearTimeout(timer);
  }, [data]);

  function dismiss() {
    setVisible(false);
    if (current) markSeen(current.id);
  }

  return (
    <AnimatePresence>
      {visible && current && (
        <motion.div
          key={current.id}
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed top-0 left-0 right-0 z-[9999] flex items-start gap-3 px-4 py-3 bg-primary text-primary-foreground shadow-lg"
          style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))" }}
        >
          <Megaphone className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight">{current.title}</p>
            {current.content && (
              <p className="text-xs mt-0.5 opacity-90 line-clamp-2">{current.content}</p>
            )}
          </div>
          <button
            onClick={dismiss}
            className="shrink-0 p-1 rounded-full hover:bg-white/20 transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
