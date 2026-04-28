import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, TrendingUp, Star, ChevronRight, User, Flame, Eye, ThumbsUp } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function Home() {
  const { data: trendingMembers, isLoading: isTrendingLoading } = useQuery<any[]>({
    queryKey: ["/api/members/trending"],
    queryFn: () => apiRequest("GET", "/api/members/trending").then((r) => r.json()),
  });

  const { data: bestPosts, isLoading: isPostsLoading } = useQuery<any[]>({
    queryKey: ["/api/community/posts", "best"],
    queryFn: () => apiRequest("GET", "/api/community/posts?sort=popular").then((r) => r.json()),
  });

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-[#425091] to-indigo-900 pt-14 pb-16 px-6 rounded-b-[3.5rem] shadow-xl text-white">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black mb-1">우리 동네의 목소리</h1>
            <p className="text-indigo-100/70 text-sm font-medium">유권자의 토론이 더 좋은 정치를 만듭니다.</p>
          </div>
          <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md">
            <Flame className="w-6 h-6 text-orange-400 fill-orange-400" />
          </div>
        </div>

        <Link href="/community">
          <Button className="w-full bg-white text-indigo-900 border-0 hover:bg-white/90 h-14 rounded-2xl font-black text-[16px] shadow-lg flex items-center justify-between px-6">
            커뮤니티 바로가기
            <ChevronRight className="w-5 h-5 text-indigo-400" />
          </Button>
        </Link>
      </div>

      <div className="max-w-lg mx-auto px-5 -mt-8 space-y-8 relative z-10">
        {/* Trending Politicians Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              지금 주목받는 인물
            </h2>
            <Link href="/members">
              <span className="text-xs font-bold text-indigo-600">더 보기</span>
            </Link>
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
            {isTrendingLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="w-24 h-32 rounded-2xl shrink-0" />
              ))
            ) : trendingMembers?.slice(0, 6).map((member) => (
              <Link key={member.id || member.monaCd} href={`/members/${member.id || member.monaCd}`}>
                <div className="w-24 shrink-0 snap-start flex flex-col items-center gap-2 group">
                  <div className="w-24 h-24 rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden shadow-sm group-hover:shadow-md transition-all">
                    {member.photoUrl ? (
                      <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-300">
                        <User className="w-10 h-10" />
                      </div>
                    )}
                  </div>
                  <span className="text-[13px] font-black text-slate-800 line-clamp-1">{member.name}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Best Posts Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              실시간 베스트 글
            </h2>
          </div>

          <div className="bg-slate-50 rounded-[2.5rem] p-2 space-y-1">
            {isPostsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="w-full h-20 rounded-2xl" />
              ))
            ) : bestPosts?.slice(0, 5).map((post) => (
              <Link key={post.id} href={`/community/${post.id}`}>
                <div className="bg-white p-5 rounded-[2rem] shadow-sm hover:shadow-md transition-all cursor-pointer group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {post.category}
                    </span>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold">
                      <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {post.likes}</span>
                      <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {post.commentCount}</span>
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-600">
                    {post.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
