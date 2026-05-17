import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PoliticianPhoto } from "@/components/PoliticianPhoto";

interface FollowedPolitician {
  id: string;
  name: string;
  party: string;
  district: string;
  photo: string | null;
  followedAt: string;
  lastActivityDate: string | null;
  hasRecentUpdate: boolean;
}

interface FollowsResponse {
  follows: FollowedPolitician[];
}

function StoryAvatar({ p }: { p: FollowedPolitician }) {
  return (
    <Link href={`/members/${p.id}`}>
      <div className="flex flex-col items-center gap-2 shrink-0 cursor-pointer group">
        <div className="relative">
          {/* 그라디언트 링 — 최근 3일 내 업데이트가 있을 때만 표시 */}
          <div
            className={
              p.hasRecentUpdate
                ? "p-[2.5px] rounded-full bg-gradient-to-tr from-fuchsia-500 via-rose-500 to-amber-400 shadow-[0_4px_20px_-4px_rgba(244,63,94,0.45)]"
                : "p-[2.5px] rounded-full bg-muted"
            }
          >
            <div className="p-[2px] rounded-full bg-card">
              <div className="w-[68px] h-[68px] rounded-full overflow-hidden bg-muted transition-transform group-hover:scale-[1.04]">
                <PoliticianPhoto
                  name={p.name}
                  monaCd={p.id}
                  photo={p.photo ?? undefined}
                  avatarClassName="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-lg font-bold"
                />
              </div>
            </div>
          </div>
          {p.hasRecentUpdate && (
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 ring-[3px] ring-background" />
          )}
        </div>
        <span className="text-[11px] font-semibold text-foreground tracking-tight max-w-[72px] truncate">
          {p.name}
        </span>
      </div>
    </Link>
  );
}

function AddTile() {
  return (
    <Link href="/members">
      <div className="flex flex-col items-center gap-2 shrink-0 cursor-pointer group">
        <div className="p-[2.5px] rounded-full bg-muted">
          <div className="p-[2px] rounded-full bg-card">
            <div className="w-[68px] h-[68px] rounded-full border-2 border-dashed border-border flex items-center justify-center text-muted-foreground group-hover:border-primary group-hover:text-primary transition-colors">
              <Plus className="w-7 h-7 stroke-[1.5]" />
            </div>
          </div>
        </div>
        <span className="text-[11px] font-semibold text-muted-foreground">추가</span>
      </div>
    </Link>
  );
}

function SkeletonTile() {
  return (
    <div className="flex flex-col items-center gap-2 shrink-0">
      <div className="w-[78px] h-[78px] rounded-full bg-muted animate-pulse" />
      <div className="w-10 h-2.5 rounded bg-muted animate-pulse" />
    </div>
  );
}

export function StoryFeed({ className = "" }: { className?: string }) {
  const { user } = useAuth();

  const { data, isLoading } = useQuery<FollowsResponse>({
    queryKey: ["/api/users/me/follows"],
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  // 비로그인 — 가입 유도 제거 (사용자 요청)
  if (!user) {
    return null;
  }

  const follows = data?.follows ?? [];
  const hasUpdates = follows.some((f) => f.hasRecentUpdate);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`px-5 pt-3 ${className}`}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-[13px] font-bold text-foreground tracking-tight flex items-center gap-1.5">
          관심 의원
          {hasUpdates && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded-full">
              <span className="w-1 h-1 rounded-full bg-rose-500 animate-pulse" />
              NEW
            </span>
          )}
        </h3>
        {follows.length > 0 && (
          <Link href="/more">
            <span className="text-[11px] font-semibold text-muted-foreground hover:text-primary cursor-pointer">
              전체보기
            </span>
          </Link>
        )}
      </div>

      <div className="flex items-start gap-4 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
        {isLoading ? (
          <>
            <SkeletonTile />
            <SkeletonTile />
            <SkeletonTile />
            <SkeletonTile />
          </>
        ) : follows.length === 0 ? (
          <>
            <AddTile />
            <div className="flex-1 min-w-0 self-center">
              <p className="text-[12px] text-muted-foreground leading-snug">
                관심 의원을 팔로우하면<br />여기에서 활동을 바로 확인할 수 있어요.
              </p>
            </div>
          </>
        ) : (
          <>
            {follows.map((p) => (
              <StoryAvatar key={p.id} p={p} />
            ))}
            <AddTile />
          </>
        )}
      </div>
    </motion.section>
  );
}

export default StoryFeed;
