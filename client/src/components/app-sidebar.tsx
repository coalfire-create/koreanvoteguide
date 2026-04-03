import { Link, useLocation } from "wouter";
import { Users, UserCheck, Search, BarChart3, Home, LogOut, LogIn } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "홈", url: "/", icon: Home },
  { title: "국회의원", url: "/members", icon: Users },
  { title: "후보자", url: "/candidates", icon: UserCheck },
  { title: "법안 검색", url: "/bills", icon: Search },
  { title: "객관적 평가", url: "/evaluation", icon: BarChart3 },
];

interface AppSidebarProps {
  userName?: string;
  onLogout?: () => void;
}

export function AppSidebar({ userName, onLogout }: AppSidebarProps) {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" data-testid="link-home-logo">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">I</span>
            </div>
            <div>
              <h1 className="font-bold text-sm leading-tight">Iyu</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">데이터 기반 투표 플랫폼</p>
            </div>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>메뉴</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url || 
                  (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      data-active={isActive}
                      className={isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}
                    >
                      <Link href={item.url} data-testid={`link-nav-${item.url.replace("/", "") || "home"}`}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3 border-t">
        {userName && onLogout ? (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium truncate" data-testid="text-sidebar-user">{userName}님</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onLogout}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <Link href="/login">
            <Button variant="outline" size="sm" className="w-full" data-testid="button-sidebar-login">
              <LogIn className="w-4 h-4 mr-1.5" />
              로그인 / 회원가입
            </Button>
          </Link>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
