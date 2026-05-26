import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLocation } from "wouter";
import { LogIn, Sparkles, ShieldCheck, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LoginPromptProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}

export function LoginPrompt({ 
  isOpen, 
  onClose, 
  title = "로그인이 필요한 기능입니다", 
  description = "관심 있는 의원을 팔로우하고 나만의 맞춤형 피드를 만들어보세요."
}: LoginPromptProps) {
  const [, setLocation] = useLocation();

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-[420px] rounded-[32px] p-0 border border-white/20 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.3)] overflow-hidden bg-transparent">
        {/* Dynamic Background Blurs */}
        <div className="absolute inset-0 bg-white/70 dark:bg-black/60 backdrop-blur-3xl z-0" />
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-purple-500/30 rounded-full blur-3xl z-0" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-500/30 rounded-full blur-3xl z-0" />

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative z-10 flex flex-col"
            >
              {/* Top Illustration Area */}
              <div className="relative h-[220px] w-full overflow-hidden bg-black">
                <motion.img 
                  initial={{ scale: 1.1, opacity: 0 }}
                  animate={{ scale: 1, opacity: 0.8 }}
                  transition={{ duration: 2, ease: "easeOut" }}
                  src="/assets/login_premium.png" 
                  alt="Login Illustration"
                  className="w-full h-full object-cover mix-blend-screen"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                
                {/* Floating Elements for Dynamism */}
                <motion.div 
                  animate={{ y: [0, -10, 0], rotate: [0, 5, 0] }} 
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute top-8 left-8 w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-xl"
                >
                  <Sparkles className="w-6 h-6 text-purple-300" />
                </motion.div>
              </div>

              {/* Content Area */}
              <div className="p-8 pt-4 space-y-8">
                <AlertDialogHeader className="flex flex-col items-center text-center space-y-3">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <AlertDialogTitle className="text-[26px] font-black text-foreground tracking-tight leading-[1.3]">
                      {title}
                    </AlertDialogTitle>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <AlertDialogDescription className="text-[15px] text-muted-foreground font-medium leading-relaxed max-w-[300px]">
                      {description}
                    </AlertDialogDescription>
                  </motion.div>
                </AlertDialogHeader>

                {/* Benefit Pills */}
                <div className="flex flex-col gap-3">
                  {[
                    { icon: Sparkles, text: "개인화된 정치인 뉴스 피드", gradient: "from-purple-500 to-indigo-500" },
                    { icon: ShieldCheck, text: "안전한 데이터 보안 및 프라이버시", gradient: "from-indigo-500 to-blue-500" }
                  ].map((benefit, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + (i * 0.1) }}
                      className="flex items-center gap-4 p-4 bg-white/40 dark:bg-white/5 backdrop-blur-md rounded-2xl border border-white/40 dark:border-white/10 transition-all hover:bg-white/60 dark:hover:bg-white/10 hover:shadow-lg hover:-translate-y-0.5 group cursor-default"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${benefit.gradient} shadow-inner transition-transform group-hover:scale-110 group-hover:rotate-3`}>
                        <benefit.icon className="w-5 h-5 text-white drop-shadow-md" />
                      </div>
                      <span className="text-[14px] font-bold text-foreground tracking-tight">{benefit.text}</span>
                    </motion.div>
                  ))}
                </div>

                {/* Actions */}
                <AlertDialogFooter className="flex flex-col gap-3 pt-2">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="w-full relative group"
                  >
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500" />
                    <AlertDialogAction
                      onClick={() => setLocation("/login")}
                      className="relative w-full h-14 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl font-black text-[16px] transition-all flex items-center justify-center gap-2 active:scale-[0.98] border-none"
                    >
                      3초만에 로그인하기
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </AlertDialogAction>
                  </motion.div>
                  
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="w-full"
                  >
                    <AlertDialogCancel 
                      className="w-full h-12 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground border-none rounded-xl font-bold text-[14px] transition-all flex items-center justify-center"
                    >
                      다음에 할게요
                    </AlertDialogCancel>
                  </motion.div>
                </AlertDialogFooter>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </AlertDialogContent>
    </AlertDialog>
  );
}

