import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, User, Phone, Lock, Eye, EyeOff, Loader2, CheckCircle2, ShieldCheck, ChevronDown } from "lucide-react";
import { KakaoLoginButton } from "@/components/KakaoLoginButton";
import { GoogleLoginButton } from "@/components/GoogleLoginButton";

export default function AuthPage() {
  const { user } = useAuth();
  const [, nav] = useLocation();
  const search = useSearch();
  const returnTo = new URLSearchParams(search).get("returnTo") || "/";
  // Kakao 1차, 기존 이메일 로그인은 보조. RegisterForm은 deprecated — 노출하지 않음.
  const [showLegacyLogin, setShowLegacyLogin] = useState(false);

  // Kakao 콜백에서 에러로 돌아왔을 경우 ?error= 파라미터 토스트.
  const { toast } = useToast();
  useEffect(() => {
    const url = new URL(window.location.href);
    const err = url.searchParams.get("error");
    if (err) {
      toast({ title: "로그인 실패", description: err, variant: "destructive" });
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [toast]);

  if (user) {
    nav(returnTo);
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
      <div className="relative z-10 p-5 pt-[calc(env(safe-area-inset-top)+16px)] flex items-center mb-4">
        <Link href="/">
          <button className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-colors shadow-sm">
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
          className="text-white mb-10 px-2 flex flex-col items-center text-center relative"
        >
          {/* Decorative glowing rings */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160px] h-[160px] bg-white/5 border border-white/10 rounded-full blur-[4px] animate-pulse" />

          <h1 className="relative z-10 text-[26px] font-black tracking-tight leading-snug drop-shadow-xl text-white text-center flex flex-col items-center gap-2 mt-4">
            <span className="text-[13px] font-bold text-indigo-200/80 tracking-widest uppercase">KOREAN ELECTION GUIDE</span>
            <span className="bg-black/15 px-6 py-3 rounded-2xl backdrop-blur-md border border-white/10 shadow-inner">
              투표에 <span className="text-amber-300 relative px-1 font-extrabold">이유<span className="absolute bottom-1 left-0 w-full h-[6px] bg-amber-400/40 -z-10 rounded-full" /></span>를 갖는다
            </span>
          </h1>
        </motion.div>

        {/* 메인 폼 카드 */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-[2rem] p-6 shadow-2xl shadow-primary/10 border border-border/50 flex-1 flex flex-col mb-10"
        >
          {/* ===== Kakao Login (메인 경로) ===== */}
          <div className="flex flex-col gap-3 mb-2">
            <p className="text-center text-[13px] font-semibold text-slate-500 mb-2">
              회원가입 없이 카카오로 바로 시작하세요
            </p>
            <KakaoLoginButton next={returnTo} />
            <GoogleLoginButton next={returnTo} />
            <p className="text-center text-[11px] text-slate-400 leading-relaxed">
              카카오·구글 로그인은 본인확인을 대체합니다. 연령대·성별 정보는 통계 목적으로만 사용돼요.
            </p>
          </div>

          {/* 구분선 — 다른 로그인 방법 */}
          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] font-bold text-slate-400">또는</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* ===== 이메일 로그인 (보조) — 기존 사용자 호환용 ===== */}
          {!showLegacyLogin ? (
            <button
              type="button"
              onClick={() => setShowLegacyLogin(true)}
              className="flex items-center justify-center gap-1.5 text-[13px] font-bold text-slate-500 hover:text-primary transition-colors py-2"
            >
              이메일/아이디로 로그인
              <ChevronDown className="w-4 h-4" />
            </button>
          ) : (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <LoginForm returnTo={returnTo} />
              </motion.div>
            </AnimatePresence>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function LoginForm({ returnTo = "/" }: { returnTo?: string }) {
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
      toast({ title: "로그인 성공했습니다!" });
      navigate(returnTo);
    } catch (err: any) {
      const raw = String(err?.message || "");
      let msg = "로그인 중 오류가 발생했습니다";
      const match = raw.match(/^\d+:\s*(.+)$/);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed?.error) msg = parsed.error;
        } catch {
          msg = match[1];
        }
      }
      if (raw.includes("401")) msg = "아이디 또는 비밀번호가 올바르지 않습니다";
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
  const [nickname, setNickname] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [agreeTos, setAgreeTos] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0); // 초 단위, 180초(=3분)에서 카운트다운
  const [demoCode, setDemoCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 3분 카운트다운. isCodeSent && !isVerified 일 때만 동작.
  useEffect(() => {
    if (!isCodeSent || isVerified || timeLeft <= 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isCodeSent, isVerified, timeLeft]);

  const formatTime = (s: number) => {
    const mm = Math.floor(s / 60).toString().padStart(1, "0");
    const ss = (s % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  };

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
      const res = await apiRequest("POST", "/api/auth/send-sms", { phone });
      const data = await res.json();
      setIsCodeSent(true);
      setIsVerified(false);
      setVerificationCode("");
      setTimeLeft(data.ttlSeconds ?? 180);
      setDemoCode(data.demoCode ?? "");
      toast({
        title: "인증번호 발송",
        description: data.demoCode
          ? `(개발용) 인증번호: ${data.demoCode}`
          : "휴대폰으로 발송된 인증번호를 입력하세요",
      });
    } catch {
      toast({ title: "발송 실패", description: "오류가 발생했습니다", variant: "destructive" });
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!/^\d{6}$/.test(verificationCode)) {
      toast({ title: "입력 오류", description: "6자리 인증번호를 입력하세요", variant: "destructive" });
      return;
    }
    if (timeLeft <= 0) {
      toast({ title: "인증번호 만료", description: "인증번호를 다시 발송받아 주세요", variant: "destructive" });
      return;
    }
    setVerifyingCode(true);
    try {
      const res = await apiRequest("POST", "/api/auth/verify-sms", { phone, code: verificationCode });
      const data = await res.json();
      if (data.success) {
        setIsVerified(true);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        toast({ title: "인증되었습니다", description: "휴대폰 인증이 완료되었어요" });
      } else {
        toast({ title: "인증 실패", description: data.error || "인증번호가 올바르지 않습니다", variant: "destructive" });
      }
    } catch (err: any) {
      const raw = String(err?.message || "");
      const match = raw.match(/^\d+:\s*(.+)$/);
      let detail = match?.[1] || "인증번호가 올바르지 않거나 만료되었습니다";
      try {
        const parsed = JSON.parse(detail);
        if (parsed?.error) detail = parsed.error;
      } catch {}
      toast({ title: "인증 실패", description: detail, variant: "destructive" });
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVerified) {
      toast({ title: "휴대폰 인증 필요", description: "휴대폰 번호 인증을 먼저 완료해주세요", variant: "destructive" });
      return;
    }
    if (!name || !nickname || !username || !password || !phone || !verificationCode || !birthYear) {
      toast({ title: "입력 오류", description: "모든 항목을 입력해주세요", variant: "destructive" });
      return;
    }
    if (password.length < 10 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      toast({ title: "입력 오류", description: "비밀번호는 영문+숫자 포함 10자 이상이어야 합니다", variant: "destructive" });
      return;
    }
    const birthYearNum = parseInt(birthYear, 10);
    if (!Number.isFinite(birthYearNum) || birthYearNum < 1900 || new Date().getFullYear() - birthYearNum < 14) {
      toast({ title: "입력 오류", description: "만 14세 이상만 가입할 수 있습니다", variant: "destructive" });
      return;
    }
    if (!agreeTos || !agreePrivacy) {
      toast({ title: "약관 동의 필요", description: "이용약관과 개인정보처리방침에 동의해주세요", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await register({ username, password, name, nickname, phone, verificationCode, birthYear: birthYearNum, agreeTos, agreePrivacy });
      toast({ title: "가입 완료", description: "환영합니다!" });
      // 신규 가입자 → 닉네임 확인 → 의원 팔로우 → 안내 (3단계 skippable 온보딩)
      navigate("/welcome");
    } catch (err: any) {
      const raw = String(err?.message || "");
      const match = raw.match(/^\d+:\s*(.+)$/);
      let detail = match?.[1] || raw || "정보를 다시 확인해주세요";
      try {
        const parsed = JSON.parse(detail);
        if (parsed?.error) detail = parsed.error;
      } catch {}
      toast({ title: "가입 실패", description: detail, variant: "destructive" });
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
        <label className="text-[12px] font-bold text-slate-700 pl-1">닉네임</label>
        <Input
          type="text"
          placeholder="커뮤니티에서 사용할 닉네임 (2~20자)"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          className="w-full h-12 bg-slate-50 border-slate-200 focus-visible:bg-white rounded-xl shadow-sm"
        />
        <p className="text-[11px] text-slate-400 pl-1">닉네임은 가입 후 7일마다 변경할 수 있어요</p>
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
            placeholder="영문+숫자 포함 10자 이상"
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
            disabled={isCodeSent || isVerified}
            className={`w-full h-12 bg-slate-50 border-slate-200 focus-visible:bg-white rounded-xl shadow-sm flex-1 ${isVerified ? 'bg-green-50 border-green-200 text-green-700' : ''}`}
          />
          <Button
            type="button"
            variant={isCodeSent ? "outline" : "default"}
            onClick={handleSendCode}
            disabled={sendingCode || isVerified}
            className={`h-12 rounded-xl font-bold px-4 shrink-0 shadow-sm ${isVerified ? 'text-green-600 border-green-200 bg-green-50' : ''}`}
          >
            {sendingCode
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : isVerified
                ? <CheckCircle2 className="w-5 h-5 mx-2" />
                : isCodeSent
                  ? "재발송"
                  : "인증받기"}
          </Button>
        </div>
        {isVerified && (
          <p className="flex items-center gap-1.5 text-[12px] font-bold text-emerald-600 pl-1 pt-1">
            <ShieldCheck className="w-4 h-4" />
            인증되었습니다
          </p>
        )}
      </div>

      <AnimatePresence>
        {isCodeSent && !isVerified && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-1 overflow-hidden"
          >
            <div className="flex items-center justify-between pl-1 pr-1">
              <label className="text-[12px] font-bold text-slate-700">인증번호</label>
              <span className={`text-[12px] font-bold tabular-nums ${timeLeft <= 30 ? 'text-rose-500' : 'text-slate-400'}`}>
                {timeLeft > 0 ? formatTime(timeLeft) : "만료됨 — 재발송 필요"}
              </span>
            </div>
            <div className="flex gap-2">
              <Input
                type="text"
                inputMode="numeric"
                placeholder="6자리 인증번호"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                disabled={timeLeft <= 0}
                className="flex-1 h-12 bg-slate-50 border-slate-200 focus-visible:bg-white rounded-xl shadow-sm tracking-widest text-center text-lg font-bold text-primary"
              />
              <Button
                type="button"
                onClick={handleVerifyCode}
                disabled={verifyingCode || timeLeft <= 0 || verificationCode.length !== 6}
                className="h-12 rounded-xl font-bold px-4 shrink-0 shadow-sm"
              >
                {verifyingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : "확인"}
              </Button>
            </div>
            {demoCode && (
              <p className="text-[11px] font-medium text-amber-500 text-center mt-1">
                (개발용) 인증번호: {demoCode}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-1">
        <label className="text-[12px] font-bold text-slate-700 pl-1">출생연도 (만 14세 이상)</label>
        <Input
          type="number"
          inputMode="numeric"
          placeholder="예: 2000"
          value={birthYear}
          onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
          className="w-full h-12 bg-slate-50 border-slate-200 focus-visible:bg-white rounded-xl shadow-sm"
        />
      </div>

      <div className="space-y-2 pt-1">
        <label className="flex items-start gap-2 text-[12px] text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={agreeTos}
            onChange={(e) => setAgreeTos(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-primary"
          />
          <span>
            <a href="/legal/terms" target="_blank" rel="noreferrer" className="underline text-primary font-semibold">이용약관</a>에 동의합니다 (필수)
          </span>
        </label>
        <label className="flex items-start gap-2 text-[12px] text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={agreePrivacy}
            onChange={(e) => setAgreePrivacy(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-primary"
          />
          <span>
            <a href="/legal/privacy" target="_blank" rel="noreferrer" className="underline text-primary font-semibold">개인정보처리방침</a>에 동의합니다 (필수)
          </span>
        </label>
      </div>

      <div className="pt-2">
        <Button 
          type="submit" 
          disabled={loading || !isVerified} 
          className="w-full h-14 rounded-xl font-bold text-[16px] shadow-lg shadow-primary/30 mt-2"
        >
          {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
          가입하기
        </Button>
      </div>
    </form>
  );
}
