import { Link, useLocation } from "wouter";
import { Search, Home, Users, MessageSquare, FileText, User, Plus } from "lucide-react";

const navItems = [
  { title: "홈", url: "/", icon: Home },
  { title: "인물 검색", url: "/members", icon: Users },
  { title: "커뮤니티", url: "/community", icon: MessageSquare },
  { title: "법안 현황", url: "/bills", icon: FileText },
  { title: "마이페이지", url: "/more", icon: User },
];

export function SideNav() {
  const [location] = useLocation();

  if (location === "/login" || location === "/onboarding" || location === "/city-select") return null;

  return (
    <nav className="hidden md:flex flex-col w-[260px] fixed top-0 left-0 bottom-0 bg-white border-r border-gray-100 z-50 py-6 px-4 shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
      {/* 로고 영역 */}
      <div className="mb-6 px-4 pt-2">
        <Link href="/" className="cursor-pointer flex flex-col">
          <span className="text-[24px] font-black tracking-tight text-[#6D28D9]">
            이유
          </span>
        </Link>
      </div>

      {/* 글쓰기 버튼 */}
      <div className="px-2 mb-8">
        <Link 
          href="/community/write"
          className="flex items-center justify-center gap-2 w-full bg-[#6D28D9] hover:bg-[#5B21B6] text-white py-3.5 rounded-2xl font-bold text-[15px] transition-all duration-200 shadow-[0_4px_12px_rgba(99,32,238,0.2)] hover:shadow-[0_6px_16px_rgba(99,32,238,0.3)] hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5 stroke-[3]" />
          <span>글쓰기</span>
        </Link>
      </div>

      {/* 네비게이션 아이템들 */}
      <div className="flex flex-col gap-1.5">
        {navItems.map((item) => {
          const isActive = item.url === "/" ? location === "/" : location.startsWith(item.url);

          return (
            <Link
              key={item.url}
              href={item.url}
              className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? "bg-[#F4F0FF] text-[#6D28D9] font-bold"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900 font-medium"
              }`}
            >
              <item.icon className={`w-4 h-4 ${isActive ? "stroke-[2.5]" : "stroke-2"}`} />
              <span className="text-[14px]">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
