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
      <AlertDialogContent className="max-w-[440px] rounded-[40px] p-0 border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] overflow-hidden bg-white/90 backdrop-blur-2xl">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", damping: 20, stiffness: 200 }}
              className="flex flex-col"
            >
              {/* Top Illustration Area */}
              <div className="relative h-[240px] w-full overflow-hidden">
                <motion.img 
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  src="/assets/login_premium.png" 
                  alt="Login Illustration"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              </div>

              {/* Content Area */}
              <div className="p-10 pt-8 space-y-8">
                <AlertDialogHeader className="flex flex-col items-center text-center space-y-4">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <AlertDialogTitle className="text-[28px] font-black text-gray-900 tracking-tight leading-[1.2]">
                      {title}
                    </AlertDialogTitle>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <AlertDialogDescription className="text-[16px] text-gray-500 font-medium leading-relaxed max-w-[320px]">
                      {description}
                    </AlertDialogDescription>
                  </motion.div>
                </AlertDialogHeader>

                {/* Benefit Pills */}
                <div className="flex flex-col gap-3">
                  {[
                    { icon: Sparkles, text: "개인화된 정치인 뉴스 피드", color: "bg-[#6D28D9]" },
                    { icon: ShieldCheck, text: "안전한 데이터 보안 및 프라이버시", color: "bg-[#6D28D9]" }
                  ].map((benefit, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + (i * 0.1) }}
                      className="flex items-center gap-4 p-4 bg-gray-50/50 rounded-2xl border border-gray-100/80 transition-all hover:bg-white hover:shadow-md hover:border-transparent group cursor-default"
                    >
                      <div className={`w-10 h-10 ${benefit.color}/10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110`}>
                        <benefit.icon className={`w-5 h-5 text-[#6D28D9]`} />
                      </div>
                      <span className="text-[14px] font-bold text-gray-700 tracking-tight">{benefit.text}</span>
                    </motion.div>
                  ))}
                </div>

                {/* Actions */}
                <AlertDialogFooter className="flex flex-col sm:flex-col gap-4 pt-4">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="w-full"
                  >
                    <AlertDialogAction
                      onClick={() => setLocation("/login")}
                      className="w-full h-16 bg-[#6D28D9] hover:bg-[#5B21B6] text-white rounded-[20px] font-black text-[16px] transition-all shadow-[0_12px_24px_-8px_rgba(109,40,217,0.4)] flex items-center justify-center gap-3 group active:scale-[0.98]"
                    >
                      3초만에 로그인하기
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </AlertDialogAction>
                  </motion.div>
                  
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.9 }}
                    className="w-full"
                  >
                    <AlertDialogCancel 
                      className="w-full h-12 bg-transparent hover:bg-gray-100/50 text-gray-400 border-none rounded-xl font-bold text-[14px] transition-all flex items-center justify-center"
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

