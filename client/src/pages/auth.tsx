import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Vote, Eye, EyeOff, Phone, CheckCircle, Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation, Link } from "wouter";

export default function AuthPage() {
  const { user } = useAuth();
  const [, nav] = useLocation();

  if (user) {
    nav("/");
    return null;
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: "#0a0f1e" }}
    >
      <div className="w-full max-w-md">
        <div className="mb-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              홈으로 돌아가기
            </Button>
          </Link>
        </div>
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-md bg-primary flex items-center justify-center mx-auto mb-4">
            <Vote className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-white" data-testid="text-auth-title">이유있는 투표</h1>
          <p className="text-sm text-gray-400 mt-1">데이터 기반 시민 투명성 플랫폼</p>
        </div>

        <Card className="border-gray-800 bg-gray-900/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <Tabs defaultValue="login">
              <TabsList className="w-full mb-6 bg-gray-800">
                <TabsTrigger value="login" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" data-testid="tab-login">
                  로그인
                </TabsTrigger>
                <TabsTrigger value="register" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" data-testid="tab-register">
                  회원가입
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <LoginForm />
              </TabsContent>

              <TabsContent value="register">
                <RegisterForm />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-500 mt-6">
          회원가입 후 로그인하여 서비스를 이용할 수 있습니다
        </p>
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="login-username" className="text-gray-300">아이디</Label>
        <Input
          id="login-username"
          type="text"
          placeholder="아이디를 입력하세요"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
          data-testid="input-login-username"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password" className="text-gray-300">비밀번호</Label>
        <div className="relative">
          <Input
            id="login-password"
            type={showPassword ? "text" : "password"}
            placeholder="비밀번호를 입력하세요"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 pr-10"
            data-testid="input-login-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
            data-testid="button-toggle-password"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={loading} data-testid="button-login">
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
        로그인
      </Button>
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
  const [confirmPassword, setConfirmPassword] = useState("");
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
      toast({ title: "입력 오류", description: "올바른 휴대폰 번호를 입력하세요 (예: 010-1234-5678)", variant: "destructive" });
      return;
    }

    setSendingCode(true);
    try {
      const res = await apiRequest("POST", "/api/auth/send-code", { phone });
      const data = await res.json();
      setCodeSent(true);
      setDemoCode(data.demoCode);
      toast({
        title: "인증번호 발송",
        description: `인증번호가 발송되었습니다. (데모: ${data.demoCode})`,
      });
    } catch {
      toast({ title: "발송 실패", description: "인증번호 발송 중 오류가 발생했습니다", variant: "destructive" });
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
    if (password !== confirmPassword) {
      toast({ title: "입력 오류", description: "비밀번호가 일치하지 않습니다", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "입력 오류", description: "비밀번호는 6자 이상이어야 합니다", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await register({ username, password, name, phone, verificationCode });
      toast({ title: "회원가입 완료", description: "환영합니다! 자동으로 로그인됩니다." });
      navigate("/");
    } catch (err: any) {
      const msg = err.message?.includes("400")
        ? "입력 정보를 다시 확인해주세요"
        : "회원가입 중 오류가 발생했습니다";
      toast({ title: "회원가입 실패", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reg-name" className="text-gray-300">이름</Label>
        <Input
          id="reg-name"
          type="text"
          placeholder="이름을 입력하세요"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
          data-testid="input-register-name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reg-username" className="text-gray-300">아이디</Label>
        <Input
          id="reg-username"
          type="text"
          placeholder="아이디를 입력하세요 (3자 이상)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
          data-testid="input-register-username"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reg-password" className="text-gray-300">비밀번호</Label>
        <div className="relative">
          <Input
            id="reg-password"
            type={showPassword ? "text" : "password"}
            placeholder="비밀번호 (6자 이상)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 pr-10"
            data-testid="input-register-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reg-confirm" className="text-gray-300">비밀번호 확인</Label>
        <Input
          id="reg-confirm"
          type="password"
          placeholder="비밀번호를 다시 입력하세요"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
          data-testid="input-register-confirm"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reg-phone" className="text-gray-300">
          <Phone className="w-3.5 h-3.5 inline mr-1" />
          휴대폰 번호
        </Label>
        <div className="flex gap-2">
          <Input
            id="reg-phone"
            type="tel"
            placeholder="010-1234-5678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 flex-1"
            data-testid="input-register-phone"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleSendCode}
            disabled={sendingCode || codeSent}
            className="shrink-0"
            data-testid="button-send-code"
          >
            {sendingCode ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : codeSent ? (
              <><CheckCircle className="w-4 h-4 mr-1" />발송됨</>
            ) : (
              "인증번호 발송"
            )}
          </Button>
        </div>
      </div>

      {codeSent && (
        <div className="space-y-2">
          <Label htmlFor="reg-code" className="text-gray-300">인증번호</Label>
          <Input
            id="reg-code"
            type="text"
            placeholder="6자리 인증번호 입력"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            maxLength={6}
            className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 tracking-widest text-center text-lg"
            data-testid="input-verification-code"
          />
          {demoCode && (
            <p className="text-xs text-amber-400 text-center" data-testid="text-demo-code">
              데모 인증번호: <span className="font-mono font-bold">{demoCode}</span>
            </p>
          )}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={loading || !codeSent} data-testid="button-register">
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
        회원가입
      </Button>
    </form>
  );
}
