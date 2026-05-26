import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Vote, CheckCircle2, Trophy, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface DailyPollOption {
  id: string;
  label: string;
}

interface DailyPollData {
  poll: {
    id: string;
    date: string;
    title: string;
    description: string;
    options: DailyPollOption[];
  } | null;
  userVote: string | null;
  results: Record<string, number>;
  totalVotes: number;
}

export function DailyPollWidget() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isVoting, setIsVoting] = useState(false);

  const { data, isLoading } = useQuery<DailyPollData>({
    queryKey: ["/api/daily-polls/today"],
    queryFn: () => apiRequest("GET", "/api/daily-polls/today").then(res => res.json()),
  });

  const voteMutation = useMutation({
    mutationFn: async (optionId: string) => {
      if (!data?.poll) throw new Error("No active poll");
      const res = await apiRequest("POST", `/api/daily-polls/${data.poll.id}/vote`, { optionId });
      return res.json();
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-polls/today"] });
      // update auth user query to get fresh EXP
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      toast({
        title: "투표 완료!",
        description: `포인트 +${resData.reward}P 획득하셨습니다.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "투표 실패",
        description: err.message || "오류가 발생했습니다.",
        variant: "destructive",
      });
    },
    onSettled: () => setIsVoting(false)
  });

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-5 shadow-sm animate-pulse flex flex-col gap-3">
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="h-6 w-full bg-muted rounded" />
        <div className="h-10 w-full bg-muted rounded mt-2" />
        <div className="h-10 w-full bg-muted rounded" />
      </div>
    );
  }

  if (!data?.poll) return null;

  const { poll, userVote, results, totalVotes } = data;

  const handleVote = (optionId: string) => {
    if (!user) {
      toast({
        title: "로그인이 필요합니다",
        description: "투표하고 포인트를 받으려면 로그인해주세요.",
      });
      setLocation("/login");
      return;
    }
    
    if (userVote || isVoting) return;
    
    setIsVoting(true);
    voteMutation.mutate(optionId);
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-5 shadow-sm relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl" />
      <div className="absolute -left-8 -bottom-8 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl" />
      
      <div className="relative z-10 flex flex-col gap-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <div className="bg-indigo-600 text-white p-1 rounded-md">
              <Vote className="w-3.5 h-3.5" />
            </div>
            <span className="text-[12px] font-black text-indigo-700 dark:text-indigo-400">오늘의 투표</span>
          </div>
          {userVote && (
             <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
               <Trophy className="w-3 h-3 text-amber-500" /> +50P
             </span>
          )}
        </div>

        <div>
          <h3 className="text-[16px] font-bold text-slate-900 dark:text-white leading-snug break-keep">
            {poll.title}
          </h3>
          {poll.description && (
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{poll.description}</p>
          )}
        </div>

        <div className="flex flex-col gap-2 mt-2">
          {poll.options.map((opt) => {
            const hasVoted = !!userVote;
            const isSelected = userVote === opt.id;
            const voteCount = results[opt.id] || 0;
            const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
            
            return (
              <button
                key={opt.id}
                onClick={() => handleVote(opt.id)}
                disabled={hasVoted || isVoting}
                className={`relative w-full h-11 flex items-center justify-between px-4 rounded-xl border transition-all overflow-hidden ${
                  hasVoted
                    ? isSelected
                      ? "border-indigo-300 bg-indigo-50 dark:bg-indigo-900/40 dark:border-indigo-700/50"
                      : "border-slate-200 bg-white/50 dark:bg-white/5 dark:border-white/10"
                    : "border-white bg-white dark:bg-white/10 dark:border-white/20 hover:border-indigo-200 hover:shadow-md"
                }`}
              >
                {/* Result Bar */}
                {hasVoted && (
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={`absolute left-0 top-0 bottom-0 ${
                      isSelected ? "bg-indigo-100 dark:bg-indigo-900/60" : "bg-slate-100 dark:bg-slate-800/60"
                    }`}
                  />
                )}
                
                <div className="relative z-10 flex items-center gap-2">
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                  <span className={`text-[14px] font-bold ${
                    isSelected ? "text-indigo-900 dark:text-indigo-100" : "text-slate-700 dark:text-slate-300"
                  }`}>
                    {opt.label}
                  </span>
                </div>
                
                {hasVoted && (
                  <div className="relative z-10 text-[13px] font-black text-slate-700 dark:text-slate-300">
                    {percentage}%
                  </div>
                )}
              </button>
            );
          })}
        </div>
        
        {hasVoted && (
          <div className="text-right mt-1">
            <span className="text-[10px] text-slate-400">총 {totalVotes.toLocaleString()}명 참여</span>
          </div>
        )}
      </div>
    </div>
  );
}
