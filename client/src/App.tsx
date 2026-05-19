import { useState, useEffect, lazy, Suspense } from "react";
import { Switch, Route, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { BottomNav } from "@/components/bottom-nav";
import { SideNav } from "@/components/side-nav";
import { SplashScreen } from "@/components/splash-screen";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { AuthProvider } from "@/lib/auth";
import { isElectionMode } from "@/lib/election-config";
import { useToast } from "@/hooks/use-toast";

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
const IntroTour = lazy(() => import("@/pages/intro-tour"));

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

function MainApp() {
  const [location] = useLocation();
  const isLoginPage = location === "/login";
  const isOnboardingPage = location === "/onboarding";
  const isCitySelectPage = location === "/city-select";
  const isIntroTourPage = location === "/intro-tour";
  const hideHeaderNav = isLoginPage || isOnboardingPage || isCitySelectPage || isIntroTourPage;

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <LoginSuccessToast />
      {!hideHeaderNav && <AnnouncementBanner />}
      {!hideHeaderNav && <SideNav />}

      <main className={`flex-1 w-full ${!hideHeaderNav ? "md:pl-[260px]" : ""}`}>
        {/* Full width content area for desktop, matching Stitch design */}
        <div className="w-full min-h-screen pb-[80px] md:pb-10">
          <Router />
        </div>
      </main>
      {!hideHeaderNav && <BottomNav />}
    </div>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <div className="relative w-full h-full min-h-screen">
              <MainApp />
              {showSplash && (
                <SplashScreen onComplete={() => setShowSplash(false)} />
              )}
            </div>
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
