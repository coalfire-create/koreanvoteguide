import { useState } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, User, Phone, Lock, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";

export default function AuthPage() {
  const { user } = useAuth();
  const [, nav] = useLocation();
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

  if (user) {
    nav("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* 백그라운드 데코레이션 그라데이션 */}
      <div className="absolute top-0 left-0 right-0 h-[45vh] bg-gradient-to-br from-indigo-600 via-primary to-indigo-800 rounded-b-[3.5rem] shadow-2xl z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.05] mix-blend-overlay" />
        <motion.div 
          animate={{ scale: [1, 1.1, 1], rotate: [0, 5, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" 
        />
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: [0, -5, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-20 -left-20 w-80 h-80 bg-red-400/10 rounded-full blur-3xl" 
        />
      </div>
      
      {/* 헤더 네비게이션 */}
      <div className="relative z-10 p-5 flex items-center mb-4">
        <Link href="/">
          <button className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
      </div>

      <div className="relative z-10 px-6 max-w-md mx-auto w-full flex-1 flex flex-col pt-2">
        {/* 타이틀 영역 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-white mb-8 px-2"
        >
          <motion.div 
            whileHover={{ scale: 1.05, rotate: 2 }}
            whileTap={{ scale: 0.95 }}
            className="w-16 h-16 rounded-[1.25rem] bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-xl flex items-center justify-center mb-6 shadow-xl border border-white/30"
          >
            <span className="text-white font-black text-3xl tracking-tighter drop-shadow-md">I</span>
          </motion.div>
          <h1 className="text-[32px] font-black tracking-tight mb-2 leading-tight">Iyu</h1>
          <p className="text-white/80 font-semibold text-[15px] tracking-tight">당신의 소중한 투표를 위한<br />데이터 기반 가이드</p>
        </motion.div>

        {/* 메인 폼 카드 */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-[2rem] p-6 shadow-2xl shadow-primary/10 border border-border/50 flex-1 flex flex-col mb-10"
        >
          {/* 탭 컨트롤러 (iOS Segmented Control 스타일) */}
          <div className="flex p-1 bg-slate-100/80 rounded-2xl mb-8 relative z-10">
            <button
              onClick={() => setActiveTab("login")}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-300 relative z-20 ${activeTab === "login" ? "text-primary" : "text-slate-500 hover:text-slate-700"}`}
            >
              로그인
            </button>
            <button
              onClick={() => setActiveTab("register")}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-300 relative z-20 ${activeTab === "register" ? "text-primary" : "text-slate-500 hover:text-slate-700"}`}
            >
              회원가입
            </button>
            <div 
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-sm transition-transform duration-300 ease-spring z-10`}
              style={{ transform: activeTab === "login" ? "translateX(0)" : "translateX(calc(100% + 4px))" }}
            />
          </div>

          <div className="relative flex-1">
            <AnimatePresence mode="wait">
              {activeTab === "login" ? (
                <motion.div 
                  key="login"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  <LoginForm />
                </motion.div>
              ) : (
                <motion.div 
                  key="register"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <RegisterForm />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function LoginForm() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({ title: "입력 오류", description: "아이디와 비밀번호를 입력하세요", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await login(username, password);
      toast({ title: "로그인 성공", description: "환영합니다!" });
      navigate("/");
    } catch (err: any) {
      const msg = err.message?.includes("401")
        ? "아이디 또는 비밀번호가 올바르지 않습니다"
        : "로그인 중 오류가 발생했습니다";
      toast({ title: "로그인 실패", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label className="text-[13px] font-bold text-slate-700 pl-1">아이디</label>
        <div className="relative group">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
          <Input
            type="text"
            placeholder="아이디를 입력하세요"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full h-14 pl-12 bg-slate-50/50 border-slate-200 focus-visible:bg-white rounded-xl shadow-sm text-[15px] transition-all"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-[13px] font-bold text-slate-700 pl-1">비밀번호</label>
        <div className="relative group">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="비밀번호를 입력하세요"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-14 pl-12 pr-12 bg-slate-50/50 border-slate-200 focus-visible:bg-white rounded-xl shadow-sm text-[15px] transition-all"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>
      
      <div className="pt-4">
        <Button 
          type="submit" 
          disabled={loading} 
          className="w-full h-14 rounded-xl font-bold text-[16px] shadow-lg shadow-primary/30"
        >
          {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
          로그인
        </Button>
      </div>
      <p className="text-center text-[13px] font-medium text-slate-400 mt-6">
        간편하게 로그인하고 투표를 시작하세요
      </p>
    </form>
  );
}

function RegisterForm() {
  const { register } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [demoCode, setDemoCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);

  const handleSendCode = async () => {
    if (!phone) {
      toast({ title: "입력 오류", description: "전화번호를 입력하세요", variant: "destructive" });
      return;
    }
    const phoneRegex = /^01[016789]-?\d{3,4}-?\d{4}$/;
    if (!phoneRegex.test(phone)) {
      toast({ title: "입력 오류", description: "올바른 휴대폰 번호를 입력하세요", variant: "destructive" });
      return;
    }

    setSendingCode(true);
    try {
      const res = await apiRequest("POST", "/api/auth/send-code", { phone });
      const data = await res.json();
      setCodeSent(true);
      setDemoCode(data.demoCode);
      toast({ title: "인증번호 발송", description: `데모 인증번호: ${data.demoCode}` });
    } catch {
      toast({ title: "발송 실패", description: "오류가 발생했습니다", variant: "destructive" });
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !username || !password || !phone || !verificationCode) {
      toast({ title: "입력 오류", description: "모든 항목을 입력해주세요", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "입력 오류", description: "비밀번호는 6자 이상이어야 합니다", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await register({ username, password, name, phone, verificationCode });
      toast({ title: "가입 완료", description: "환영합니다!" });
      navigate("/");
    } catch (err: any) {
      toast({ title: "가입 실패", description: "정보를 다시 확인해주세요", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-[12px] font-bold text-slate-700 pl-1">이름</label>
        <Input
          type="text"
          placeholder="본명 입력"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full h-12 bg-slate-50 border-slate-200 focus-visible:bg-white rounded-xl shadow-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[12px] font-bold text-slate-700 pl-1">아이디</label>
        <Input
          type="text"
          placeholder="사용할 아이디 (3자 이상)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full h-12 bg-slate-50 border-slate-200 focus-visible:bg-white rounded-xl shadow-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[12px] font-bold text-slate-700 pl-1">비밀번호</label>
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="6자 이상 입력"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-12 pr-12 bg-slate-50 border-slate-200 focus-visible:bg-white rounded-xl shadow-sm"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[12px] font-bold text-slate-700 pl-1">휴대폰 번호</label>
        <div className="flex gap-2">
          <Input
            type="tel"
            placeholder="010-1234-5678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={codeSent}
            className="w-full h-12 bg-slate-50 border-slate-200 focus-visible:bg-white rounded-xl shadow-sm flex-1"
          />
          <Button
            type="button"
            variant={codeSent ? "outline" : "default"}
            onClick={handleSendCode}
            disabled={sendingCode || codeSent}
            className={`h-12 rounded-xl font-bold px-4 shrink-0 shadow-sm ${codeSent ? 'text-green-600 border-green-200 bg-green-50' : ''}`}
          >
            {sendingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : codeSent ? <CheckCircle2 className="w-5 h-5 mx-2" /> : "인증받기"}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {codeSent && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-1 overflow-hidden"
          >
            <label className="text-[12px] font-bold text-slate-700 pl-1">인증번호</label>
            <Input
              type="text"
              placeholder="6자리 인증번호"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              maxLength={6}
              className="w-full h-12 bg-slate-50 border-slate-200 focus-visible:bg-white rounded-xl shadow-sm tracking-widest text-center text-lg font-bold text-primary"
            />
            {demoCode && (
              <p className="text-[11px] font-medium text-amber-500 text-center mt-1">
                (데모 발송) 화면 인증번호: {demoCode}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pt-2">
        <Button 
          type="submit" 
          disabled={loading || !codeSent} 
          className="w-full h-14 rounded-xl font-bold text-[16px] shadow-lg shadow-primary/30 mt-2"
        >
          {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
          가입하기
        </Button>
      </div>
    </form>
  );
}
