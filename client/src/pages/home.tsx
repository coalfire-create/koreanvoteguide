import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, Bell, Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Plus, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PoliticianPhoto } from "@/components/PoliticianPhoto";
import { LoginPrompt } from "@/components/LoginPrompt";
import { useAuth } from "@/lib/auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAssemblyMembers } from "@/lib/api-data";
import type { AssemblyBill } from "@shared/schema";

export default function Home() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const { members, isLoading: isMembersLoading } = useAssemblyMembers();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: billsData, isLoading: isBillsLoading } = useQuery<AssemblyBill[]>({
    queryKey: ["/api/bills"],
    queryFn: async () => {
      const res = await fetch(`/api/bills`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    },
  });

  const followMutation = useMutation({
    mutationFn: async (legislatorId: string) => {
      if (!user) return;
      const isFollowed = user.favorites.includes(legislatorId);
      const newFavorites = isFollowed 
        ? user.favorites.filter(id => id !== legislatorId)
        : [...user.favorites, legislatorId];
      
      const res = await apiRequest("PATCH", "/api/auth/favorites", { favorites: newFavorites });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const followedIds = user?.favorites || [];

  const { followedMembersList, recommendedMembers, storyMembers } = useMemo(() => {
    const followed = members.filter(m => followedIds.includes(m.id));
    const others = members.filter(m => !followedIds.includes(m.id));
    return {
      followedMembersList: followed,
      recommendedMembers: others.slice(0, 5),
      storyMembers: followed.length > 0 ? followed : members.slice(0, 10),
    };
  }, [members, followedIds.join(",")]);

  const finalBills = useMemo(() => {
    if (!billsData) return [];
    if (followedMembersList.length === 0) return billsData;
    const followedSet = new Set(followedIds);
    const proposerToId = new Map(members.map(m => [m.name, m.id]));
    const filtered = billsData.filter(b => followedSet.has(proposerToId.get(b.proposer ?? "") ?? ""));
    return filtered.length > 0 ? filtered : billsData;
  }, [billsData, followedMembersList.length, followedIds.join(","), members]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-md border-b border-border/40 pt-[env(safe-area-inset-top)]">
        <div className="h-[60px] sm:h-[72px] flex items-center px-4 sm:px-8">
        <div className="flex-1 flex items-center">
          <div className="relative w-full max-w-[500px] group">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              className="w-full h-9 sm:h-10 pl-9 sm:pl-11 pr-4 sm:pr-12 bg-muted border border-border/30 rounded-xl text-[14px] focus:bg-background focus:border-primary/30 outline-none transition-all placeholder:text-muted-foreground font-medium text-foreground"
              placeholder="국회의원 이름으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 px-1.5 py-0.5 bg-background border border-border/30 rounded shadow-sm">
              <span className="text-[10px] font-bold text-muted-foreground">⌘K</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 text-muted-foreground hover:text-foreground transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-background"></span>
          </button>
          {user ? (
            <Link href="/more">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-black text-xs cursor-pointer shadow-sm ring-2 ring-transparent hover:ring-primary/20 transition-all">
                {user.name.charAt(0)}
              </div>
            </Link>
          ) : (
            <Link href="/login">
              <button className="text-[13px] font-black text-primary hover:underline px-2 py-1">로그인</button>
            </Link>
          )}
        </div>
        </div>
      </header>

      <div className="flex-1 flex w-full max-w-[1200px] mx-auto p-4 sm:p-8 gap-4 sm:gap-8 pb-[calc(80px+env(safe-area-inset-bottom))]">
        {/* Main Feed Section */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Feed List */}
          <div className="space-y-6">
            {isBillsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="w-full h-[300px] rounded-[24px]" />
              ))
            ) : (
              finalBills.map((bill, idx) => (
                <div key={bill.billId} className="bg-card border border-border/30 rounded-[24px] overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  {/* Card Header */}
                  <div className="p-4 sm:p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden">
                        <PoliticianPhoto
                          name={bill.proposer || ""}
                          photo={members.find(m => m.name === bill.proposer)?.photo || ""}
                          monaCd={members.find(m => m.name === bill.proposer)?.id || ""}
                          context={members.find(m => m.name === bill.proposer)?.party || undefined}
                          className="w-full h-full object-cover"
                          avatarClassName="text-[12px] font-black bg-muted text-muted-foreground"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[14px] font-black text-foreground">{bill.proposer || "의원 이름"}</span>
                          <span className="text-[14px] text-muted-foreground font-medium">의원</span>
                        </div>
                        <p className="text-[11px] font-bold text-muted-foreground">{members.find(m => m.name === bill.proposer)?.party ?? ""} · {bill.committee}</p>
                      </div>
                    </div>
                    <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Card Content */}
                  <div className="px-4 sm:px-6 pb-2">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-[12px] font-bold text-primary">법안 발의</span>
                    </div>
                    <h2 className="text-[20px] font-black text-foreground mb-2 leading-tight">
                      {bill.billName}
                    </h2>
                    <p className="text-[14px] text-muted-foreground font-medium leading-relaxed mb-4">
                      제출 · {bill.committee || "국토교통위원회"} 회부
                    </p>
                  </div>

                  {/* Card Interactions */}
                  <div className="px-4 sm:px-6 py-4 flex items-center justify-between border-t border-border/30">
                    <div className="flex items-center gap-5">
                      <button className="flex items-center gap-1.5 text-muted-foreground hover:text-red-500 transition-colors">
                        <Heart className="w-5 h-5" />
                      </button>
                      <button className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors">
                        <MessageCircle className="w-5 h-5" />
                      </button>
                      <button className="flex items-center gap-1.5 text-muted-foreground hover:text-green-500 transition-colors">
                        <Share2 className="w-5 h-5" />
                      </button>
                    </div>
                    <button className="text-muted-foreground hover:text-foreground transition-colors">
                      <Bookmark className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-0">
                    <div className="flex flex-col gap-1">
                      <span className="text-[13px] font-black text-foreground">좋아요 {(((bill.billId?.charCodeAt(0) ?? idx) * 137 + idx * 41) % 1900 + 100).toLocaleString()}개</span>
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">{idx + 2}시간 전</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Sidebar Section */}
        <aside className="hidden lg:block w-[320px] space-y-8">
          {/* User Account Summary */}
          <div className="bg-card border border-border/30 rounded-[24px] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-muted border border-border/30 flex items-center justify-center overflow-hidden">
                  {user ? (
                    <div className="w-full h-full bg-primary flex items-center justify-center text-primary-foreground font-black">
                      {user.name.charAt(0)}
                    </div>
                  ) : (
                    <span className="text-muted-foreground/35"><Plus className="w-8 h-8" /></span>
                  )}
                </div>
                <div>
                  <h3 className="text-[15px] font-black text-foreground">{user ? user.name : "내 계정"}</h3>
                  <p className="text-[12px] font-bold text-muted-foreground">{followedIds.length}명 팔로우 중</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recommended Members */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[14px] font-black text-muted-foreground">추천 의원</h3>
              <button className="text-[12px] font-black text-foreground hover:underline">모두 보기</button>
            </div>
            
            <div className="space-y-4">
              {isMembersLoading ? (
                Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="w-full h-12 rounded-xl" />)
              ) : (
                recommendedMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between group">
                    <Link href={`/members/${member.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                        <PoliticianPhoto
                          name={member.name}
                          photo={member.photo}
                          monaCd={member.id}
                          context={member.party}
                          className="w-full h-full object-cover"
                          avatarClassName="text-[12px] font-black bg-muted text-muted-foreground"
                        />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[13px] font-black text-foreground truncate group-hover:text-primary transition-colors">{member.name}</h4>
                        <p className="text-[11px] font-bold text-muted-foreground truncate">{member.party} · {member.district.split(' ')[0]}</p>
                      </div>
                    </Link>
                    <button 
                      onClick={() => {
                        if (!user) {
                          setShowLoginPrompt(true);
                          return;
                        }
                        followMutation.mutate(member.id);
                      }}
                      disabled={followMutation.isPending}
                      className="text-[12px] font-black text-primary hover:text-primary/80 transition-colors pl-2 disabled:opacity-50"
                    >
                      팔로우
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Footer Info */}
          <div className="px-1 text-[11px] font-bold text-gray-300 space-y-4">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <span>정보</span>
              <span>도움말</span>
              <span>홍보 센터</span>
              <span>API</span>
              <span>채용 정보</span>
              <span>개인정보처리방침</span>
              <span>약관</span>
              <span>위치</span>
              <span>언어</span>
            </div>
            <p>© 2024 이유 FROM COALFIRE</p>
          </div>
        </aside>
      </div>

      <LoginPrompt isOpen={showLoginPrompt} onClose={() => setShowLoginPrompt(false)} />
    </div>
  );
}
