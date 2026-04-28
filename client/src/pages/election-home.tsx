import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Pencil, ChevronRight, User, Vote, Flame, MessageSquare, Eye, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { saveCandidateToSession } from "@/pages/candidate-detail";
import { apiRequest } from "@/lib/queryClient";

// Party colors for avatars/badges
const getPartyColor = (party: string) => {
  if (party.includes("더불어민주당")) return "bg-blue-600";
  if (party.includes("국민의힘")) return "bg-red-500";
  if (party.includes("조국혁신당")) return "bg-blue-800";
  if (party.includes("개혁신당")) return "bg-orange-500";
  if (party.includes("진보당")) return "bg-red-700";
  if (party.includes("새로운미래")) return "bg-emerald-500";
  return "bg-gray-500";
};

const getPartySeats = (party: string) => {
  if (party.includes("더불어민주당")) return 170;
  if (party.includes("국민의힘")) return 108;
  if (party.includes("조국혁신당")) return 12;
  if (party.includes("개혁신당")) return 3;
  if (party.includes("진보당")) return 3;
  return 0;
};

function RegionView({ region, rank, totalCount }: { region: { code: string; name: string }, rank: number, totalCount: number }) {
  const [, setLocation] = useLocation();
  const ELECTION_DATE = new Date("2026-06-03T00:00:00+09:00");
  const getDDay = () => {
    const diffTime = ELECTION_DATE.getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? `D-${diffDays}` : diffDays === 0 ? "D-Day" : `D+${Math.abs(diffDays)}`;
  };

  const { data: candidates, isLoading: isCandidatesLoading } = useQuery<any[]>({
    queryKey: ["/api/election/candidates", region.code],
    queryFn: async () => {
      const res = await fetch(`/api/election/candidates?regionCode=${region.code}&electionType=mayor`);
      
      const mockData = [
        { id: 1, name: "김민주", party: "더불어민주당", pledges: ["1. 서민 금융 지원 확대"] },
        { id: 2, name: "박국민", party: "국민의힘", pledges: ["1. 부동산 세제 개편"] },
        { id: 3, name: "이조국", party: "조국혁신당", pledges: ["1. 검찰 개혁 완성 보장"] },
        { id: 4, name: "최개혁", party: "개혁신당", pledges: ["1. 미래 산업 육성 보장"] },
        { id: 5, name: "정진보", party: "진보당", pledges: ["1. 노동자 권리 강화 보장"] }
      ];

      if (!res.ok) {
        return mockData; // Fall back to mock data
      }
      
      try {
        const data = await res.json();
        if (data.error || !Array.isArray(data)) {
            return mockData;
        }
        return data.length > 0 ? data : mockData; // Use mock data if empty
      } catch (e) {
        return mockData;
      }
    },
  });

  const { data: members, isLoading: isMembersLoading } = useQuery<any[]>({
    queryKey: ["/api/members", region.code],
    queryFn: async () => {
      const res = await fetch(`/api/members?region=${region.code}`);
      if (!res.ok) {
        return [];
      }
      const data = await res.json();
      return data;
    },
  });

  const membersData = Array.isArray(members) ? members : (members as any)?.data || [];
  const sortedMembers = Array.isArray(membersData) ? [...membersData].sort((a, b) => getPartySeats(b.party) - getPartySeats(a.party)) : [];
  const topMembers = sortedMembers.slice(0, 6);

  const supportRateA = 52.3;
  const supportRateB = 47.7;

  const getDisplayName = (name: string) => {
    if (name.endsWith("시") || name.endsWith("도")) return name;
    if (["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종"].includes(name)) return `${name}시`;
    if (["경기", "충북", "충남", "전북", "전남", "경북", "경남", "제주", "강원"].includes(name)) return `${name}도`;
    return name;
  };

  const { data: trendingPosts, isLoading: isTrendingLoading } = useQuery<any[]>({
    queryKey: ["/api/community/posts", "trending"],
    queryFn: () => apiRequest("GET", "/api/community/posts?sort=popular").then((r) => r.json()),
  });

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-indigo-700 px-5 pt-10 pb-12 rounded-b-[3rem] text-white shadow-md relative shrink-0">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h1 className="text-2xl font-black tracking-tight truncate flex items-center gap-2">
              {getDisplayName(region.name)}
              {totalCount > 1 && (
                <span className="text-xs bg-indigo-500/50 px-2 py-0.5 rounded-full font-medium ml-1">
                  {rank}순위
                </span>
              )}
            </h1>
            <button 
              onClick={() => setLocation("/onboarding")}
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors flex-shrink-0 flex items-center justify-center"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
          <div className="bg-white text-indigo-700 px-4 py-1.5 rounded-full font-bold text-sm tracking-widest shadow-sm shrink-0 whitespace-nowrap mt-1">
            {getDDay()}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-indigo-100 font-medium opacity-90">당신의 한 표가 지역의 미래를 바꿉니다.</p>
          {totalCount > 1 && (
            <div className="flex gap-1 justify-end mr-1">
              {Array.from({ length: totalCount }).map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === rank - 1 ? "bg-white" : "bg-white/30"}`} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 -mt-10 relative z-10 flex-1 pb-10">
        {/* Candidates vs Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-white p-5 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-indigo-500 rounded-full inline-block" />
              {region.name} 시장 선거
            </h2>
          </div>

          {isCandidatesLoading ? (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center px-4">
                <Skeleton className="w-[100px] h-[100px] rounded-full" />
                <div className="text-gray-300 font-black italic text-2xl">VS</div>
                <Skeleton className="w-[100px] h-[100px] rounded-full" />
              </div>
              <Skeleton className="w-full h-10 mt-4 rounded-lg" />
            </div>
          ) : candidates && candidates.length >= 1 ? (
            <div className="flex flex-col gap-6">
              {/* VS Layout for Top 2 or Single Layout for 1 */}
              <div className="flex items-start justify-center relative mt-4 w-full">
                {/* Candidate A */}
                <Link
                  href={`/candidates/${encodeURIComponent(candidates[0].id || candidates[0].name)}`}
                  onClick={() => saveCandidateToSession(String(candidates[0].id || candidates[0].name), candidates[0])}
                  className={`flex-1 min-w-0 ${candidates.length >= 2 ? "border-r border-gray-100/50" : ""}`}
                >
                  <div className="flex flex-col items-center cursor-pointer group/cand px-2">
                    <div className="relative mb-4">
                      <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-[3px] shadow-sm transform transition-transform group-hover/cand:scale-105 ${candidates[0].party.includes("민주") ? "border-blue-500" : "border-red-500"}`}>
                        {candidates[0].photo ? (
                          <img src={candidates[0].photo} alt={candidates[0].name} className="w-full h-full object-cover bg-white" />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center font-black text-xl text-white ${getPartyColor(candidates[0].party)}`}>
                            {candidates[0].name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <span className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[10px] font-bold text-white rounded-full whitespace-nowrap shadow-sm ${getPartyColor(candidates[0].party)}`}>
                        {candidates[0].party}
                      </span>
                    </div>
                    <h3 className="font-bold text-base mb-2 text-center group-hover/cand:text-indigo-600 transition-colors w-full">{candidates[0].name}</h3>
                    <div className="flex flex-col gap-1.5 w-full items-center">
                      {(candidates[0].pledges || []).slice(0, 2).map((p: any, i: number) => (
                        <span key={i} className="text-[10px] bg-gray-50 text-gray-600 px-1.5 py-1 rounded text-center line-clamp-1 w-full border border-gray-100/50" title={typeof p === 'string' ? p : p.title}>
                          {typeof p === 'string' ? p : p.title}
                        </span>
                      ))}
                    </div>
                    <span className="mt-2 text-[10px] text-indigo-400 font-medium flex items-center gap-0.5 whitespace-nowrap">상세보기 <ChevronRight className="w-3 h-3" /></span>
                  </div>
                </Link>

                {candidates.length >= 2 && (
                  <>
                    <div className="absolute left-1/2 top-8 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center pointer-events-none">
                      <div className="bg-white p-0.5 rounded-full shadow-sm">
                        <div className="bg-gradient-to-r from-gray-800 to-gray-600 text-white w-6 h-6 flex items-center justify-center rounded-full font-black text-[10px] italic tracking-tighter">
                          VS
                        </div>
                      </div>
                    </div>

                    {/* Candidate B */}
                    <Link
                      href={`/candidates/${encodeURIComponent(candidates[1].id || candidates[1].name)}`}
                      onClick={() => saveCandidateToSession(String(candidates[1].id || candidates[1].name), candidates[1])}
                      className="flex-1 min-w-0"
                    >
                      <div className="flex flex-col items-center cursor-pointer group/cand2 px-2">
                        <div className="relative mb-4">
                          <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-[3px] shadow-sm transform transition-transform group-hover/cand2:scale-105 ${candidates[1].party.includes("국민") ? "border-red-500" : "border-blue-500"}`}>
                            {candidates[1].photo ? (
                              <img src={candidates[1].photo} alt={candidates[1].name} className="w-full h-full object-cover bg-white" />
                            ) : (
                              <div className={`w-full h-full flex items-center justify-center font-black text-xl text-white ${getPartyColor(candidates[1].party)}`}>
                                {candidates[1].name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <span className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[10px] font-bold text-white rounded-full whitespace-nowrap shadow-sm ${getPartyColor(candidates[1].party)}`}>
                            {candidates[1].party}
                          </span>
                        </div>
                        <h3 className="font-bold text-base mb-2 text-center group-hover/cand2:text-indigo-600 transition-colors w-full">{candidates[1].name}</h3>
                        <div className="flex flex-col gap-1.5 w-full items-center">
                          {(candidates[1].pledges || []).slice(0, 2).map((p: any, i: number) => (
                            <span key={i} className="text-[10px] bg-gray-50 text-gray-600 px-1.5 py-1 rounded text-center line-clamp-1 w-full border border-gray-100/50" title={typeof p === 'string' ? p : p.title}>
                              {typeof p === 'string' ? p : p.title}
                            </span>
                          ))}
                        </div>
                        <span className="mt-2 text-[10px] text-indigo-400 font-medium flex items-center gap-0.5 whitespace-nowrap">상세보기 <ChevronRight className="w-3 h-3" /></span>
                      </div>
                    </Link>
                  </>
                )}
              </div>

              {/* Other Candidates List */}
              {candidates.length > 2 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h3 className="text-sm font-bold text-gray-700 mb-3 ml-1">나머지 후보</h3>
                  <div className="flex flex-col gap-2">
                    {candidates.slice(2).map((c: any) => (
                      <Link key={c.id || c.name} href={`/candidates/${encodeURIComponent(c.id || c.name)}`} onClick={() => saveCandidateToSession(String(c.id || c.name), c)}>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100/50 hover:bg-indigo-50 hover:border-indigo-100 transition-colors cursor-pointer group">
                        <div className={`w-10 h-10 rounded-full flex-shrink-0 overflow-hidden shadow-sm flex items-center justify-center font-bold text-white text-sm ${getPartyColor(c.party)}`}>
                          {c.photo ? (
                            <img src={c.photo} alt={c.name} className="w-full h-full object-cover bg-white" />
                          ) : (
                            c.name.charAt(0)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[13px] text-gray-900 truncate group-hover:text-indigo-700 transition-colors">
                            {c.name} <span className="text-[11px] font-medium text-gray-500 ml-1">{c.party}</span>
                          </p>
                          <p className="text-[11px] text-gray-500 truncate mt-0.5">
                            {c.pledges?.[0] ? (typeof c.pledges[0] === 'string' ? c.pledges[0] : c.pledges[0].title) : "공약 준비 중"}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                      </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Progress & Action */}
              {candidates.length >= 2 && (
                <div className="bg-indigo-50/50 border border-indigo-100/50 p-4 rounded-xl mt-2">
                  <div className="flex justify-between items-center text-sm font-bold mb-2">
                    <span className="text-blue-600 shrink-0">{supportRateA}%</span>
                    <span className="text-gray-400 text-[11px] font-normal shrink-0">지지율 (예시)</span>
                    <span className="text-red-500 shrink-0">{supportRateB}%</span>
                  </div>
                  <div className="h-3 w-full bg-red-50 rounded-full overflow-hidden flex shadow-inner">
                    <div className="bg-blue-500 h-full transition-all duration-1000 ease-out" style={{ width: `${supportRateA}%` }} />
                    <div className="bg-red-500 h-full transition-all duration-1000 ease-out" style={{ width: `${supportRateB}%` }} />
                  </div>
                  
                  <Button className="w-full mt-5 bg-gradient-to-r from-indigo-500 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 text-white font-bold h-12 rounded-xl shadow-md transition-all hover:shadow-lg flex items-center justify-center gap-2">
                    <Vote className="w-5 h-5" />
                    온라인 모의투표 참여하기
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-gray-500 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
              <User className="w-12 h-12 mb-3 text-gray-300" />
              <p className="font-medium text-center">아직 등록된 후보가 없습니다.</p>
              <p className="text-sm text-gray-400 mt-1">후보 정보를 준비 중입니다.</p>
            </div>
          )}
        </div>

        {/* Members Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              우리 지역 국회의원
            </h2>
            <Link href="/members">
              <span className="text-sm font-medium text-indigo-600 flex items-center cursor-pointer hover:underline">
                더보기 <ChevronRight className="w-4 h-4" />
              </span>
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {isMembersLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center">
                  <Skeleton className="w-16 h-16 rounded-full mb-3" />
                  <Skeleton className="w-20 h-4 mb-2" />
                  <Skeleton className="w-14 h-3" />
                </div>
              ))
            ) : topMembers.length > 0 ? (
              topMembers.map((member) => (
                <Link href={`/members/${member.id || member.monaCd}`} key={member.id || member.monaCd}>
                  <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col items-center group">
                    <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full mb-3 overflow-hidden border-2 transition-transform group-hover:scale-105 ${getPartyColor(member.party).replace('bg-', 'border-')}`}>
                      {member.photoUrl || member.photo ? (
                        <img src={member.photoUrl || member.photo} alt={member.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className={`w-full h-full flex items-center justify-center font-bold text-lg text-white ${getPartyColor(member.party)}`}>
                          {member.name?.charAt(0) || '?'}
                        </div>
                      )}
                    </div>
                    <div className="text-center w-full">
                      <h4 className="font-bold text-gray-900 text-[15px] mb-1">{member.name}</h4>
                      <p className={`text-[11px] font-semibold mb-1 ${getPartyColor(member.party).replace('bg-', 'text-')}`}>
                        {member.party}
                      </p>
                      <p className="text-[11px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full inline-block max-w-full truncate">
                        {member.district}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="col-span-2 py-10 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-gray-500">
                <User className="w-10 h-10 mb-2 text-gray-300" />
                <p className="text-sm font-medium">지역구 국회의원 정보가 없습니다.</p>
              </div>
            )}
          </div>

          {/* Community Pulse Section */}
          <div className="mt-8 mb-10">
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                지금 뜨는 커뮤니티
              </h2>
              <Link href="/community">
                <span className="text-sm font-medium text-indigo-600 cursor-pointer hover:underline">
                  전체보기
                </span>
              </Link>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
              {isTrendingLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-4 flex flex-col gap-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))
              ) : trendingPosts && trendingPosts.length > 0 ? (
                trendingPosts.slice(0, 3).map((post) => (
                  <Link key={post.id} href={`/community/${post.id}`}>
                    <div className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group">
                      <h3 className="text-[14px] font-bold text-gray-800 mb-1 group-hover:text-indigo-600 line-clamp-1">
                        {post.title}
                      </h3>
                      <div className="flex items-center gap-3 text-[11px] text-gray-400 font-medium">
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {post.viewCount || 0}</span>
                        <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {post.likes || 0}</span>
                        <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {post.commentCount || 0}</span>
                        <span className="ml-auto bg-gray-50 px-1.5 py-0.5 rounded text-[10px]">{post.category}</span>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-10 text-center text-gray-400 text-sm">
                  활발한 논의가 진행 중입니다.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ElectionHome() {
  const [, setLocation] = useLocation();
  const [regions, setRegions] = useState<{ code: string; name: string }[]>([]);

  useEffect(() => {
    // 1. 다중 지역 로컬스토리지 확인
    const storedMulti = localStorage.getItem("userRegions");
    if (storedMulti) {
      try {
        const parsed = JSON.parse(storedMulti);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRegions(parsed);
          return;
        }
      } catch (e) {}
    }
    
    // 2. 단일 지역 폴백
    const storedSingle = localStorage.getItem("userRegion");
    if (storedSingle) {
      try {
        const parsed = JSON.parse(storedSingle);
        if (parsed?.code) {
          setRegions([parsed]);
          return;
        }
      } catch (e) {}
    }
    
    // 없으면 온보딩으로
    setLocation("/onboarding");
  }, [setLocation]);

  if (regions.length === 0) return null;

  return (
    <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide min-h-[calc(100vh-60px)] max-w-[430px] mx-auto bg-indigo-50">
      {regions.map((region, idx) => (
        <div key={`${region.code}-${idx}`} className="w-full flex-shrink-0 snap-start snap-always relative overflow-y-auto">
          <RegionView region={region} rank={idx + 1} totalCount={regions.length} />
        </div>
      ))}
    </div>
  );
}
