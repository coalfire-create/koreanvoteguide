import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCheck, Star, ChevronDown, ChevronUp, Clock, GraduationCap, Briefcase } from "lucide-react";
import { candidates, getPartyColor, getPartyRank } from "@/lib/mock-data";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useFavorites, type FavoritePerson } from "@/lib/useFavorites";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { MessageCircle, ThumbsUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function CandidatePosts({ candidateId, candidateName }: { candidateId: string, candidateName: string }) {
  const { data: posts, isLoading } = useQuery<any[]>({
    queryKey: ["/api/community/posts", "candidate", candidateId],
    queryFn: () => apiRequest("GET", `/api/community/posts?tagType=candidate&tagId=${candidateId}`).then((r) => r.json()),
  });

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide mb-4">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="w-[200px] h-[80px] rounded-xl shrink-0" />
        ))}
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2 px-1">
        <h4 className="text-[12px] font-black text-gray-900 flex items-center gap-1.5">
          <MessageCircle className="w-3.5 h-3.5 text-primary" />
          국회의원 게시판
        </h4>
        <Link href={`/community/write?tagType=candidate&tagId=${candidateId}&tagName=${candidateName}`}>
          <span className="text-[11px] font-bold text-primary hover:underline cursor-pointer flex items-center gap-1">
             토론하기
          </span>
        </Link>
      </div>

      {!posts || posts.length === 0 ? (
        <div className="text-[11px] text-gray-400 py-3 bg-muted/30 rounded-xl text-center border border-dashed border-gray-100">
          아직 등록된 게시물이 없습니다.
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x">
          {posts.map((post) => (
            <Link key={post.id} href={`/community/${post.id}`}>
              <div className="w-[200px] shrink-0 bg-white border border-gray-200 rounded-xl p-3 snap-center hover:border-primary/50 transition-colors cursor-pointer flex flex-col justify-between h-[80px]">
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
      )}
    </div>
  );
}


function CandidateCard({
  candidate,
  isFavorite,
  addFavorite,
  removeFavorite,
}: {
  candidate: typeof candidates[0];
  isFavorite: (id: string) => boolean;
  addFavorite: (person: FavoritePerson) => void;
  removeFavorite: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();



  return (
    <Card className="hover-elevate" data-testid={`card-candidate-${candidate.id}`}>
      <CardContent className="p-5 relative">
        {/* ⭐ 즐겨찾기 버튼 — 카드 우상단 */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isFavorite(candidate.id)) {
              removeFavorite(candidate.id);
            } else {
              addFavorite({
                id: candidate.id,
                name: candidate.name,
                type: "candidate",
                imageUrl: candidate.imageUrl,
              });
            }
          }}
          className="absolute top-4 right-4 z-10 p-1 rounded-full hover:bg-yellow-50 transition-colors"
          aria-label={isFavorite(candidate.id) ? "즐겨찾기 해제" : "즐겨찾기 추가"}
          data-testid={`btn-favorite-${candidate.id}`}
        >
          <Star
            className={`w-5 h-5 transition-colors ${
              isFavorite(candidate.id)
                ? "fill-yellow-400 text-yellow-400"
                : "fill-none text-gray-300 hover:text-gray-400"
            }`}
          />
        </button>
        <div className="flex items-start gap-4 mb-4">
          <div className="w-14 h-14 rounded-full overflow-hidden shrink-0">
            <PoliticianPhoto
              name={candidate.name}
              photo={candidate.photo || (candidate as any).imageUrl}
              monaCd={candidate.id}
              avatarClassName="w-full h-full flex items-center justify-center bg-muted text-lg font-bold"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-lg" data-testid={`text-candidate-name-${candidate.id}`}>{candidate.name}</h3>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <Badge variant="secondary" className="text-xs">
                <span className={`w-2 h-2 rounded-full mr-1.5 ${getPartyColor(candidate.party)}`} />
                {candidate.party}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {candidate.electionType === "presidential" ? "대통령선거" : "지방선거"}
              </Badge>
            </div>
          </div>
        </div>

        <CandidatePosts candidateId={String(candidate.id)} candidateName={candidate.name} />

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-primary/5 dark:bg-primary/10 rounded-lg p-3 border border-primary/10">
            <div className="flex items-center gap-2 mb-1">
              <GraduationCap className="w-4 h-4 text-primary" />
              <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">학력</span>
            </div>
            <p className="text-sm font-medium line-clamp-1">{candidate.education || "정보 없음"}</p>
          </div>
          <div className="bg-primary/5 dark:bg-primary/10 rounded-lg p-3 border border-primary/10">
            <div className="flex items-center gap-2 mb-1">
              <Briefcase className="w-4 h-4 text-primary" />
              <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">주요 경력</span>
            </div>
            <p className="text-sm font-medium line-clamp-1">{candidate.career || "정보 없음"}</p>
          </div>
        </div>

        <div className="mb-4">
          <h4 className="font-semibold text-sm mb-2">핵심 공약</h4>
          <div className="space-y-2">
            {candidate.promises.map((promise) => (
              <div key={promise.id} className="bg-muted/50 dark:bg-muted/30 rounded-md p-3">
                <p className="font-medium text-sm">{promise.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{promise.description}</p>
              </div>
            ))}
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="w-full"
          data-testid={`button-expand-${candidate.id}`}
        >
          {expanded ? (
            <>접기 <ChevronUp className="w-4 h-4 ml-1" /></>
          ) : (
            <>상세 보기 <ChevronDown className="w-4 h-4 ml-1" /></>
          )}
        </Button>

        {expanded && (
          <div className="mt-4 space-y-4">
            <div>
              <h4 className="font-semibold text-sm mb-2">주요 경력</h4>
              <ul className="space-y-1">
                {candidate.pastActivities.map((activity, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    {activity}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-2">활동 타임라인</h4>
              <div className="space-y-3">
                {candidate.timeline.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 relative">
                    <div className="mt-0.5">
                      <Clock className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{event.title}</p>
                        <span className="text-xs text-muted-foreground">{event.date}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}

export default function Candidates() {
  const presidential = candidates
    .filter((c) => c.electionType === "presidential")
    .sort((a, b) => getPartyRank(a.party) - getPartyRank(b.party));
  const local = candidates
    .filter((c) => c.electionType === "local")
    .sort((a, b) => getPartyRank(a.party) - getPartyRank(b.party));
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <UserCheck className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title-candidates">후보자</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          선거 후보자의 공약과 이력을 확인하세요
        </p>
      </div>

      <Tabs defaultValue="presidential">
        <TabsList className="mb-6">
          <TabsTrigger value="presidential" data-testid="tab-presidential">대통령선거</TabsTrigger>
          <TabsTrigger value="local" data-testid="tab-local">지방선거</TabsTrigger>
        </TabsList>

        <TabsContent value="presidential">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {presidential.map((c) => (
              <CandidateCard key={c.id} candidate={c} isFavorite={isFavorite} addFavorite={addFavorite} removeFavorite={removeFavorite} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="local">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {local.map((c) => (
              <CandidateCard key={c.id} candidate={c} isFavorite={isFavorite} addFavorite={addFavorite} removeFavorite={removeFavorite} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
