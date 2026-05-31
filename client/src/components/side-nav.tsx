import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Search, Home, Users, MessageSquare, FileText, User, Plus, MapPin, Trophy } from "lucide-react";
import { useAuth } from "@/lib/auth";

const getCitizenLevel = (exp: number) => {
  if (exp < 100) return { name: "씨앗 시민", icon: "🌱", color: "text-emerald-500", bg: "bg-emerald-50" };
  if (exp < 300) return { name: "새싹 시민", icon: "🌿", color: "text-emerald-600", bg: "bg-emerald-100" };
  if (exp < 600) return { name: "잎새 시민", icon: "🍀", color: "text-green-600", bg: "bg-green-100" };
  if (exp < 1000) return { name: "열매 시민", icon: "🍎", color: "text-rose-500", bg: "bg-rose-50" };
  return { name: "거목 시민", icon: "🌳", color: "text-amber-600", bg: "bg-amber-100" };
};

const navItems = [
  { title: "홈", url: "/", icon: Home },
  { title: "인물 검색", url: "/members", icon: Users },
  { title: "커뮤니티", url: "/community", icon: MessageSquare },
  { title: "법안 현황", url: "/bills", icon: FileText },
  { title: "마이페이지", url: "/more", icon: User },
];

export function SideNav() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [userRegions, setUserRegions] = useState<{ code: string; name: string; level?: string }[]>([]);
  const [currentRegionCode, setCurrentRegionCode] = useState(() => localStorage.getItem("currentRegionCode") || "");

  useEffect(() => {
    const loadRegions = () => {
      const stored = localStorage.getItem("userRegions");
      if (stored) {
        try {
          setUserRegions(JSON.parse(stored));
        } catch (e) {}
      }
    };
    loadRegions();

    const handleRegionChange = () => {
      setCurrentRegionCode(localStorage.getItem("currentRegionCode") || "");
      loadRegions();
    };

    window.addEventListener("storage", loadRegions);
    window.addEventListener("regionchange", handleRegionChange);
    return () => {
      window.removeEventListener("storage", loadRegions);
      window.removeEventListener("regionchange", handleRegionChange);
    };
  }, []);

  if (location === "/login" || location === "/onboarding" || location === "/city-select") return null;

  const handleRegionClick = (r: { code: string; name: string; level?: string }) => {
    const targetPath = r.level === "assembly" ? "/assembly-election" : "/";
    
    if (location !== targetPath) {
      localStorage.setItem("lastSelectedRegionCode", r.code);
      setLocation(targetPath);
    } else {
      if (typeof (window as any).switchRegion === "function") {
        (window as any).switchRegion(r);
      }
    }
  };

  return (
    <nav className="hidden md:flex flex-col w-[260px] fixed top-0 left-0 bottom-0 bg-background border-r border-border/40 z-50 py-6 px-4 shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
      {/* 로고 영역 */}
      <div className="mb-6 px-4 pt-2">
        <Link href="/" className="cursor-pointer flex flex-col">
          <span className="text-[24px] font-black tracking-tight text-primary">
            이유
          </span>
        </Link>
      </div>
      
      {/* 유저 등급 영역 */}
      {user && (
        <div className="px-2 mb-6">
          <Link href="/more">
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-[18px] shrink-0">
                {getCitizenLevel(user.exp ?? 0).icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[13px] font-bold text-foreground truncate">{user.name}</span>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${getCitizenLevel(user.exp ?? 0).bg} ${getCitizenLevel(user.exp ?? 0).color}`}>
                    {getCitizenLevel(user.exp ?? 0).name}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Trophy className="w-3 h-3 text-amber-500" />
                  <span className="font-medium">{(user.exp ?? 0).toLocaleString()} P</span>
                  {(user.attendanceStreak ?? 0) > 0 && (
                    <>
                      <span className="mx-1">•</span>
                      <span className="text-orange-500 font-bold">{user.attendanceStreak}일 연속</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* 글쓰기 버튼 */}
      <div className="px-2 mb-8">
        <Link 
          href="/community/write"
          className="flex items-center justify-center gap-2 w-full bg-primary hover:opacity-90 text-primary-foreground py-3.5 rounded-2xl font-bold text-[15px] transition-all duration-200 shadow-sm hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5 stroke-[3]" />
          <span>글쓰기</span>
        </Link>
      </div>

      {/* 네비게이션 아이템들 */}
      <div className="flex flex-col gap-1.5 mb-auto">
        {navItems.map((item) => {
          const isActive = item.url === "/" ? location === "/" : location.startsWith(item.url);

          return (
            <Link
              key={item.url}
              href={item.url}
              className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? "bg-primary/10 text-primary font-bold"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground font-medium"
              }`}
            >
              <item.icon className={`w-4 h-4 ${isActive ? "stroke-[2.5]" : "stroke-2"}`} />
              <span className="text-[14px]">{item.title}</span>
            </Link>
          );
        })}
      </div>

      {/* 관심 지역 피드 (가장 밑에 추가) */}
      {userRegions.length > 0 && (
        <div className="pt-6 border-t border-border/30 mb-2">
          <div className="px-4 mb-3 flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground/50" />
              관심 지역
            </span>
            <Link href="/city-select">
              <span className="text-[10px] font-bold text-primary hover:underline cursor-pointer">설정</span>
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5 px-2">
            {userRegions.map((r) => {
              const isActive = currentRegionCode === r.code;
              return (
                <button
                  key={r.code}
                  onClick={() => handleRegionClick(r)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-black transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm scale-105"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {r.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
