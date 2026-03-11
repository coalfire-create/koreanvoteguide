import { useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BottomNav } from "@/components/bottom-nav";
import { SplashScreen } from "@/components/splash-screen";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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
import More from "@/pages/more";
import { LogIn, LogOut, Menu, Users, UserCheck, Search, BarChart3, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

const sidebarMenuItems = [
  { icon: Users, title: "국회의원", description: "의원 프로필 · 투표 기록", href: "/members" },
  { icon: UserCheck, title: "후보자", description: "후보자 비교 · 공약", href: "/candidates" },
  { icon: Search, title: "법안 검색", description: "법안별 투표 현황", href: "/bills" },
  { icon: BarChart3, title: "객관적 평가", description: "데이터 기반 평가", href: "/evaluation" },
];

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
      <Route path="/more" component={More} />
      <Route component={NotFound} />
    </Switch>
  );
}

function MainApp() {
  const { user, isLoading, logout } = useAuth();
  const [location] = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);
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
          <div className="flex items-center gap-1">
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
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-hamburger-menu">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 p-0">
                <div className="px-5 pt-6 pb-4 border-b">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
                      <span className="text-primary-foreground font-bold text-sm">투</span>
                    </div>
                    <span className="font-bold">이유있는 투표</span>
                  </div>
                </div>
                <nav className="py-2">
                  {sidebarMenuItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSheetOpen(false)}
                    >
                      <div
                        className={`flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${
                          location.startsWith(item.href) ? "bg-primary/5 text-primary" : ""
                        }`}
                        data-testid={`link-sidebar-${item.href.replace("/", "")}`}
                      >
                        <item.icon className="w-5 h-5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="text-[11px] text-muted-foreground">{item.description}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
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
