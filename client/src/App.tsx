import { useEffect, lazy, Suspense } from "react";
import { Switch, Route, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { BottomNav } from "@/components/bottom-nav";
import { SideNav } from "@/components/side-nav";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { AuthProvider, useAuth } from "@/lib/auth";
import { isElectionMode } from "@/lib/election-config";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// 라우트별 lazy import — 초기 번들 크기 감소 (각 페이지가 별도 chunk로 분리됨)
const NotFound = lazy(() => import("@/pages/not-found"));
const Home = lazy(() => import("@/pages/home"));
const ElectionHome = lazy(() => import("@/pages/election-home"));
const Members = lazy(() => import("@/pages/members"));
const MemberDetail = lazy(() => import("@/pages/member-detail"));
const Candidates = lazy(() => import("@/pages/candidates"));
const BillSearch = lazy(() => import("@/pages/bill-search"));
const Evaluation = lazy(() => import("@/pages/evaluation"));
const Community = lazy(() => import("@/pages/community"));
const CommunityDetail = lazy(() => import("@/pages/community-detail"));
const CommunityWrite = lazy(() => import("@/pages/community-write"));
const CommunityBookmarks = lazy(() => import("@/pages/community-bookmarks"));
const AuthPage = lazy(() => import("@/pages/auth"));
const More = lazy(() => import("@/pages/more"));
const NewsPage = lazy(() => import("@/pages/news"));
const Onboarding = lazy(() => import("@/pages/onboarding"));
const CitySelect = lazy(() => import("@/pages/city-select"));
const BillVote = lazy(() => import("@/pages/bill-vote"));
const CandidateDetail = lazy(() => import("@/pages/candidate-detail"));
const AssemblyElection = lazy(() => import("@/pages/assembly-election"));
const IntroTour = lazy(() => import("@/pages/intro-tour"));
const DailyBriefing = lazy(() => import("@/pages/daily-briefing"));
const Prediction = lazy(() => import("@/pages/prediction"));

function RouteSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]" role="status" aria-label="로딩 중">
      <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );
}

function HomeWithRedirect() {
  const [, setLocation] = useLocation();
  const hasRegion = typeof window !== "undefined" && (localStorage.getItem("userRegions") || localStorage.getItem("userRegion"));

  useEffect(() => {
    if (!hasRegion) setLocation("/city-select");
  }, [hasRegion, setLocation]);

  if (!hasRegion) return null;
  return isElectionMode() ? <ElectionHome /> : <Home />;
}

function Router() {
  return (
    <Suspense fallback={<RouteSpinner />}>
      <Switch>
        <Route path="/" component={HomeWithRedirect} />
        <Route path="/members" component={Members} />
        <Route path="/members/:id" component={MemberDetail} />
        <Route path="/candidates" component={Candidates} />
        <Route path="/candidates/:id" component={CandidateDetail} />
        <Route path="/assembly-election" component={AssemblyElection} />
        <Route path="/bills" component={BillSearch} />
        <Route path="/bills/:id/vote" component={BillVote} />
        <Route path="/evaluation" component={Evaluation} />
        <Route path="/community" component={Community} />
        <Route path="/community/write" component={CommunityWrite} />
        <Route path="/community/bookmarks" component={CommunityBookmarks} />
        <Route path="/community/:id" component={CommunityDetail} />
        <Route path="/login" component={AuthPage} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/city-select" component={CitySelect} />
        <Route path="/intro-tour" component={IntroTour} />
        <Route path="/news" component={NewsPage} />
        <Route path="/daily-briefing" component={DailyBriefing} />
        <Route path="/prediction" component={Prediction} />
        <Route path="/more" component={More} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function LoginSuccessToast() {
  const { toast } = useToast();
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("loginSuccess") === "1") {
      toast({ title: "로그인 성공했습니다!" });
      url.searchParams.delete("loginSuccess");
      window.history.replaceState({}, "", url.pathname + (url.search || ""));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function AttendanceCheck() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  useEffect(() => {
    if (!user) return;
    
    let isMounted = true;
    const checkAttendance = async () => {
      try {
        const res = await apiRequest("POST", "/api/users/attendance");
        const data = await res.json();
        
        if (data.success && isMounted) {
          toast({
            title: "출석 완료! 🎉",
            description: `${data.streak}일 연속 출석하셨습니다. (EXP +${data.rewardExp})`,
          });
          queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        }
      } catch (e) {
        // fail silently
      }
    };
    
    checkAttendance();
    return () => { isMounted = false; };
  }, [user, toast]);

  return null;
}

function MainApp() {
  const [location] = useLocation();
  const isLoginPage = location === "/login";
  const isOnboardingPage = location === "/onboarding";
  const isCitySelectPage = location === "/city-select";
  const isIntroTourPage = location === "/intro-tour";
  const hideHeaderNav = isLoginPage || isOnboardingPage || isCitySelectPage || isIntroTourPage;

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {!hideHeaderNav && <AnnouncementBanner />}
      {!hideHeaderNav && <SideNav />}

      <main className={`flex-1 w-full ${!hideHeaderNav ? "md:pl-[260px]" : ""}`}>
        <div className="flex-1 w-full relative z-0">
          <Router />
        </div>
        {!hideHeaderNav && <BottomNav />}
      </main>
      <Toaster />
      <LoginSuccessToast />
      <AttendanceCheck />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <MainApp />
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
