import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Flame, ThumbsUp, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface PollOption { id: number; label: string; }
interface Poll {
  id: string;
  board: string;
  question: string;
  options: PollOption[];
  votes: Record<number, number>;
  hasVoted: boolean;
}

interface DailyPollProps {
  board: string;
}

export function DailyPoll({ board }: DailyPollProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [optimisticVote, setOptimisticVote] = useState<number | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");

  const { data: poll, isLoading } = useQuery<Poll>({
    queryKey: ["/api/polls/today", board],
    queryFn: () => fetch(`/api/polls/today?board=${board}`).then(r => r.json()),
    staleTime: 60 * 1000,
  });

  const { data: reactionsData } = useQuery({
    queryKey: ["/api/reactions", "poll", poll?.id],
    queryFn: () => fetch(`/api/reactions?targetType=poll&targetId=${poll!.id}`).then(r => r.json()),
    enabled: !!poll,
  });

  const { data: comments } = useQuery({
    queryKey: ["/api/poll-comments", poll?.id],
    queryFn: () => fetch(`/api/poll-comments?pollId=${poll!.id}`).then(r => r.json()),
    enabled: !!poll && showComments,
  });

  const voteMutation = useMutation({
    mutationFn: async (optionId: number) => {
      const res = await apiRequest("POST", `/api/polls/${encodeURIComponent(poll!.id)}/vote`, { optionId });
      return res.json();
    },
    onMutate: (optionId) => {
      setOptimisticVote(optionId);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/polls/today", board], data);
    },
    onError: () => {
      setOptimisticVote(null);
    }
  });

  const { toast } = useToast();

  const reactMutation = useMutation({
    mutationFn: async (type: string) => {
      let sId = localStorage.getItem('poll_session_id');
      if (!sId) {
        sId = Math.random().toString(36).substring(2, 15);
        localStorage.setItem('poll_session_id', sId);
      }
      const res = await apiRequest("POST", `/api/reactions`, { targetType: "poll", targetId: poll!.id, type, sessionId: sId });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "반응 처리 중 오류가 발생했습니다.");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reactions", "poll", poll?.id] });
      toast({ title: "투표 🗳️", description: "소중한 공감이 반영되었습니다!", duration: 2000 });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "공감 오류", description: error.message, duration: 2000 });
    }
  });

  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/poll-comments`, { pollId: poll!.id, content, authorType: "anonymous" });
      return res.json();
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["/api/poll-comments", poll?.id] });
    },
  });

  if (isLoading || !poll) return null;

  const hasVoted = poll.hasVoted || optimisticVote !== null;
  const votedId = optimisticVote;
  
  const totalVotes = Object.values(poll.votes).reduce((a, b) => a + b, 0)
    + (optimisticVote !== null ? 1 : 0);

  const getVoteCount = (optId: number) => {
    const base = poll.votes[optId] ?? 0;
    if (optimisticVote === optId) return base + 1;
    return base;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="bg-card rounded-[1.5rem] shadow-sm border border-border/40 overflow-hidden m-4"
    >
      <div className="bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/50 p-5 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <motion.div 
            initial={{ scale: 0.8, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
            className="flex items-center gap-1.5 bg-orange-100/80 px-2 py-1 rounded-full border border-orange-200/60"
          >
            <Flame className="w-3.5 h-3.5 text-orange-600" />
            <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest pl-0.5 pr-1">Today's Poll</span>
          </motion.div>
          {hasVoted && (
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="ml-auto text-[11px] text-indigo-600/80 font-bold bg-indigo-50/50 px-2 py-1 rounded-full"
            >
              참여 {totalVotes.toLocaleString()}명
            </motion.span>
          )}
        </div>
        
        <h3 className="text-[16px] font-extrabold text-slate-900 mb-4 leading-snug tracking-tight">
          {poll.question}
        </h3>
        
        <div className="space-y-2.5">
          {poll.options.map((option, index) => {
            const count = getVoteCount(option.id);
            const pct = hasVoted && totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            
            return (
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 + 0.2 }}
                key={option.id}
                onClick={() => !hasVoted && voteMutation.mutate(option.id)}
                disabled={hasVoted || voteMutation.isPending}
                className={`w-full relative overflow-hidden rounded-xl border text-left transition-all duration-300 ${
                  hasVoted
                    ? "cursor-default"
                    : "hover:border-indigo-400 hover:shadow-md hover:shadow-indigo-500/10 active:scale-[0.98]"
                } ${optimisticVote === option.id ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500/20" : "border-slate-200 bg-white"}`}
              >
                {hasVoted && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                    className={`absolute inset-y-0 left-0 ${
                      optimisticVote === option.id 
                        ? "bg-gradient-to-r from-indigo-500/20 to-indigo-400/10" 
                        : "bg-slate-100/80"
                    }`}
                  />
                )}
                <div className="relative pt-3 pb-3 px-4 flex items-center justify-between z-10">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {hasVoted ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, delay: 0.2 }}
                      >
                        <CheckCircle2 className={`w-4 h-4 shrink-0 ${optimisticVote === option.id ? "text-indigo-600" : "text-slate-300"}`} />
                      </motion.div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-slate-200 shrink-0 group-hover:border-indigo-300 transition-colors" />
                    )}
                    <span className={`text-[14px] font-semibold truncate ${
                      optimisticVote === option.id ? "text-indigo-800 font-extrabold" : "text-slate-700"
                    }`}>
                      {option.label}
                    </span>
                  </div>
                  {hasVoted && (
                    <motion.span 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className={`text-[13px] font-black shrink-0 ml-3 ${
                        optimisticVote === option.id ? "text-indigo-600" : "text-slate-400"
                      }`}
                    >
                      {pct}%
                    </motion.span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
        
        {!hasVoted && (
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-[11px] font-bold text-slate-400 mt-3 text-center tracking-wide"
          >
            투표하면 다수의 의견을 확인할 수 있습니다
          </motion.p>
        )}
      </div>

      <div className="bg-white px-4 py-3 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => reactMutation.mutate("like")}
            className={`flex items-center gap-1.5 text-[12px] font-extrabold transition-colors ${reactionsData?.myReaction === 'like' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <ThumbsUp className={`w-4 h-4 ${reactionsData?.myReaction === 'like' ? 'fill-primary text-primary' : ''}`} /> 
            공감 {reactionsData?.counts?.like || 0}
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowComments(!showComments)}
            className={`flex items-center gap-1.5 text-[12px] font-extrabold transition-colors ${showComments ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <MessageCircle className={`w-4 h-4 ${showComments ? 'fill-indigo-100' : ''}`} /> 
            댓글 {comments ? comments.length : ''}
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {showComments && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-slate-50 border-t border-slate-100"
          >
            <div className="p-4">
              <div className="flex gap-2 mb-4">
                <Textarea 
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={user ? "다양한 의견을 존중하며 자유롭게 남겨주세요." : "비로그인 상태에서는 익명으로 작성됩니다."}
                  disabled={commentMutation.isPending}
                  className="min-h-[44px] max-h-[100px] text-[13px] resize-none bg-white font-medium focus-visible:ring-indigo-500/20 border-slate-200 rounded-xl shadow-sm"
                  rows={1}
                />
                <Button 
                  size="sm" 
                  onClick={() => commentMutation.mutate(commentText)}
                  disabled={!commentText.trim() || commentMutation.isPending}
                  className="shrink-0 h-[44px] font-black rounded-xl shadow-sm bg-slate-900 hover:bg-slate-800 text-white"
                >
                  등록
                </Button>
              </div>
              
              {comments && comments.length > 0 && (
                <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1 pb-1">
                  {comments.map((c: any, i: number) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      key={c.id} 
                      className="flex gap-3 bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm"
                    >
                      <div className="w-[30px] h-[30px] rounded-[0.6rem] bg-gradient-to-tr from-slate-100 to-slate-200 border border-slate-200/60 flex items-center justify-center shrink-0 shadow-inner">
                        <span className="text-[11px] font-black text-slate-500">
                          {c.authorType === "realname" ? "실명" : c.authorType === "nickname" ? "닉" : "익"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="text-[12px] font-extrabold text-slate-800">{c.displayName || "익명의 유권자"}</span>
                          {c.authorType === "realname" && <span className="bg-teal-50 text-teal-600 text-[9px] px-1.5 py-0.5 font-bold rounded flex items-center gap-0.5 border border-teal-100"><CheckCircle2 className="w-2.5 h-2.5"/> 인증됨</span>}
                          <span className="text-[10px] text-slate-400 font-medium ml-auto tracking-wide">
                            {new Date(c.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        <p className="text-[13px] text-slate-600 leading-snug font-medium break-words">{c.content}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
              {comments && comments.length === 0 && (
                <div className="py-6 text-center text-slate-400">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-300">
                    <MessageCircle className="w-5 h-5 mx-auto" />
                  </div>
                  <p className="text-[12px] font-medium tracking-wide">가장 먼저 의견을 남겨보세요!</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
