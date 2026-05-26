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
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-nav pb-[env(safe-area-inset-bottom)]"
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
              className={`relative flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-300 active:scale-95 ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <>
                <item.icon
                  className={`w-[22px] h-[22px] transition-all ${isActive ? "stroke-[2.5]" : "stroke-[1.5]"}`}
                />
                <span className={`text-[10px] transition-all ${isActive ? "font-bold" : "font-normal text-muted-foreground/70"}`}>
                  {item.title}
                </span>
              </>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
