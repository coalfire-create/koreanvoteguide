import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { withApiBase } from "@/lib/api-base";
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
import { ShareButton } from "@/components/ShareButton";

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
  if (party.includes("민주당")) return "text-blue-600";
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
      className="w-full h-full text-left flex flex-col gap-2 p-3.5 bg-white border border-gray-100 rounded-2xl hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-50 transition-all duration-200 group active:scale-[0.98]"
    >
      <div className="flex items-start gap-2">
        <div className="shrink-0 w-7 h-7 rounded-xl bg-indigo-50 group-hover:bg-indigo-600 flex items-center justify-center transition-colors duration-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 group-hover:text-white transition-colors duration-200" />
        </div>
        {promise.realmName && (
          <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-lg mt-0.5 truncate">{promise.realmName}</span>
        )}
      </div>
      <p className="font-bold text-[13px] text-gray-900 leading-snug line-clamp-2 group-hover:text-indigo-700 transition-colors flex-1">{promise.title}</p>
      {promise.description && (
        <p className="text-[10px] text-gray-400 line-clamp-2 leading-relaxed">{promise.description}</p>
      )}
      <div className="flex items-center gap-1 flex-wrap mt-auto">
        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg ${feasibility.bg} ${feasibility.color}`}>
          {feasibility.label}
        </span>
        {promise.method && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-lg">이행</span>}
        {promise.funding && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-lg">재원</span>}
        {promise.duration && <span className="text-[9px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded-lg">기간</span>}
        {comments.length > 0 && (
          <span className="flex items-center gap-0.5 text-[9px] text-gray-400 ml-auto">
            <MessageCircle className="w-2.5 h-2.5" />
            {comments.length}
          </span>
        )}
      </div>
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
        promises: ((sessionCandidate.pledges ?? []) as (string | { title?: string; description?: string; goalCont?: string; methCont?: string; distCont?: string; deptCont?: string; realmName?: string; content?: string; method?: string; funding?: string; duration?: string })[]).map((p, i) => ({
          id: `p${i}`,
          title: typeof p === "string" ? p : (p.title ?? String(p)),
          description: typeof p === "string" ? "" : (p.description ?? p.goalCont ?? ""),
          realmName: typeof p === "string" ? undefined : (p.realmName ?? undefined),
          content: typeof p === "string" ? undefined : (p.content ?? p.goalCont ?? undefined),
          method: typeof p === "string" ? undefined : (p.method ?? p.methCont ?? undefined),
          funding: typeof p === "string" ? undefined : (p.funding ?? p.deptCont ?? undefined),
          duration: typeof p === "string" ? undefined : (p.duration ?? p.distCont ?? undefined),
        })),
        pastActivities: (() => {
          // 선관위 후보는 pastActivities 가 비어 있으므로 career/career1·2/candidacyHistory 에서 추출.
          // 줄바꿈·세미콜론·번호항목(1. 2.) 으로 분리, 중복/공백 제거, 최대 12개로 trim.
          if (sessionCandidate.pastActivities?.length) return sessionCandidate.pastActivities;
          const sources = [
            sessionCandidate.career,
            sessionCandidate.career1,
            sessionCandidate.career2,
            sessionCandidate.candidacyHistory,
          ].filter(Boolean) as string[];
          const split = sources
            .flatMap((s) => s.split(/\n|;|(?<=\.)\s+(?=\d+\.)|(?<=세\))\s+/))
            .map((s) => s.replace(/^\s*[•\-\d.\s]+/, "").trim())
            .filter((s) => s.length > 1);
          return Array.from(new Set(split)).slice(0, 12);
        })(),
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
      className="w-full pb-24 bg-[#F0F2F8] min-h-screen"
    >
      {/* ── 헤더 — 딥 슬레이트 + 당색 그라디언트 오버레이 ── */}
      <div className={`relative overflow-hidden px-4 pt-3 pb-14`} style={{ background: 'linear-gradient(160deg, #0F172A 0%, #1e2d4a 100%)' }}>
        {/* 당색 오라 */}
        <div className={`absolute -top-16 -right-16 w-72 h-72 rounded-full blur-3xl opacity-30 ${partyBg}`} />
        <div className="absolute -bottom-20 -left-10 w-56 h-56 rounded-full blur-3xl opacity-20 bg-indigo-500" />
        {/* 하단 흰 웨이브 마스크 */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-[#F0F2F8] rounded-t-[32px] z-10" />

        <div className="max-w-4xl mx-auto relative z-20">
          <div className="flex items-center justify-between mb-5">
            <Link href="/">
              <button className="p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl transition-all border border-white/15 shadow-md">
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
            </Link>
            <ShareButton
              title={`${candidate.name} 후보 - 이유있는 투표`}
              text={`${candidate.name}(${candidate.party}) 후보의 공약과 정보를 확인하세요`}
              variant="icon"
              className="text-white hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-2xl"
            />
          </div>

          {/* 프로필 카드 — 글래스모피즘 */}
          <div className="flex flex-row items-center gap-4 bg-white/8 backdrop-blur-xl border border-white/12 rounded-3xl p-4 shadow-2xl">
            {/* 사진 */}
            <div className="relative shrink-0">
              <div className="w-[72px] h-[72px] sm:w-[84px] sm:h-[84px] rounded-2xl overflow-hidden border-2 border-white/30 shadow-lg">
                <PoliticianPhoto
                  name={candidate.name}
                  photo={candidate.photo}
                  monaCd={String(candidate.id)}
                  context={candidate.party}
                  avatarClassName="w-full h-full flex items-center justify-center text-gray-400 font-black text-xl bg-gray-100"
                />
              </div>
              {/* 당 색상 뱃지 */}
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${partyBg} border-2 border-[#1e2d4a] shadow-sm`} />
            </div>

            {/* 텍스트 정보 */}
            <div className="flex flex-col justify-center flex-1 min-w-0 gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[22px] sm:text-[26px] font-black text-white tracking-tight leading-none">{candidate.name}</h1>
                <span className="text-white/80 text-[10px] font-black tracking-widest uppercase bg-white/15 px-2 py-0.5 rounded-lg border border-white/20 shrink-0">
                  {verification.job || "후보자"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-[12px] font-black ${partyBg.replace('bg-', 'text-').replace('/30','').replace('/20','').replace('/50','')} text-white/90`}>{candidate.party}</span>
                {verification.district && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-white/25 shrink-0" />
                    <span className="text-white/60 text-[11px] font-medium truncate flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5" />
                      {verification.district}
                    </span>
                  </>
                )}
              </div>
              {/* 인라인 검증 뱃지 */}
              {(() => {
                const age = (verifData as any)?.age;
                const gender = (verifData as any)?.gender;
                const edu = (verifData as any)?.edu;
                const chips: { label: string; tone: "neutral" | "warn" | "ok" }[] = [];
                if (age) chips.push({ label: `${age}세${gender ? ` · ${gender}` : ""}`, tone: "neutral" });
                if (verification.property) chips.push({ label: `재산 ${verification.property}`, tone: "neutral" });
                if (verification.taxArrears && verification.taxArrears !== "0" && verification.taxArrears !== "없음") {
                  chips.push({ label: `체납 ${verification.taxArrears}`, tone: "warn" });
                }
                if (criminalLines.length > 0) chips.push({ label: `전과 ${criminalLines.length}건`, tone: "warn" });
                else if (verification.criminalText && verification.criminalText !== "없음") chips.push({ label: "전과 있음", tone: "warn" });
                if (verification.military && verification.military !== "해당없음") chips.push({ label: `병역 ${verification.military}`, tone: "neutral" });
                if (edu) chips.push({ label: edu, tone: "neutral" });
                if (chips.length === 0) return null;
                return (
                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                    {chips.slice(0, 4).map((c, i) => (
                      <span
                        key={i}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border whitespace-nowrap ${
                          c.tone === "warn"
                            ? "bg-red-400/20 text-red-200 border-red-400/30"
                            : "bg-white/10 text-white/80 border-white/15"
                        }`}
                      >
                        {c.label}
                      </span>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* ── 탭 컨텐츠 — 헤더와 자연스럽게 연결 ── */}
      <div className="px-3 -mt-2 relative z-20 w-full max-w-6xl mx-auto">
        <div className="space-y-3">

          {/* ── 핵심 공약 ── */}
          <section className="bg-white rounded-3xl shadow-sm border border-gray-100/80 overflow-hidden">
            {/* 섹션 헤더 */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-[15px] font-black text-gray-900 leading-tight">핵심 공약</h3>
                  <p className="text-[10px] text-gray-400 font-medium">클릭하면 AI 분석을 볼 수 있어요</p>
                </div>
              </div>
              <span className="text-[11px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-100">{candidate.promises.length}개</span>
            </div>
            <div className="p-4 sm:p-5">
            {candidate.promises.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 rounded-2xl bg-gray-50 border border-dashed border-gray-200">
                <p className="text-[13px] font-bold text-gray-700">5월 21일부터 공약 정보가 공개됩니다</p>
                <p className="text-[11px] text-gray-400 text-center max-w-xs">후보자 등록 기간이 끝나는 5월 21일 이후 선관위 공식 공약이 자동으로 업데이트됩니다.</p>
              </div>
            ) : (
              <>
                {/* AI 힌트 배너 */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-3 mb-4 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[12px] font-black text-indigo-900 mb-0.5">공약을 꼭 클릭해보세요! ✨</p>
                    <p className="text-[10px] text-indigo-600 leading-snug">AI(GPT-4o)가 실현가능성과 핵심 취약점을 분석해 드립니다</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
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
            </div>
          </section>

          {/* ── 커뮤니티 게시판 ── */}
          <section className="bg-white rounded-3xl shadow-sm border border-gray-100/80 overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-indigo-600" />
                </div>
                <h3 className="text-[15px] font-black text-gray-900">커뮤니티 게시판</h3>
              </div>
              <Link href={`/community/write?tagType=candidate&tagId=${decodedId}&tagName=${candidate.name}`}>
                <Button size="sm" className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black rounded-xl px-3 shadow-sm shadow-indigo-200">
                  <PenSquare className="w-3 h-3 mr-1" /> 글쓰기
                </Button>
              </Link>
            </div>
            <div className="p-4">
            {postsLoading ? (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="w-[200px] h-[90px] rounded-2xl shrink-0" />
                ))}
              </div>
            ) : posts && posts.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x">
                {posts.map((post) => (
                  <Link key={post.id} href={`/community/${post.id}`}>
                    <div className="w-[200px] shrink-0 bg-gray-50 hover:bg-indigo-50 border border-gray-100 hover:border-indigo-200 rounded-2xl p-3.5 snap-center transition-all cursor-pointer flex flex-col justify-between h-[90px]">
                      <h4 className="text-[13px] font-bold text-gray-900 line-clamp-2 leading-snug">{post.title}</h4>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold mt-1">
                        <span className="text-gray-600 truncate max-w-[60px]">{post.displayName || "익명"}</span>
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
              <div className="text-[12px] text-gray-400 py-5 bg-gray-50 rounded-2xl text-center border border-dashed border-gray-200">
                아직 등록된 관련 게시물이 없습니다
              </div>
            )}
            </div>
          </section>

          {/* ── 기본 정보 ── */}
          <section className="bg-white rounded-3xl shadow-sm border border-gray-100/80 overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 pt-5 pb-4 border-b border-gray-50">
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                <User className="w-4 h-4 text-slate-600" />
              </div>
              <h3 className="text-[15px] font-black text-gray-900">기본 정보</h3>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2.5">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">선거구</span>
                </div>
                <p className="text-[13px] font-bold text-gray-800 leading-snug">{verification.district || "정보 없음"}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">직업</span>
                </div>
                <p className="text-[13px] font-bold text-gray-800 leading-snug">{verification.job || "정보 없음"}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">학력</span>
                </div>
                <p className="text-[13px] font-bold text-gray-800 leading-snug">{candidate.education || "정보 없음"}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <Star className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">주요 경력</span>
                </div>
                <p className="text-[13px] font-bold text-gray-800 leading-snug whitespace-pre-line">{candidate.career || "정보 없음"}</p>
              </div>
              {verification.candidacy && (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 col-span-2">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Vote className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">공직선거 입후보 경력</span>
                  </div>
                  <p className="text-[13px] font-bold text-gray-800 leading-snug whitespace-pre-line">{verification.candidacy}</p>
                </div>
              )}
            </div>
          </section>

          {/* ── 검증 정보 (재산·병역·세금·전과) ── */}
          <section className="bg-white rounded-3xl shadow-sm border border-gray-100/80 overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 pt-5 pb-4 border-b border-gray-50">
              <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h3 className="text-[15px] font-black text-gray-900 leading-tight">검증 정보</h3>
                <p className="text-[10px] text-gray-400 font-medium">선관위 후보자정보 공식 기준</p>
              </div>
            </div>
            <div className="p-4">
            {!hasVerification ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 rounded-2xl bg-gray-50 border border-dashed border-gray-200">
                <ShieldQuestion className="w-8 h-8 text-gray-300" />
                <p className="text-[14px] font-bold text-gray-700">검증 정보가 아직 등록되지 않았습니다</p>
                <p className="text-[12px] text-gray-400 text-center max-w-xs">재산·병역·세금·전과 등 선관위 후보자정보가 반영되면 자동으로 표시됩니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {/* 재산 */}
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-4 border border-emerald-100 col-span-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <Landmark className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">재산 신고액</span>
                  </div>
                  <p className="text-[18px] font-black text-emerald-800 leading-snug">{verification.property || "정보 없음"}</p>
                </div>
                {/* 병역 */}
                <div className="bg-sky-50 rounded-2xl p-4 border border-sky-100">
                  <div className="flex items-center gap-1.5 mb-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                    <span className="text-[10px] font-black text-sky-700 uppercase tracking-wider">병역</span>
                  </div>
                  <p className="text-[12px] font-bold text-gray-800 leading-snug whitespace-pre-line">{verification.military || "정보 없음"}</p>
                </div>
                {/* 세금 납부 */}
                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Receipt className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider">세금 납부</span>
                  </div>
                  <p className="text-[12px] font-bold text-gray-800 leading-snug whitespace-pre-line">{verification.taxPaid || "정보 없음"}</p>
                </div>
                {/* 세금 체납 */}
                <div className={`rounded-2xl p-4 border ${
                  verification.taxArrears && verification.taxArrears !== "0" && verification.taxArrears !== "없음"
                    ? "bg-rose-50 border-rose-200"
                    : "bg-gray-50 border-gray-100"
                }`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Receipt className="w-3.5 h-3.5 text-rose-500" />
                    <span className="text-[10px] font-black text-rose-600 uppercase tracking-wider">세금 체납</span>
                  </div>
                  <p className={`text-[12px] font-bold leading-snug whitespace-pre-line ${
                    verification.taxArrears && verification.taxArrears !== "0" && verification.taxArrears !== "없음"
                      ? "text-rose-700"
                      : "text-gray-500"
                  }`}>{verification.taxArrears || "없음"}</p>
                </div>
                {/* 전과 기록 */}
                <div className={`rounded-2xl p-4 border col-span-2 ${
                  criminalLines.length > 0 || (verification.criminalText && verification.criminalText !== "없음")
                    ? "bg-rose-50 border-rose-200"
                    : "bg-gray-50 border-gray-100"
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                      criminalLines.length > 0 ? "bg-rose-100" : "bg-gray-100"
                    }`}>
                      <Scale className={`w-3.5 h-3.5 ${criminalLines.length > 0 ? "text-rose-600" : "text-gray-500"}`} />
                    </div>
                    <span className="text-[10px] font-black text-gray-700 uppercase tracking-wider">전과 기록</span>
                    {criminalLines.length > 0 && (
                      <span className="ml-auto text-[10px] font-black text-rose-600 bg-rose-100 px-2 py-0.5 rounded-lg">{criminalLines.length}건</span>
                    )}
                  </div>
                  {criminalLines.length > 0 ? (
                    <ul className="space-y-1.5">
                      {criminalLines.map((line, i) => (
                        <li key={i} className="text-[12px] font-bold text-rose-700 flex items-start gap-2">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                          {line}
                        </li>
                      ))}
                    </ul>
                  ) : verification.criminalText ? (
                    <p className="text-[12px] font-bold text-rose-700 leading-snug whitespace-pre-line">{verification.criminalText}</p>
                  ) : (
                    <p className="text-[13px] font-bold text-emerald-700 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-[8px]">✓</span>
                      전과 기록 없음
                    </p>
                  )}
                </div>
              </div>
            )}
            </div>
          </section>



          {/* ── 활동 이력 ── */}
          {(candidate.pastActivities.length > 0 || candidate.timeline.length > 0) && (
          <section className="bg-white rounded-3xl shadow-sm border border-gray-100/80 overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Star className="w-4 h-4 text-amber-600" />
                </div>
                <h3 className="text-[15px] font-black text-gray-900">주요 활동 이력</h3>
              </div>
              <span className="text-[11px] font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-100">{candidate.pastActivities.length}건</span>
            </div>
            <div className="p-4 space-y-5">
            {candidate.pastActivities.length > 0 && (
              <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {candidate.pastActivities.map((activity: string, i: number) => {
                  const m = activity.match(/^\(([현전前現])\)\s*/);
                  const tag = m?.[1];
                  const body = m ? activity.slice(m[0].length) : activity;
                  const isActive = tag === "현" || tag === "現";
                  return (
                    <li key={i} className={`text-[12px] text-gray-700 flex items-start gap-2 p-3 rounded-xl border ${
                      isActive
                        ? "bg-emerald-50 border-emerald-100"
                        : "bg-gray-50 border-gray-100"
                    }`}>
                      {tag ? (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border shrink-0 mt-0.5 ${
                          isActive
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                            : "bg-gray-100 text-gray-500 border-gray-200"
                        }`}>
                          {tag === "前" ? "전" : tag === "現" ? "현" : tag}
                        </span>
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                      )}
                      <span className="leading-snug">{body}</span>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* 타임라인 */}
            {candidate.timeline.length > 0 && (
              <div>
                <h4 className="text-[13px] font-black text-gray-700 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  활동 타임라인
                </h4>
                <div className="relative pl-5 border-l-2 border-indigo-100 space-y-5 ml-2 max-w-4xl">
                  {candidate.timeline.map((event: { id: string | number; date: string; title: string; description: string }) => (
                    <div key={event.id} className="relative">
                      <span className="absolute -left-[1.65rem] top-1 w-4 h-4 rounded-full bg-indigo-500 border-4 border-white shadow-sm" />
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{event.date}</span>
                        <p className="font-bold text-[13px] text-gray-900">{event.title}</p>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed">{event.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>
          </section>
          )}

          {/* ── 관련 뉴스 ── */}
          <section className="bg-white rounded-3xl shadow-sm border border-gray-100/80 overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Newspaper className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="text-[15px] font-black text-gray-900">관련 뉴스</h3>
              </div>
            </div>
            <div className="p-4 space-y-4">
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
                          src={withApiBase(item.thumbnail)}
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
            </div>
          </section>

          {/* ── 객관 평가 리포트 ── */}
          <section className="bg-white rounded-3xl shadow-sm border border-gray-100/80 overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 pt-5 pb-4 border-b border-gray-50">
              <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h3 className="text-[15px] font-black text-gray-900 leading-tight">AI 객관 평가</h3>
                <p className="text-[10px] text-gray-400 font-medium">GPT-4o 기반 자동 분석</p>
              </div>
            </div>
            <div className="p-4">
              <CandidateEvaluationReport
                candidateName={candidate.name}
                party={candidate.party || undefined}
              />
            </div>
          </section>

        </div>

      </div>
    </motion.div>

    <PledgeDetailView
      candidateId={String(candidate.id)}
      candidateName={candidate.name}
      candidateParty={candidate.party}
      candidateJob={verification.job ?? undefined}
      candidateCareer1={candidate.career ?? undefined}
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
