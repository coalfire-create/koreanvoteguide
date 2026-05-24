import { Link, useLocation } from "wouter";
import { Home, MessageSquare, User, Users, Search } from "lucide-react";

const navItems = [
  { title: "커뮤니티", url: "/community", icon: MessageSquare },
  { title: "인물", url: "/members", icon: Users },
  { title: "홈", url: "/", icon: Home, isCenter: true },
  { title: "법안", url: "/bills", icon: Search },
  { title: "마이", url: "/more", icon: User },
];

export function BottomNav() {
  const [location] = useLocation();

  if (location === "/login" || location === "/onboarding" || location === "/city-select") return null;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border/50 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)]"
      data-testid="nav-bottom"
    >
      <div className="flex items-center justify-around h-[64px] max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const isActive =
            item.url === "/" ? location === "/" : location.startsWith(item.url);
          return (
            <Link
              key={item.url}
              href={item.url}
              data-testid={`link-nav-${item.url.replace("/", "") || "home"}`}
              className={`relative flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-300 ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.isCenter ? (
                <div
                  className={`w-12 h-12 rounded-full flex flex-col items-center justify-center transition-transform active:scale-95 ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"}`}
                >
                  <item.icon
                    className={`w-6 h-6 mb-0.5 ${isActive ? "stroke-[2.5]" : "stroke-2"}`}
                  />
                  <span
                    className={`text-[10px] tracking-wide ${isActive ? "font-bold" : "font-medium"}`}
                  >
                    {item.title}
                  </span>
                </div>
              ) : (
                <>
                  <item.icon
                    className={`w-6 h-6 transition-all duration-300 ${isActive ? "stroke-[2.5]" : "stroke-2"}`}
                  />
                  <span
                    className={`text-[10px] tracking-wide transition-all duration-300 ${isActive ? "font-bold" : "font-medium"}`}
                  >
                    {item.title}
                  </span>
                </>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
