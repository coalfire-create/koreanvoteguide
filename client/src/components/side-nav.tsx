import { Link, useLocation } from "wouter";
import { Search, Home, Users, MessageSquare, FileText, User } from "lucide-react";

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
      <div className="mb-10 px-4 pt-2">
        <Link href="/" className="cursor-pointer flex flex-col">
          <span className="text-[20px] font-black tracking-tight text-[#6320EE]">
            이유
          </span>
          <span className="text-[10px] font-bold text-gray-400 mt-0.5">
            데이터 기반 정치 인사이트
          </span>
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
                  ? "bg-[#F4F0FF] text-[#6320EE] font-bold"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900 font-medium"
              }`}
            >
              <item.icon className={`w-4 h-4 ${isActive ? "stroke-[2.5]" : "stroke-2"}`} />
              <span className="text-[14px]">{item.title}</span>
            </Link>
          );
        })}
      </div>

      {/* 하단 Premium Access 배너 */}
      <div className="mt-auto pt-4 pb-2">
        <div className="bg-[#F8F9FA] rounded-2xl p-4 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#6320EE] text-white flex items-center justify-center font-black text-[10px]">
              이유
            </div>
            <div>
              <div className="text-[12px] font-black text-gray-900 leading-tight">Premium Access</div>
              <div className="text-[10px] text-gray-500">데이터 분석 무제한</div>
            </div>
          </div>
          <button className="w-full bg-[#6320EE] hover:bg-[#5218D0] text-white py-2.5 rounded-xl font-bold text-[12px] transition-colors shadow-sm">
            업그레이드
          </button>
        </div>
      </div>
    </nav>
  );
}
