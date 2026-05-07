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
import { LogIn, UserPlus, Sparkles, ShieldCheck } from "lucide-react";
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
      <AlertDialogContent className="max-w-[420px] rounded-[32px] p-0 border-none shadow-2xl overflow-hidden bg-white/95 backdrop-blur-xl">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="flex flex-col"
            >
              {/* Top Illustration Area */}
              <div className="relative h-[200px] w-full overflow-hidden bg-gradient-to-br from-[#6320EE] to-[#9D72FF]">
                <img 
                  src="/Users/leejeonghan/.gemini/antigravity/brain/68e257b0-306e-4af0-920a-4fd96803d320/login_prompt_illustration_1778073205660.png" 
                  alt="Login Illustration"
                  className="w-full h-full object-cover opacity-80 mix-blend-overlay"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-white/10 to-transparent" />
                <div className="absolute top-6 left-6 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/30">
                  <Sparkles className="w-4 h-4 text-white fill-white" />
                  <span className="text-[11px] font-black text-white uppercase tracking-widest">Premium Feature</span>
                </div>
              </div>

              {/* Content Area */}
              <div className="p-8 space-y-6">
                <AlertDialogHeader className="flex flex-col items-center text-center space-y-3">
                  <AlertDialogTitle className="text-[24px] font-black text-gray-900 tracking-tight leading-tight">
                    {title}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-[15px] text-gray-500 font-medium leading-relaxed px-2">
                    {description}
                  </AlertDialogDescription>
                </AlertDialogHeader>

                {/* Benefit Pills */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-3 p-3.5 bg-gray-50 rounded-2xl border border-gray-100 transition-colors hover:bg-gray-100/50">
                    <div className="w-8 h-8 bg-[#6320EE]/10 rounded-full flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-[#6320EE]" />
                    </div>
                    <span className="text-[13px] font-bold text-gray-700">개인화된 정치인 뉴스 피드</span>
                  </div>
                  <div className="flex items-center gap-3 p-3.5 bg-gray-50 rounded-2xl border border-gray-100 transition-colors hover:bg-gray-100/50">
                    <div className="w-8 h-8 bg-[#6320EE]/10 rounded-full flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4 text-[#6320EE]" />
                    </div>
                    <span className="text-[13px] font-bold text-gray-700">안전한 데이터 보안 및 프라이버시</span>
                  </div>
                </div>

                {/* Actions */}
                <AlertDialogFooter className="flex flex-col sm:flex-col gap-3 pt-4">
                  <AlertDialogAction
                    onClick={() => setLocation("/login")}
                    className="w-full h-14 bg-[#6320EE] hover:bg-[#5218D0] text-white rounded-2xl font-black text-[15px] transition-all shadow-lg shadow-[#6320EE]/20 flex items-center justify-center gap-2 group active:scale-95"
                  >
                    <LogIn className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    3초만에 로그인하기
                  </AlertDialogAction>
                  <AlertDialogCancel 
                    className="w-full h-12 bg-white hover:bg-gray-50 text-gray-400 border-none rounded-2xl font-bold text-[14px] transition-all flex items-center justify-center gap-2"
                  >
                    다음에 할게요
                  </AlertDialogCancel>
                </AlertDialogFooter>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </AlertDialogContent>
    </AlertDialog>
  );
}
