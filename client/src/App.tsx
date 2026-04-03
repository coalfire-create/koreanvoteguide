import { useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { BottomNav } from "@/components/bottom-nav";
import { SplashScreen } from "@/components/splash-screen";
import { AuthProvider, useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
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
import { LogIn, Menu, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";



function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/members" component={Members} />
      <Route path="/members/:id" component={MemberDetail} />
      <Route path="/candidates" component={Candidates} />
      <Route path="/bills" component={BillSearch} />
      <Route path="/evaluation" component={Evaluation} />
      <Route path="/community" component={Community} />
      <Route path="/community/write" component={CommunityWrite} />
      <Route path="/community/bookmarks" component={CommunityBookmarks} />
      <Route path="/community/:id" component={CommunityDetail} />
      <Route path="/login" component={AuthPage} />
      <Route path="/news" component={NewsPage} />
      <Route path="/more" component={More} />
      <Route component={NotFound} />
    </Switch>
  );
}

function MainApp() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  const isLoginPage = location === "/login";

  return (
    <div className="flex flex-col min-h-screen w-full">
      {!isLoginPage && (
        <header className="flex items-center justify-between px-4 py-3 sticky top-0 z-50 bg-[#425091] shadow-sm text-white">
          <div className="flex items-center gap-3">
            <button className="p-1 hover:bg-white/10 rounded-sm transition-colors">
              <Menu className="w-6 h-6 stroke-[2]" />
            </button>
          </div>
          
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
            <Link href="/" data-testid="link-home-logo">
              <span className="text-xl font-black italic tracking-tighter text-white hover:text-white/90 transition-colors">
                iyu.com
              </span>
            </Link>
          </div>

          <div className="flex items-center">
            {!isLoading && (
              user ? (
                <div className="flex items-center gap-1">
                  <button className="p-1 hover:bg-white/10 rounded-sm transition-colors flex items-center gap-1.5">
                    <UserCircle className="w-5 h-5 stroke-[2]" />
                  </button>
                </div>
              ) : (
                <Link href="/login">
                  <button className="p-1 hover:bg-white/10 rounded-sm transition-colors flex items-center">
                    <LogIn className="w-5 h-5 stroke-[2]" />
                  </button>
                </Link>
              )
            )}
          </div>
        </header>
      )}
      <main className="flex-1 overflow-auto pb-[60px] bg-white">
        <Router />
      </main>
      <BottomNav />
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
