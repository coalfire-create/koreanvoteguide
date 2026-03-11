import { useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import AuthPage from "@/pages/auth";
import { LogIn, LogOut } from "lucide-react";
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
      <Route path="/community/:id" component={CommunityDetail} />
      <Route path="/login" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function MainApp() {
  const { user, isLoading, logout } = useAuth();
  const [location] = useLocation();
  const isLoginPage = location === "/login";

  return (
    <div className="flex flex-col min-h-screen w-full">
      {!isLoginPage && (
        <header className="flex items-center justify-between gap-2 px-4 py-2.5 border-b sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <Link href="/" data-testid="link-home-logo">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">투</span>
              </div>
              <span className="text-sm font-bold">이유있는 투표</span>
            </div>
          </Link>
          {!isLoading && (
            user ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground" data-testid="text-user-name">
                  {user.name}님
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={logout} data-testid="button-logout">
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Link href="/login">
                <Button variant="ghost" size="sm" data-testid="button-header-login">
                  <LogIn className="w-4 h-4 mr-1.5" />
                  로그인
                </Button>
              </Link>
            )
          )}
        </header>
      )}
      <main className="flex-1 overflow-auto pb-16">
        <Router />
      </main>
      <BottomNav />
    </div>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
          <MainApp />
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
