import { Link, useLocation } from "wouter";
import { Home, MessageSquare, MoreHorizontal } from "lucide-react";

const navItems = [
  { title: "홈", url: "/", icon: Home },
  { title: "커뮤니티", url: "/community", icon: MessageSquare },
  { title: "더보기", url: "/more", icon: MoreHorizontal },
];

export function BottomNav() {
  const [location] = useLocation();

  if (location === "/login") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80" data-testid="nav-bottom">
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto px-1">
        {navItems.map((item) => {
          const isActive = item.url === "/"
            ? location === "/"
            : location.startsWith(item.url);
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
