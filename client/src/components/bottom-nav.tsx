import { Link, useLocation } from "wouter";
import { Users, UserCheck, Search, BarChart3, Home } from "lucide-react";

const navItems = [
  { title: "홈", url: "/", icon: Home },
  { title: "국회의원", url: "/members", icon: Users },
  { title: "후보자", url: "/candidates", icon: UserCheck },
  { title: "법안", url: "/bills", icon: Search },
  { title: "평가", url: "/evaluation", icon: BarChart3 },
];

export function BottomNav() {
  const [location] = useLocation();

  if (location === "/login") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80" data-testid="nav-bottom">
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto px-1">
        {navItems.map((item) => {
          const isActive = location === item.url ||
            (item.url !== "/" && location.startsWith(item.url));
          return (
            <Link
              key={item.url}
              href={item.url}
              data-testid={`link-nav-${item.url.replace("/", "") || "home"}`}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-md transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : ""}`} />
              <span className={`text-[10px] leading-tight ${isActive ? "font-semibold" : "font-medium"}`}>
                {item.title}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
