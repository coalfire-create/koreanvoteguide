import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Heart, MessageCircle, Share2, Sparkles, FileText, Vote, MoreHorizontal } from "lucide-react";
import { PoliticianPhoto } from "@/components/PoliticianPhoto";

export interface FeedItem {
  type: "bill" | "vote";
  id: string;
  politicianId: string;
  politicianName: string;
  party: string | null;
  photo: string | null;
  title: string;
  summary?: string;
  subtitle: string;
  billId?: string;
  voteResult?: string;
  occurredAt: string;
  isRecommended: boolean;
}

const partyColor = (party: string | null) => {
  if (!party) return "text-gray-500 bg-gray-50";
  if (party.includes("더불어민주당")) return "text-[#3A6BFF] bg-blue-50";
  if (party.includes("국민의힘")) return "text-[#FF3B3B] bg-red-50";
  if (party.includes("조국혁신당")) return "text-blue-800 bg-blue-50";
  if (party.includes("개혁신당")) return "text-[#FF8C00] bg-orange-50";
  if (party.includes("진보당")) return "text-[#D60024] bg-red-50";
  if (party.includes("무소속")) return "text-gray-500 bg-gray-50";
  return "text-gray-600 bg-gray-50";
};

// "2026-05-12" or ISO → "2시간 전" / "3일 전" / "5월 12일"
function timeAgo(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso.length === 8 ? `${iso.slice(0, 4)}-${iso.slice(4, 6)}-${iso.slice(6, 8)}` : iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffMs = Date.now() - date.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function VoteBadge({ result }: { result: string }) {
  const cls = result.includes("찬")
    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
    : result.includes("반")
      ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
      : "bg-muted text-muted-foreground border-border/30";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${cls}`}>
      <Vote className="w-3 h-3" /> {result}
    </span>
  );
}

export function FeedCard({ item }: { item: FeedItem }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(() => Math.floor(Math.random() * 80) + 12);
  const [commentCount] = useState(() => Math.floor(Math.random() * 30) + 2);

  const partyCls = partyColor(item.party);
  const isBill = item.type === "bill";

  const handleLike = () => {
    setLiked((prev) => {
      setLikeCount((c) => c + (prev ? -1 : 1));
      return !prev;
    });
  };

  const handleShare = async () => {
    const url = `${window.location.origin}${isBill && item.billId ? `/bills?id=${item.billId}` : `/members/${item.politicianId}`}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-card rounded-2xl border border-border/30 shadow-[0_2px_12px_rgb(0,0,0,0.03)] overflow-hidden text-foreground"
    >
      {/* === Header: avatar + name + party + time === */}
      <header className="flex items-center gap-3 px-5 pt-4 pb-3">
        <Link href={`/members/${item.politicianId}`}>
          <div className="relative cursor-pointer shrink-0">
            <div className="p-[2px] rounded-full bg-gradient-to-tr from-fuchsia-400 via-rose-400 to-amber-300">
              <div className="p-[1.5px] rounded-full bg-card">
                <div className="w-11 h-11 rounded-full overflow-hidden bg-muted">
                  <PoliticianPhoto
                    name={item.politicianName}
                    monaCd={item.politicianId}
                    photo={item.photo ?? undefined}
                    context={item.party ?? undefined}
                    avatarClassName="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-base font-bold"
                  />
                </div>
              </div>
            </div>
          </div>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link href={`/members/${item.politicianId}`}>
              <span className="text-[14px] font-bold text-foreground hover:text-primary cursor-pointer truncate">
                {item.politicianName}
              </span>
            </Link>
            {item.party && (
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${partyCls}`}>
                {item.party}
              </span>
            )}
            {item.isRecommended && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-black px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="w-2.5 h-2.5" />
                추천
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
            {timeAgo(item.occurredAt)} · {item.subtitle}
          </p>
        </div>

        <button className="text-muted-foreground hover:text-foreground transition-colors p-1" aria-label="더보기">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </header>

      {/* === Body: content === */}
      <div className="px-5 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md ${
            isBill ? "bg-primary/10 text-primary" : "bg-emerald-500/10 text-emerald-500"
          }`}>
            {isBill ? <FileText className="w-3 h-3" /> : <Vote className="w-3 h-3" />}
            {isBill ? "법안 발의" : "표결"}
          </span>
          {!isBill && item.voteResult && <VoteBadge result={item.voteResult} />}
        </div>

        <h3 className="text-[15px] font-bold text-foreground leading-snug mb-1.5 line-clamp-2">
          {item.title}
        </h3>
        {item.summary && item.summary !== item.title && (
          <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-3">
            {item.summary}
          </p>
        )}
      </div>

      {/* === Footer: action bar === */}
      <footer className="px-5 py-3 border-t border-border/30 flex items-center gap-1">
        <button
          onClick={handleLike}
          aria-pressed={liked}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors ${
            liked ? "text-rose-500" : "text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
          }`}
        >
          <Heart className={`w-5 h-5 transition-transform ${liked ? "fill-rose-500 scale-110" : ""}`} />
          <span className="text-[12px] font-bold tabular-nums">{likeCount}</span>
        </button>

        <Link href={isBill && item.billId ? `/bills?id=${item.billId}` : `/members/${item.politicianId}`}>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
            <MessageCircle className="w-5 h-5" />
            <span className="text-[12px] font-bold tabular-nums">{commentCount}</span>
          </button>
        </Link>

        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors ml-auto"
          aria-label="공유"
        >
          <Share2 className="w-5 h-5" />
        </button>
      </footer>
    </motion.article>
  );
}

export default FeedCard;
