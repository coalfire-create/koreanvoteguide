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

  if (location === "/login") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-t border-border/40 shadow-[0_-4px_24px_rgba(0,0,0,0.02)] supports-[backdrop-filter]:bg-white/60 pb-safe" data-testid="nav-bottom">
      <div className="flex items-center justify-around h-[60px] max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const isActive = item.url === "/"
            ? location === "/"
            : location.startsWith(item.url);
          return (
            <Link
              key={item.url}
              href={item.url}
              data-testid={`link-nav-${item.url.replace("/", "") || "home"}`}
              className={`relative flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-xl transition-all duration-300 group ${
                item.isCenter ? "mt-[-10px]" : ""
              } ${
                isActive && !item.isCenter
                  ? "text-primary bg-primary/5"
                  : !item.isCenter
                  ? "text-slate-400 hover:text-slate-900 hover:bg-slate-50"
                  : ""
              }`}
            >
              {item.isCenter ? (
                <div className="absolute -top-6 w-14 h-14 rounded-full bg-gradient-to-tr from-primary to-blue-600 shadow-lg shadow-primary/40 flex items-center justify-center border-[4px] border-background transition-transform active:scale-95 group-hover:-translate-y-1">
                  <item.icon className="w-6 h-6 text-white stroke-[2.5]" />
                </div>
              ) : (
                <item.icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? "stroke-[2.5] scale-110" : ""}`} />
              )}
              <span className={`text-[10px] tracking-wide transition-all duration-300 ${item.isCenter ? "mt-8 font-bold text-primary" : isActive ? "font-bold" : "font-medium"}`}>
                {item.title}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
