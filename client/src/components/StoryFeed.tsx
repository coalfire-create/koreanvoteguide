import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, ExternalLink, Newspaper } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PoliticianPhoto } from "@/components/PoliticianPhoto";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface StoryNewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

interface Story {
  id: string;
  name: string;
  party: string;
  photo: string | null;
  hasNews: boolean;
  newsItems: StoryNewsItem[];
}

interface StoriesResponse {
  stories: Story[];
}

function formatRelativeTime(pubDate: string): string {
  const diff = Date.now() - new Date(pubDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

function StorySheet({ story, onClose }: { story: Story; onClose: () => void }) {
  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-[2rem] px-0 pb-8 max-h-[80vh] overflow-y-auto">
        <SheetHeader className="px-6 pt-2 pb-4 border-b border-border/40">
          <div className="flex items-center gap-4">
            <div className="w-[60px] h-[60px] rounded-full overflow-hidden bg-muted shrink-0">
              <PoliticianPhoto
                name={story.name}
                monaCd={story.id}
                photo={story.photo}
                context={story.party || undefined}
                lazy={false}
              />
            </div>
            <div>
              <SheetTitle className="text-[17px] font-bold leading-tight">{story.name}</SheetTitle>
              <p className="text-[13px] text-muted-foreground mt-0.5">{story.party}</p>
            </div>
          </div>
        </SheetHeader>

        <div className="px-6 pt-4">
          {story.newsItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              <Newspaper className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-[14px] text-muted-foreground">최근 48시간 내 관련 뉴스가 없습니다.</p>
              <Link href={`/members/${story.id}`}>
                <span className="text-[13px] font-semibold text-primary underline underline-offset-2 cursor-pointer">
                  의원 상세 보기
                </span>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                최근 공개 활동
              </p>
              {story.newsItems.map((item, i) => (
                <a
                  key={i}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 py-3 px-3 rounded-xl hover:bg-muted/60 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[11px] font-semibold text-muted-foreground">{item.source}</span>
                      <span className="text-muted-foreground/40 text-[10px]">·</span>
                      <span className="text-[11px] text-muted-foreground">{formatRelativeTime(item.pubDate)}</span>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                </a>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StoryAvatar({ story, onTap }: { story: Story; onTap: () => void }) {
  return (
    <button
      onClick={onTap}
      className="flex flex-col items-center gap-2 shrink-0 cursor-pointer group"
    >
      <div className="relative">
        <div
          className={
            story.hasNews
              ? "p-[2.5px] rounded-full bg-gradient-to-tr from-fuchsia-500 via-rose-500 to-amber-400 shadow-[0_4px_20px_-4px_rgba(244,63,94,0.45)]"
              : "p-[2.5px] rounded-full bg-muted"
          }
        >
          <div className="p-[2px] rounded-full bg-card">
            <div className="w-[68px] h-[68px] rounded-full overflow-hidden bg-muted transition-transform group-hover:scale-[1.04]">
              <PoliticianPhoto
                name={story.name}
                monaCd={story.id}
                photo={story.photo}
                context={story.party || undefined}
                avatarClassName="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-lg font-bold"
              />
            </div>
          </div>
        </div>
        {story.hasNews && (
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 ring-[3px] ring-background" />
        )}
      </div>
      <span className="text-[11px] font-semibold text-foreground tracking-tight max-w-[72px] truncate">
        {story.name}
      </span>
    </button>
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
  const [activeStory, setActiveStory] = useState<Story | null>(null);

  const { data, isLoading } = useQuery<StoriesResponse>({
    queryKey: ["/api/feed/stories"],
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  if (!user) return null;

  const stories = data?.stories ?? [];
  const hasNews = stories.some((s) => s.hasNews);

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className={`px-5 pt-3 ${className}`}
      >
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-[13px] font-bold text-foreground tracking-tight flex items-center gap-1.5">
            관심 의원
            {hasNews && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded-full">
                <span className="w-1 h-1 rounded-full bg-rose-500 animate-pulse" />
                NEW
              </span>
            )}
          </h3>
          {stories.length > 0 && (
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
          ) : stories.length === 0 ? (
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
              {stories.map((s) => (
                <StoryAvatar key={s.id} story={s} onTap={() => setActiveStory(s)} />
              ))}
              <AddTile />
            </>
          )}
        </div>
      </motion.section>

      {activeStory && (
        <StorySheet story={activeStory} onClose={() => setActiveStory(null)} />
      )}
    </>
  );
}

export default StoryFeed;
