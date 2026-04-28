import { X, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { useAssemblyMembers } from "@/lib/api-data";
import { candidates, getPartyColor, getScoreGrade } from "@/lib/mock-data";

interface FavoriteMiniCardProps {
  personId: string;
  type: "member" | "candidate";
  onClose: () => void;
}

export function FavoriteMiniCard({ personId, type, onClose }: FavoriteMiniCardProps) {
  const [, setLocation] = useLocation();
  const { members, isLoading } = useAssemblyMembers();
  
  // 데이터 찾기
  let person: any = null;
  if (type === "member") {
    person = members.find((m) => m.id === personId);
  } else {
    person = candidates.find((c) => c.id === personId);
  }

  const handleGoProfile = () => {
    if (type === "member") {
      setLocation(`/members/${personId}`);
    } else {
      setLocation(`/candidates/${personId}`);
    }
    onClose();
  };

  const isDataLoading = isLoading && type === "member" && !person;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/30 z-40" 
        onClick={onClose}
        aria-label="카드 닫기"
      />
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl p-5 z-50 transform translate-y-0 transition-transform duration-300 max-h-[60vh] overflow-y-auto">
        <div className="flex justify-end mb-2">
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {isDataLoading ? (
          <div className="space-y-4 animate-pulse pt-2">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gray-200 rounded-full shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-5 bg-gray-200 rounded w-1/2" />
                <div className="h-4 bg-gray-200 rounded w-1/3" />
              </div>
            </div>
            <div className="border-t my-4" />
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded w-full" />
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-5/6" />
            </div>
            <div className="border-t my-4" />
            <div className="h-10 bg-gray-200 rounded w-full" />
          </div>
        ) : !person ? (
          <div className="text-center py-6 text-gray-500">
            데이터를 찾을 수 없습니다.
          </div>
        ) : (
          <div>
            {/* 1. 프로필 헤더 */}
            <div className="flex items-start gap-4 mb-5">
              {person.photo || person.imageUrl ? (
                <img 
                  src={person.photo || person.imageUrl} 
                  alt={person.name} 
                  className="w-16 h-16 rounded-full object-cover border border-gray-100 shadow-sm shrink-0" 
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200 shadow-sm flex items-center justify-center text-xl font-bold text-gray-400 shrink-0">
                  {person.name.charAt(0)}
                </div>
              )}
              
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-lg tracking-tight truncate">{person.name}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border opacity-80 uppercase tracking-widest ${getPartyColor(person.party).replace('bg-', 'text-').replace('text-white', '')} border-current`}>
                    {person.party}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {type === "member" 
                    ? `${person.district} · ${person.electedYear}년 당선` 
                    : (person.electionType === "presidential" ? "대통령선거" : "지방선거")}
                </p>
              </div>
            </div>

            {/* 2. 스코어 라인 (의원인 경우에만) */}
            {type === "member" && person.score && (
              <>
                <div className="border-t border-gray-100 my-4" />
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-gray-600">출석률</span>
                      <span className="font-bold">{person.score.attendanceRate}%</span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full" 
                        style={{ width: `${person.score.attendanceRate}%` }} 
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-600">대표발의 법안</span>
                    <span className="font-bold">{person.score.billProposalCount}건</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-600">종합평가</span>
                    <span className="font-black text-blue-600 tracking-tighter">
                      {getScoreGrade(person.score.totalScore)}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* 후보자용 대체 정보 (간략히) */}
            {type === "candidate" && (
              <>
                <div className="border-t border-gray-100 my-4" />
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <p className="text-xs text-gray-600">{person.background}</p>
                  </div>
                  {person.promises && person.promises.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <p className="text-xs text-gray-600 line-clamp-2">핵심공약: {person.promises[0]?.title}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="border-t border-gray-100 my-4" />

            {/* 3. 전체 프로필 보기 버튼 */}
            <button
              onClick={handleGoProfile}
              className="w-full py-3.5 bg-gray-50 hover:bg-gray-100 text-sm font-semibold rounded-xl text-gray-700 flex items-center justify-center transition-colors group"
            >
              전체 프로필 보기
              <ArrowRight className="w-4 h-4 ml-1.5 text-gray-400 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
