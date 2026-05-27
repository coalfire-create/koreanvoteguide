import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Bell, Calendar, MessageSquare, Flame, ChevronRight, CheckCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

interface ScheduleItem {
  id: number;
  title: string;
  eventDate: string;
  description: string | null;
  region: string;
}

function calculateDDay(iso: string): number {
  const target = new Date(iso);
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const t1 = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.round((t1 - t0) / (1000 * 60 * 60 * 24));
}

function formatDDayLabel(days: number): string {
  if (days === 0) return "D-DAY";
  if (days > 0) return `D-${days}`;
  return `D+${Math.abs(days)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

const STORAGE_KEY = "notification_read_at";

function getReadAt(): number {
  return parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10);
}

function markAllRead() {
  localStorage.setItem(STORAGE_KEY, String(Date.now()));
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NotificationPanel({ open, onClose }: Props) {
  const { data: schedules } = useQuery<ScheduleItem[]>({
    queryKey: ["/api/schedules"],
    queryFn: () => fetch("/api/schedules", { credentials: "include" }).then((r) => r.json()),
    staleTime: 10 * 60 * 1000,
    enabled: open,
  });

  const { data: hotPostsRaw } = useQuery<{ id: string; title: string; likes: number }[]>({
    queryKey: ["/api/community/top-liked"],
    queryFn: () => apiRequest("GET", "/api/community/top-liked").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  const { data: hotBillsRaw } = useQuery<any[]>({
    queryKey: ["/api/bills/hot"],
    queryFn: () => apiRequest("GET", "/api/bills/hot").then((r) => r.json()),
    staleTime: 10 * 60 * 1000,
    enabled: open,
  });

  const [readAt] = useState(getReadAt);

  useEffect(() => {
    if (open) {
      // mark all read after a short delay so unread state is visible briefly
      const t = setTimeout(markAllRead, 800);
      return () => clearTimeout(t);
    }
  }, [open]);

  const upcomingSchedules = (schedules ?? [])
    .filter((s) => calculateDDay(s.eventDate) >= 0)
    .slice(0, 4);

  const hotPosts = (hotPostsRaw ?? []).slice(0, 3);
  const hotBills = (hotBillsRaw ?? []).slice(0, 2);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Bottom Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[70] bg-[#F2F2F7] dark:bg-[#1C1C1E] rounded-t-[28px] flex flex-col"
            style={{ maxHeight: "85vh" }}
          >
            {/* Handle */}
            <div className="flex-shrink-0 flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-black/20 dark:bg-white/20 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 pb-3 pt-2">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                <h2 className="text-[18px] font-bold text-foreground">알림</h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center active:opacity-70"
              >
                <X className="w-4 h-4 text-foreground" />
              </button>
            </div>

            {/* Content */}
            <div
              className="flex-1 min-h-0 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]"
              style={{ overscrollBehavior: "contain" }}
            >

              {/* 선거 D-day 섹션 */}
              {upcomingSchedules.length > 0 && (
                <section className="mb-4">
                  <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider px-1 mb-2">선거 일정</p>
                  <div className="bg-white dark:bg-[#2C2C2E] rounded-2xl shadow-sm overflow-hidden">
                    {upcomingSchedules.map((s, idx) => {
                      const days = calculateDDay(s.eventDate);
                      const isUrgent = days <= 7;
                      return (
                        <div key={s.id}>
                          <div className="px-4 py-3.5 flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isUrgent ? "bg-red-500/10" : "bg-primary/10"}`}>
                              <Calendar className={`w-4.5 h-4.5 ${isUrgent ? "text-red-500" : "text-primary"}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-semibold text-foreground line-clamp-1">{s.title}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(s.eventDate)}</p>
                            </div>
                            <span className={`text-[12px] font-black shrink-0 ${isUrgent ? "text-red-500" : "text-primary"}`}>
                              {formatDDayLabel(days)}
                            </span>
                          </div>
                          {idx < upcomingSchedules.length - 1 && (
                            <div className="h-px bg-black/5 dark:bg-white/10 ml-[60px]" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* 인기 토론 */}
              {hotPosts.length > 0 && (
                <section className="mb-4">
                  <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider px-1 mb-2">지금 인기 토론</p>
                  <div className="bg-white dark:bg-[#2C2C2E] rounded-2xl shadow-sm overflow-hidden">
                    {hotPosts.map((post, idx) => (
                      <div key={post.id}>
                        <Link href={`/community/${post.id}`} onClick={onClose}>
                          <div className="px-4 py-3.5 flex items-center gap-3 active:opacity-70 cursor-pointer">
                            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                              <MessageSquare className="w-4.5 h-4.5 text-rose-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-semibold text-foreground line-clamp-1">{post.title}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">공감 {post.likes}개 · 지금 토론 중</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                          </div>
                        </Link>
                        {idx < hotPosts.length - 1 && (
                          <div className="h-px bg-black/5 dark:bg-white/10 ml-[60px]" />
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 인기 법안 */}
              {hotBills.length > 0 && (
                <section className="mb-4">
                  <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider px-1 mb-2">뉴스에서 주목받는 법안</p>
                  <div className="bg-white dark:bg-[#2C2C2E] rounded-2xl shadow-sm overflow-hidden">
                    {hotBills.map((bill: any, idx) => (
                      <div key={bill.billId}>
                        <div className="px-4 py-3.5 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                            <Flame className="w-4.5 h-4.5 text-orange-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-semibold text-foreground line-clamp-1">{bill.billName}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              뉴스 {bill.newsMentionCount ?? bill.mediaMentionCount ?? 0}건 언급
                            </p>
                          </div>
                        </div>
                        {idx < hotBills.length - 1 && (
                          <div className="h-px bg-black/5 dark:bg-white/10 ml-[60px]" />
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 빈 상태 */}
              {upcomingSchedules.length === 0 && hotPosts.length === 0 && hotBills.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <div className="w-14 h-14 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center">
                    <CheckCheck className="w-6 h-6" />
                  </div>
                  <p className="text-[14px] font-semibold">새 알림이 없습니다</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** 읽지 않은 알림이 있는지 여부 (마지막 읽은 시간 기준 24시간) */
export function useHasUnread(): boolean {
  const readAt = getReadAt();
  // 한 번도 열지 않았거나 24시간 이상 지났으면 unread
  return readAt === 0 || Date.now() - readAt > 24 * 60 * 60 * 1000;
}
