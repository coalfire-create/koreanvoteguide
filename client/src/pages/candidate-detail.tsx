import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  Clock,
  Newspaper,
  ChevronDown,
  ChevronUp,
  Star,
  User,
  GraduationCap,
  Briefcase,
  MessageCircle,
  ThumbsUp,
  PenSquare,
  Sparkles,
  Landmark,
  ShieldCheck,
  Receipt,
  Scale,
  Vote,
  MapPin,
  ShieldQuestion,
} from "lucide-react";
import { NewsAnalysisDialog } from "@/components/news-analysis-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { candidates as mockCandidates, getPartyColor } from "@/lib/mock-data";
import { MAYOR_RACES } from "@/lib/mayor-candidates";
import type { CommunityPost, TimelineEvent } from "@shared/schema";

type PostWithCount = CommunityPost & { commentCount?: number; displayName?: string };

import { CandidateEvaluationReport } from "@/components/CandidateEvaluationReport";
import PledgeDetailView, { analyzeFeasibility } from "@/components/PledgeDetailView";
import { PoliticianPhoto } from "@/components/PoliticianPhoto";

// ─── 뉴스 타입 ──────────────────────────────────────────────────────────────
interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  sourceCode: string;
  thumbnail?: string;
}
interface NewsResponse {
  items: NewsItem[];
}

// ─── 날짜 포맷 ───────────────────────────────────────────────────────────────
function formatTime(pubDate: string): string {
  if (!pubDate) return "";
  try {
    const date = new Date(pubDate);
    const diff = Date.now() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "방금";
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
  } catch {
    return "";
  }
}

// ─── 당색 텍스트 변환 ─────────────────────────────────────────────────────────
function partyTextColor(party: string): string {
  if (party.includes("더불어민주당")) return "text-blue-600";
  if (party.includes("국민의힘")) return "text-red-500";
  if (party.includes("조국혁신당")) return "text-blue-800";
  if (party.includes("개혁신당")) return "text-orange-500";
  if (party.includes("진보당")) return "text-red-700";
  return "text-gray-600";
}

// sessionStorage에 임시 후보 데이터 저장/조회용
interface SessionCandidate {
  id?: string | number;
  name?: string;
  party?: string;
  photo?: string;
  background?: string;
  pledges?: (string | { title?: string; description?: string })[];
  pastActivities?: string[];
  education?: string;
  edu?: string;
  career?: string;
  career1?: string;
  career2?: string;
  timeline?: TimelineEvent[];
  ratings?: number[];
  // 검증정보 (선관위 후보자정보 CSV import)
  propertyAmount?: string | null;
  militaryService?: string | null;
  taxPaid?: string | null;
  taxArrears?: string | null;
  candidacyHistory?: string | null;
  criminal?: string | null;
  criminalRecords?: (string | { title?: string; crime?: string; summary?: string; date?: string })[];
  job?: string | null;
  districtName?: string | null;
  electionType?: string | null;
}

export function saveCandidateToSession(key: string, data: unknown) {
  try {
    sessionStorage.setItem(`candidate_${key}`, JSON.stringify(data));
  } catch {}
}
function loadCandidateFromSession(key: string): SessionCandidate | null {
  try {
    const raw = sessionStorage.getItem(`candidate_${key}`);
    return raw ? (JSON.parse(raw) as SessionCandidate) : null;
  } catch {
    return null;
  }
}


// ─── 공약 카드 (클릭 → Sheet 오픈) ──────────────────────────────────────
function PledgeCard({ candidateId, promise, onClick }: {
  candidateId: string;
  promise: { id: string; title: string; description: string; realmName?: string; content?: string; method?: string; funding?: string; duration?: string };
  onClick: () => void;
}) {

  const { data: comments = [] } = useQuery<unknown[]>({
    queryKey: ["pledge_comments", candidateId, promise.id],
    queryFn: () => apiRequest("GET", `/api/candidates/${candidateId}/pledges/${promise.id}/comments`).then(r => r.json()),
    staleTime: 30 * 1000,
  });

  const feasibility = analyzeFeasibility(promise.title, promise.description);

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-start gap-3 p-4 bg-white border border-gray-100 rounded-2xl hover:border-indigo-200 hover:shadow-md transition-all duration-200 group"
    >
      <div className="mt-0.5 shrink-0 w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
        <CheckCircle2 className="w-4 h-4 text-indigo-500" />
      </div>
      <div className="flex-1 min-w-0">
        {promise.realmName && (
          <span className="inline-block text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md mb-1 uppercase tracking-wider">{promise.realmName}</span>
        )}
        <p className="font-bold text-[14px] text-gray-900 leading-snug group-hover:text-indigo-700 transition-colors">{promise.title}</p>
        {promise.description && (
          <p className="text-[11px] text-gray-400 mt-1 line-clamp-1 leading-relaxed">{promise.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {/* 실현가능성 뱃지 */}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${feasibility.bg} ${feasibility.color}`}>
            실현가능성 {feasibility.label}
          </span>
          {/* 구조화 데이터 지표 */}
          {promise.method && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">이행방법 ✓</span>}
          {promise.funding && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">재원조달 ✓</span>}
          {promise.duration && <span className="text-[9px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">이행기간 ✓</span>}
          {/* 댓글 수 */}
          {comments.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <MessageCircle className="w-3 h-3" />
              {comments.length}
            </span>
          )}
        </div>
      </div>
      <ChevronDown className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 rotate-[-90deg] shrink-0 mt-2 transition-colors" />
    </button>
  );
}

// ─── 후보 상세 페이지 ─────────────────────────────────────────────────────────
export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [newsExpanded, setNewsExpanded] = useState(false);
  const [selectedPledge, setSelectedPledge] = useState<{ id: string; title: string; description: string } | null>(null);
  const [selectedNews, setSelectedNews] = useState<{ title: string; url: string; source: string } | null>(null);

  // 1) id 또는 이름으로 mock-data에서 찾기
  const decodedId = decodeURIComponent(id ?? "");
  const mockCandidate = mockCandidates.find(
    (c) => c.id === decodedId || c.name === decodedId
  );

  // 2) mayor-candidates에서 찾기 (id 또는 이름 매칭)
  const allMayorCandidates = MAYOR_RACES.flatMap((r) => r.candidates);
  const mayorCandidate = !mockCandidate
    ? allMayorCandidates.find((c) => c.id === decodedId || c.name === decodedId)
    : undefined;

  // 3) sessionStorage에서 election-home이 저장한 후보 데이터 읽기
  const sessionCandidate = !mockCandidate && !mayorCandidate ? loadCandidateFromSession(decodedId) : null;

  // 후보 통합 — mock 우선, 없으면 mayor-candidates, 없으면 session, 없으면 null
  const candidate = mockCandidate
    ?? (mayorCandidate ? {
        id: mayorCandidate.id,
        name: mayorCandidate.name,
        party: mayorCandidate.party,
        photo: mayorCandidate.photo ?? "",
        electionType: "local" as const,
        background: mayorCandidate.background,
        promises: mayorCandidate.promises,
        pastActivities: mayorCandidate.pastActivities,
        education: mayorCandidate.education,
        career: mayorCandidate.career,
        timeline: [],
        ratings: [],
      } : null)
    ?? (sessionCandidate ? {
        id: String(sessionCandidate.id ?? decodedId),
        name: sessionCandidate.name ?? decodedId,
        party: sessionCandidate.party ?? "",
        photo: sessionCandidate.photo ?? "",
        electionType: "local" as const,
        background: sessionCandidate.background ?? "후보 정보를 불러오는 중입니다.",
        promises: ((sessionCandidate.pledges ?? []) as (string | { title?: string; description?: string; goalCont?: string; methCont?: string; distCont?: string; deptCont?: string; realmName?: string })[]).map((p, i) => ({
          id: `p${i}`,
          title: typeof p === "string" ? p : (p.title ?? String(p)),
          description: typeof p === "string" ? "" : (p.description ?? p.goalCont ?? ""),
          realmName: typeof p === "string" ? undefined : (p.realmName ?? undefined),
          content: typeof p === "string" ? undefined : (p.content ?? p.goalCont ?? undefined),
          method: typeof p === "string" ? undefined : (p.method ?? p.methCont ?? undefined),
          funding: typeof p === "string" ? undefined : (p.funding ?? p.deptCont ?? undefined),
          duration: typeof p === "string" ? undefined : (p.duration ?? p.distCont ?? undefined),
        })),
        pastActivities: sessionCandidate.pastActivities ?? [],
        education: sessionCandidate.education ?? sessionCandidate.edu,
        career: sessionCandidate.career ?? (sessionCandidate.career1 ? `${sessionCandidate.career1}${sessionCandidate.career2 ? `\n${sessionCandidate.career2}` : ""}` : undefined),
        timeline: sessionCandidate.timeline ?? [],
        ratings: sessionCandidate.ratings ?? [],
      } : null);

  // 뉴스 API — 후보 이름으로 검색
  const candidateName = candidate?.name ?? decodedId;
  const { data: newsData, isLoading: newsLoading } = useQuery<NewsResponse>({
    queryKey: ["/api/news", candidateName],
    queryFn: async () => {
      const res = await fetch(`/api/news`);
      if (!res.ok) return { items: [] };
      const data = await res.json();
      // 제목에 후보 이름이 포함된 기사만 필터
      const filtered = (data.items || []).filter((item: NewsItem) =>
        item.title.includes(candidateName)
      );
      return { items: filtered };
    },
    enabled: !!candidateName,
  });

  // 커뮤니티 게시글 조회
  const { data: posts, isLoading: postsLoading } = useQuery<PostWithCount[]>({
    queryKey: ["/api/community/posts", "candidate", decodedId],
    queryFn: () => apiRequest("GET", `/api/community/posts?tagType=candidate&tagId=${decodedId}`).then((r) => r.json()),
  });


  if (!candidate) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <User className="w-16 h-16 text-gray-300" />
        <p className="text-gray-500 font-medium">후보 정보를 찾을 수 없습니다.</p>
        <Link href="/">
          <Button variant="outline">홈으로 돌아가기</Button>
        </Link>
      </div>
    );
  }


  const newsItems = newsData?.items ?? [];
  const visibleNews = newsExpanded ? newsItems : newsItems.slice(0, 4);

  const partyBg = getPartyColor(candidate.party);

  // ── 검증정보 (선관위 후보자정보 CSV import) — mock/mayor 후보는 session에 없으므로 fresh load ──
  const verifData = sessionCandidate ?? loadCandidateFromSession(decodedId);
  const criminalRecords = Array.isArray(verifData?.criminalRecords) ? verifData!.criminalRecords : [];
  const criminalLines = criminalRecords
    .map((r) => (typeof r === "string" ? r : `${r.title ?? r.crime ?? r.summary ?? "내용 미상"}${r.date ? ` (${r.date})` : ""}`))
    .filter(Boolean);
  const verification = {
    district: verifData?.districtName ?? null,
    job: verifData?.job ?? null,
    property: verifData?.propertyAmount ?? null,
    military: verifData?.militaryService ?? null,
    taxPaid: verifData?.taxPaid ?? null,
    taxArrears: verifData?.taxArrears ?? null,
    candidacy: verifData?.candidacyHistory ?? null,
    criminalText: verifData?.criminal ?? null,
  };
  const hasVerification = !!(
    verification.property || verification.military || verification.taxPaid ||
    verification.taxArrears || verification.candidacy || verification.criminalText ||
    criminalLines.length
  );

  return (
    <>
      <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full pb-24"
    >
      {/* ── 헤더 ── */}
      <div className={`${partyBg} px-4 pt-10 pb-16 relative`}>
        <div className="max-w-4xl mx-auto relative">
          <Link href="/">
            <button className="absolute top-0 left-0 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
          </Link>
          <div className="flex flex-col items-center gap-3 mt-6">
            <div className="w-24 h-24 rounded-full bg-white/20 border-4 border-white/60 overflow-hidden shadow-lg">
              <PoliticianPhoto
                name={candidate.name}
                photo={candidate.photo}
                monaCd={String(candidate.id)}
                context={candidate.party}
                avatarClassName="w-full h-full flex items-center justify-center text-white font-black text-3xl"
              />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-black text-white">{candidate.name}</h1>
              <p className="text-white/80 text-sm mt-1 font-medium">{candidate.party}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 탭 컨텐츠 ── */}
      <div className="px-4 -mt-6 relative z-10 w-full max-w-6xl mx-auto">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden divide-y divide-gray-100">
          {/* ── 요약 및 기본 정보 ── */}
          <section className="p-6 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-black text-gray-900 flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-indigo-600" />
                국회의원 게시판
              </h3>
              <Link href={`/community/write?tagType=candidate&tagId=${decodedId}&tagName=${candidate.name}`}>
                <Button size="sm" className="h-8 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-[11px] font-black rounded-full px-4 border-none shadow-none">
                  <PenSquare className="w-3 h-3 mr-1" /> 토론하기
                </Button>
              </Link>
            </div>
            {postsLoading ? (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide mb-4">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="w-[200px] h-[80px] rounded-xl shrink-0" />
                ))}
              </div>
            ) : posts && posts.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x mb-4">
                {posts.map((post) => (
                  <Link key={post.id} href={`/community/${post.id}`}>
                    <div className="w-[200px] shrink-0 bg-white border border-gray-200 rounded-xl p-3 snap-center hover:border-indigo-300 transition-colors cursor-pointer flex flex-col justify-between h-[80px]">
                      <h4 className="text-[13px] font-bold text-gray-900 line-clamp-2 leading-snug">
                        {post.title}
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold mt-1">
                        <span className="text-gray-700 truncate max-w-[60px]">{post.displayName || "익명"}</span>
                        <div className="flex items-center gap-1.5 ml-auto shrink-0">
                          <span className="flex items-center gap-0.5"><ThumbsUp className="w-2.5 h-2.5" /> {post.likes}</span>
                          <span className="flex items-center gap-0.5"><MessageCircle className="w-2.5 h-2.5" /> {post.commentCount}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-[12px] text-gray-400 py-4 mb-4 bg-gray-50 rounded-xl text-center border border-dashed border-gray-200">
                아직 등록된 관련 게시물이 없습니다.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3">
              <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/50">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <span className="text-[11px] font-black text-indigo-600 uppercase tracking-tight">선거구</span>
                </div>
                <p className="text-[13px] font-bold text-gray-800 leading-snug">{verification.district || "정보 없음"}</p>
              </div>
              <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/50">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <span className="text-[11px] font-black text-indigo-600 uppercase tracking-tight">직업</span>
                </div>
                <p className="text-[13px] font-bold text-gray-800 leading-snug">{verification.job || "정보 없음"}</p>
              </div>
              <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/50">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <span className="text-[11px] font-black text-indigo-600 uppercase tracking-tight">학력</span>
                </div>
                <p className="text-[13px] font-bold text-gray-800 leading-snug">{candidate.education || "정보 없음"}</p>
              </div>
              <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/50">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <span className="text-[11px] font-black text-indigo-600 uppercase tracking-tight">주요 경력</span>
                </div>
                <p className="text-[13px] font-bold text-gray-800 leading-snug whitespace-pre-line">{candidate.career || "정보 없음"}</p>
              </div>
              {verification.candidacy && (
                <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/50 md:col-span-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <Vote className="w-3.5 h-3.5 text-indigo-600" />
                    </div>
                    <span className="text-[11px] font-black text-indigo-600 uppercase tracking-tight">공직선거 입후보 경력</span>
                  </div>
                  <p className="text-[13px] font-bold text-gray-800 leading-snug whitespace-pre-line">{verification.candidacy}</p>
                </div>
              )}
            </div>
          </section>

          {/* ── 검증 정보 (재산·병역·세금·전과) ── */}
          <section className="p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              <h3 className="text-[16px] font-black text-gray-900">검증 정보</h3>
              <span className="text-[11px] text-gray-400 font-medium ml-1">선관위 후보자정보 기준</span>
            </div>
            {!hasVerification ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 rounded-2xl bg-gray-50 border border-dashed border-gray-200">
                <ShieldQuestion className="w-8 h-8 text-gray-300" />
                <p className="text-[14px] font-bold text-gray-700">검증 정보가 아직 등록되지 않았습니다</p>
                <p className="text-[12px] text-gray-400 text-center max-w-xs">재산·병역·세금·전과 등 선관위 후보자정보가 반영되면 자동으로 표시됩니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 재산 */}
                <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100/60">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Landmark className="w-4 h-4 text-emerald-600" />
                    <span className="text-[11px] font-black text-emerald-700 uppercase tracking-tight">재산 신고액</span>
                  </div>
                  <p className="text-[15px] font-black text-emerald-800 leading-snug">{verification.property || "정보 없음"}</p>
                </div>
                {/* 병역 */}
                <div className="bg-sky-50/50 rounded-2xl p-4 border border-sky-100/60">
                  <div className="flex items-center gap-2 mb-1.5">
                    <ShieldCheck className="w-4 h-4 text-sky-600" />
                    <span className="text-[11px] font-black text-sky-700 uppercase tracking-tight">병역 사항</span>
                  </div>
                  <p className="text-[13px] font-bold text-gray-800 leading-snug whitespace-pre-line">{verification.military || "정보 없음"}</p>
                </div>
                {/* 세금 납부 */}
                <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100/60">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Receipt className="w-4 h-4 text-amber-600" />
                    <span className="text-[11px] font-black text-amber-700 uppercase tracking-tight">세금 납부</span>
                  </div>
                  <p className="text-[13px] font-bold text-gray-800 leading-snug whitespace-pre-line">{verification.taxPaid || "정보 없음"}</p>
                </div>
                {/* 세금 체납 */}
                <div className="bg-rose-50/50 rounded-2xl p-4 border border-rose-100/60">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Receipt className="w-4 h-4 text-rose-600" />
                    <span className="text-[11px] font-black text-rose-700 uppercase tracking-tight">세금 체납</span>
                  </div>
                  <p className="text-[13px] font-bold text-gray-800 leading-snug whitespace-pre-line">{verification.taxArrears || "없음"}</p>
                </div>
                {/* 전과 기록 */}
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 sm:col-span-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Scale className="w-4 h-4 text-gray-600" />
                    <span className="text-[11px] font-black text-gray-700 uppercase tracking-tight">전과 기록</span>
                  </div>
                  {criminalLines.length > 0 ? (
                    <ul className="space-y-1.5">
                      {criminalLines.map((line, i) => (
                        <li key={i} className="text-[13px] font-bold text-rose-700 flex items-start gap-2">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                          {line}
                        </li>
                      ))}
                    </ul>
                  ) : verification.criminalText ? (
                    <p className="text-[13px] font-bold text-rose-700 leading-snug whitespace-pre-line">{verification.criminalText}</p>
                  ) : (
                    <p className="text-[13px] font-bold text-emerald-700">전과 기록 없음</p>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ── 핵심 공약 ── */}
          <section className="p-6 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-[16px] font-black text-gray-900">핵심 공약</h3>
              </div>
              <Badge variant="secondary" className="bg-gray-100 text-gray-500 hover:bg-gray-200">{candidate.promises.length}개</Badge>
            </div>
            {candidate.promises.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 rounded-2xl bg-gray-50 border border-gray-100">
                <p className="text-[14px] font-bold text-gray-700">5월 21일부터 공약 정보가 공개됩니다</p>
                <p className="text-[12px] text-gray-400 text-center max-w-xs">후보자 등록 기간이 끝나는 5월 21일 이후 선관위 공식 공약이 자동으로 업데이트됩니다.</p>
              </div>
            ) : (
              <>
                <p className="text-[12px] text-gray-400 font-medium mb-3">공약을 클릭하면 AI 분석과 시민 의견을 볼 수 있습니다</p>
                <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
                  {candidate.promises.map((promise: { id: string; title: string; description: string; realmName?: string; content?: string; method?: string; funding?: string; duration?: string }) => (
                    <PledgeCard
                      key={promise.id}
                      candidateId={String(candidate.id)}
                      promise={promise}
                      onClick={() => setSelectedPledge(promise)}
                    />
                  ))}
                </div>
              </>
            )}
          </section>

          {/* ── 객관 평가 리포트 (앱 실데이터 기반) ── */}
          <section className="px-6 pb-2">
            <CandidateEvaluationReport
              candidateName={candidate.name}
              party={candidate.party || undefined}
            />
          </section>

          {/* ── 활동 이력 ── */}
          <section className="p-6 space-y-6">
            <div>
              <h3 className="text-[16px] font-black text-gray-900 flex items-center gap-2 mb-4">
                <Star className="w-5 h-5 text-indigo-600" />
                주요 활동 이력
              </h3>
              <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {candidate.pastActivities.map((activity: string, i: number) => (
                  <li key={i} className="text-[13px] text-gray-600 flex items-start gap-3 bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 shrink-0" />
                    {activity}
                  </li>
                ))}
              </ul>
            </div>

            {/* 타임라인 */}
            <div>
              <h3 className="text-[14px] font-black text-gray-800 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500" />
                활동 타임라인
              </h3>
              <div className="relative pl-5 border-l-2 border-indigo-100 space-y-6 ml-2 max-w-4xl">
                {candidate.timeline.map((event: { id: string | number; date: string; title: string; description: string }) => (
                  <div key={event.id} className="relative">
                    <span className="absolute -left-[1.65rem] top-1 w-4 h-4 rounded-full bg-indigo-400 border-4 border-white shadow-sm" />
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                        {event.date}
                      </span>
                      <p className="font-bold text-[14px] text-gray-900">{event.title}</p>
                    </div>
                    <p className="text-[12px] text-gray-500 leading-relaxed">{event.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── 관련 뉴스 ── */}
          <section className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-black text-gray-900 flex items-center gap-2">
                <Newspaper className="w-5 h-5 text-indigo-600" />
                관련 뉴스
              </h3>
            </div>
            
            {newsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="w-16 h-16 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : newsItems.length === 0 ? (
              <div className="py-8 flex flex-col items-center gap-3 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <Newspaper className="w-8 h-8 text-gray-200" />
                <p className="text-xs font-medium">관련 뉴스가 없습니다.</p>
                <Link href="/news">
                  <Button variant="ghost" size="sm" className="text-indigo-600 font-bold p-0">
                    전체 뉴스 보러 가기
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 mb-3 text-[11px] font-semibold text-indigo-500">
                  <Sparkles className="w-3.5 h-3.5" />
                  기사를 누르면 AI가 핵심 요약·배경·다양한 관점을 정리해 드립니다
                </div>
                <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden divide-y divide-border/40">
                  {visibleNews.map((item, i) => (
                    <motion.button
                      key={i}
                      onClick={() => setSelectedNews({ title: item.title, url: item.link, source: item.source })}
                      initial={{ opacity: 0, y: 8 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      className="w-full text-left flex items-start gap-3 px-4 py-3.5 hover:bg-accent/40 transition-colors group"
                    >
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt=""
                          className="w-14 h-14 rounded-xl object-cover shrink-0 shadow-sm"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center shrink-0">
                          <Newspaper className="w-5 h-5 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-gray-900 line-clamp-2 group-hover:text-indigo-600 transition-colors mb-1.5">
                          {item.title}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-slate-100 text-slate-500 border-none">
                            {item.source}
                          </Badge>
                          <span className="text-[10px] text-gray-400 font-medium">
                            {formatTime(item.pubDate)}
                          </span>
                          <span className="text-[10px] font-bold text-indigo-500/80 flex items-center gap-1 ml-auto">
                            <Sparkles className="w-3 h-3" /> AI 요약
                          </span>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
                {newsItems.length > 4 && (
                  <Button
                    variant="ghost"
                    onClick={() => setNewsExpanded(!newsExpanded)}
                    className="w-full mt-2 text-indigo-600 font-bold text-[12px] h-10 hover:bg-indigo-50 rounded-xl"
                  >
                    {newsExpanded ? (
                      <>접기 <ChevronUp className="w-4 h-4 ml-1" /></>
                    ) : (
                      <>{newsItems.length - 4}개 더 보기 <ChevronDown className="w-4 h-4 ml-1" /></>
                    )}
                  </Button>
                )}
              </>
            )}
          </section>


        </div>

      </div>
    </motion.div>

    <PledgeDetailView
      candidateId={String(candidate.id)}
      promise={selectedPledge}
      open={!!selectedPledge}
      onClose={() => setSelectedPledge(null)}
    />
    <NewsAnalysisDialog
      isOpen={!!selectedNews}
      onOpenChange={(open) => { if (!open) setSelectedNews(null); }}
      news={selectedNews}
    />
    </>
  );
}
