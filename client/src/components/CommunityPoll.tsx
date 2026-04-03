import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, PieChart } from "lucide-react";
import { motion } from "framer-motion";

interface PollOption {
  id: number;
  label: string;
  votes: number;
}

export function CommunityPoll() {
  const [options, setOptions] = useState<PollOption[]>([
    { id: 1, label: "강력하게 찬성한다", votes: 142 },
    { id: 2, label: "조건부로 찬성한다", votes: 89 },
    { id: 3, label: "반대한다", votes: 215 },
    { id: 4, label: "잘 모르겠다", votes: 34 },
  ]);
  const [votedId, setVotedId] = useState<number | null>(null);

  const totalVotes = options.reduce((acc, opt) => acc + opt.votes, 0) + (votedId ? 1 : 0);

  const handleVote = (id: number) => {
    if (votedId !== null) return;
    setVotedId(id);
  };

  return (
    <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <PieChart className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-base">🔥 금주의 핫 이슈 투표</h2>
        </div>
        <p className="text-sm font-semibold text-foreground mb-4">
          "국회의원 무노동 무임금 법안" 도입에 대해 어떻게 생각하시나요?
        </p>
        
        <div className="space-y-2.5">
          {options.map((option) => {
            const isVoted = votedId === option.id;
            const optionVotes = option.votes + (isVoted ? 1 : 0);
            const percentage = votedId ? Math.round((optionVotes / totalVotes) * 100) : 0;
            
            return (
              <button
                key={option.id}
                onClick={() => handleVote(option.id)}
                disabled={votedId !== null}
                className="w-full relative overflow-hidden rounded-xl border border-border bg-white text-left transition-all hover:border-primary/50 group"
              >
                {/* Progress bar background (only shows after vote) */}
                {votedId !== null && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={`absolute inset-y-0 left-0 opacity-20 ${
                      isVoted ? "bg-primary" : "bg-muted-foreground"
                    }`}
                  />
                )}
                
                <div className="relative p-3 flex items-center justify-between z-10">
                  <span className={`text-sm font-medium ${isVoted ? "text-primary font-bold" : ""}`}>
                    {option.label}
                  </span>
                  
                  {votedId !== null && (
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${isVoted ? "text-primary" : "text-muted-foreground"}`}>
                        {percentage}%
                      </span>
                      {isVoted && <CheckCircle2 className="w-4 h-4 text-primary" />}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        
        {votedId !== null ? (
          <p className="text-xs text-muted-foreground mt-4 text-center animate-pulse">
            총 {totalVotes.toLocaleString()}명 참여 중
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-4 text-center">
            투표하면 결과를 볼 수 있습니다
          </p>
        )}
      </CardContent>
    </Card>
  );
}
