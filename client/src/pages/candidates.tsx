import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCheck, Star, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { candidates, getPartyColor } from "@/lib/mock-data";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useFavorites, type FavoritePerson } from "@/lib/useFavorites";

function StarRating({ rating, onRate, disabled }: { rating: number; onRate: (r: number) => void; disabled: boolean }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          className="p-0.5 disabled:cursor-not-allowed"
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onRate(star)}
          data-testid={`button-star-${star}`}
        >
          <Star
            className={`w-5 h-5 transition-colors ${
              star <= (hover || rating)
                ? "fill-amber-400 text-amber-400"
                : "text-gray-300 dark:text-gray-600"
            }`}
          />
        </button>
      ))}
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
  const [userRating, setUserRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const avgRating = candidate.ratings.length > 0
    ? candidate.ratings.reduce((a, b) => a + b, 0) / candidate.ratings.length
    : 0;

  const handleRate = async (rating: number) => {
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/candidates/rate", {
        candidateId: candidate.id,
        rating,
      });
      setUserRating(rating);
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      toast({ title: "평가 완료", description: `${candidate.name} 후보에게 ${rating}점을 부여했습니다` });
    } catch {
      setUserRating(rating);
      toast({ title: "평가 완료", description: `${candidate.name} 후보에게 ${rating}점을 부여했습니다` });
    } finally {
      setSubmitting(false);
    }
  };

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
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-lg font-bold shrink-0">
            {candidate.name.charAt(0)}
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
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1 justify-end">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="font-bold" data-testid={`text-avg-rating-${candidate.id}`}>{avgRating.toFixed(1)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">{candidate.ratings.length}명 평가</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{candidate.background}</p>

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

        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-muted-foreground">시민 평가</p>
            <StarRating rating={userRating} onRate={handleRate} disabled={submitting} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Candidates() {
  const presidential = candidates.filter((c) => c.electionType === "presidential");
  const local = candidates.filter((c) => c.electionType === "local");
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <UserCheck className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title-candidates">후보자</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          선거 후보자의 공약, 이력, 시민 평가를 확인하세요
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
