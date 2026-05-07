import { useState } from "react";
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
import { AuthProvider } from "@/lib/auth";
import { isElectionMode } from "@/lib/election-config";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import ElectionHome from "@/pages/election-home";
import Members from "@/pages/members";
import MemberDetail from "@/pages/member-detail";
import Candidates from "@/pages/candidates";
import BillSearch from "@/pages/bill-search";
import Evaluation from "@/pages/evaluation";
import Community from "@/pages/community";
import CommunityDetail from "@/pages/community-detail";
import CommunityWrite from "@/pages/community-write";
import CommunityBookmarks from "@/pages/community-bookmarks";
import AuthPage from "@/pages/auth";
import More from "@/pages/more";
import NewsPage from "@/pages/news";
import Onboarding from "@/pages/onboarding";
import CitySelect from "@/pages/city-select";
import BillVote from "@/pages/bill-vote";
import CandidateDetail from "@/pages/candidate-detail";

function HomeWithRedirect() {
  const [, setLocation] = useLocation();
  const hasRegion = typeof window !== "undefined" && (localStorage.getItem("userRegions") || localStorage.getItem("userRegion"));

  if (!hasRegion) {
    setTimeout(() => setLocation("/city-select"), 0);
    return null;
  }
  return isElectionMode() ? <ElectionHome /> : <Home />;
}

function Router() {
  return (
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
      <Route path="/news" component={NewsPage} />
      <Route path="/more" component={More} />
      <Route component={NotFound} />
    </Switch>
  );
}

function MainApp() {
  const [location] = useLocation();
  const isLoginPage = location === "/login";
  const isOnboardingPage = location === "/onboarding";
  const isCitySelectPage = location === "/city-select";
  const hideHeaderNav = isLoginPage || isOnboardingPage || isCitySelectPage;

  return (
    <div className="flex min-h-screen w-full bg-white">
      {!hideHeaderNav && <SideNav />}
      
      <main className={`flex-1 w-full ${!hideHeaderNav ? "md:pl-[260px]" : ""}`}>
        {/* Full width content area for desktop, matching Stitch design */}
        <div className="w-full min-h-screen pb-[60px] md:pb-10">
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
            <AnimatePresence mode="wait">
              {showSplash ? (
                <SplashScreen key="splash" onComplete={() => setShowSplash(false)} />
              ) : (
                <motion.div
                  key="main"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="w-full h-full"
                >
                  <MainApp />
                </motion.div>
              )}
            </AnimatePresence>
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
