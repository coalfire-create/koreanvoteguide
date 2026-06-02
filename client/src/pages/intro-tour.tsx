import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, MessageSquare, Users, Home, Search, User } from "lucide-react";
import { getDaysUntilElection } from "@/lib/election-config";

// ─── 하단 탭바 위치 안내 (어떤 탭을 누르면 되는지) ──────────────────────────────
// bottom-nav.tsx 와 동일한 순서: 커뮤니티 · 인물 · 홈(가운데) · 법안 · 마이
const TABS = [
  { icon: MessageSquare, label: "커뮤니티" },
  { icon: Users, label: "인물" },
  { icon: Home, label: "홈" },
  { icon: Search, label: "법안" },
  { icon: User, label: "마이" },
] as const;

function TabHint({ active, accent }: { active: number; accent: string }) {
  return (
    <div className="mb-4">
      <div className="text-[10px] font-bold text-gray-400 mb-1.5 text-center">
        화면 맨 아래 <span style={{ color: accent }}>{TABS[active].label}</span> 탭을 누르세요
      </div>
      <div className="relative flex items-end justify-around bg-gray-50 border border-gray-100 rounded-2xl px-2 py-2">
        {TABS.map((t, i) => {
          const on = i === active;
          return (
            <div key={t.label} className="flex flex-col items-center gap-0.5 flex-1">
              <motion.div
                animate={on ? { y: [-2, -6, -2] } : { y: 0 }}
                transition={on ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" } : {}}
                className="flex items-center justify-center rounded-xl"
                style={{
                  width: on ? 40 : 30,
                  height: on ? 40 : 30,
                  background: on ? accent : "transparent",
                  boxShadow: on ? `0 8px 18px ${accent}55` : "none",
                }}
              >
                <t.icon
                  className="shrink-0"
                  style={{ width: on ? 20 : 17, height: on ? 20 : 17, color: on ? "#fff" : "#cbd5e1" }}
                />
              </motion.div>
              <span
                className="text-[9px] font-bold"
                style={{ color: on ? accent : "#cbd5e1" }}
              >
                {t.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Illustration: Welcome ───────────────────────────────────────────────────
function WelcomeIllus() {
  const [dDay, setDDay] = useState(getDaysUntilElection);

  useEffect(() => {
    const id = setInterval(() => setDDay(getDaysUntilElection()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const features = [
    { icon: "🏠", label: "홈" },
    { icon: "👥", label: "인물" },
    { icon: "📜", label: "법안" },
    { icon: "💬", label: "커뮤니티" },
  ];
  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* App badge */}
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        className="relative"
      >
        {/* Pulse rings */}
        {[1, 2].map((n) => (
          <motion.div
            key={n}
            className="absolute inset-0 rounded-[32px] border-2 border-[#facc15]/20"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1 + n * 0.22, opacity: 0 }}
            transition={{ duration: 2, delay: n * 0.5, repeat: Infinity, ease: "easeOut" }}
          />
        ))}
        <div className="w-28 h-28 rounded-[32px] overflow-hidden shadow-2xl border border-[#facc15]/30">
          <img src="/app-icon.png" alt="이유" className="w-full h-full object-cover" />
        </div>
      </motion.div>

      {/* D-day badge */}
      <motion.div
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white text-[13px] font-bold px-4 py-2 rounded-full border border-white/20"
      >
        <span className="w-2 h-2 rounded-full bg-yellow-300 animate-pulse" />
        2026 지방선거 D-{dDay}
      </motion.div>

      {/* Feature chips row */}
      <motion.div
        className="flex flex-wrap justify-center gap-2 px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        {features.map((f, i) => (
          <motion.div
            key={f.label}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.35 + i * 0.08, type: "spring", stiffness: 260, damping: 22 }}
            className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20"
          >
            <span className="text-base leading-none">{f.icon}</span>
            <span className="text-white/90 text-[12px] font-bold">{f.label}</span>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

// ─── Illustration: 홈 탭 (내 지역 후보) ────────────────────────────────────────
function HomeIllus() {
  const items = [
    { initials: "김", name: "김민준", party: "민주당", color: "#3A6BFF", pct: 38 },
    { initials: "이", name: "이수현", party: "국민의힘", color: "#FF3B3B", pct: 34 },
    { initials: "박", name: "박지우", party: "개혁신당", color: "#f97316", pct: 18 },
  ];
  return (
    <div className="w-full max-w-[340px]">
      {/* Header chip */}
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full mb-4 w-fit"
      >
        <span className="text-white/90 text-[12px] font-black">📍 서울 · 광역단체장</span>
      </motion.div>

      {/* Candidate cards */}
      <div className="space-y-3">
        {items.map((c, i) => (
          <motion.div
            key={c.name}
            initial={{ x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 + i * 0.12, type: "spring", stiffness: 240, damping: 24 }}
            className="flex items-center gap-3 bg-white rounded-[20px] px-4 py-3 shadow-lg"
          >
            {/* Avatar */}
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-white text-[15px] font-black shrink-0 shadow-md"
              style={{ background: `linear-gradient(135deg, ${c.color}cc, ${c.color})` }}
            >
              {c.initials}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[14px] font-black text-gray-900">{c.name}</span>
                <span className="text-[12px] font-bold text-gray-400">탭하여 공약 보기 ›</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${c.pct}%` }}
                  transition={{ delay: 0.4 + i * 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${c.color}99, ${c.color})` }}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Illustration: 인물 탭 (의원 표결·성향) ────────────────────────────────────
function PeopleIllus() {
  const member = { name: "홍길동", party: "민주당", pColor: "#3A6BFF" };
  const bills = [
    { name: "민생회복지원금법", vote: "찬성", yes: true },
    { name: "반도체클러스터특별법", vote: "반대", yes: false },
    { name: "저출생대응특별법", vote: "찬성", yes: true },
    { name: "전세사기피해지원법", vote: "찬성", yes: true },
  ];
  const yesCount = bills.filter((b) => b.yes).length;

  return (
    <div className="w-full max-w-[340px]">
      {/* Member card */}
      <motion.div
        initial={{ y: -12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center gap-3 bg-white rounded-[20px] px-4 py-3 shadow-lg mb-3"
      >
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center text-white text-[15px] font-black shrink-0 shadow-md"
          style={{ background: `linear-gradient(135deg, ${member.pColor}99, ${member.pColor})` }}
        >
          홍
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-black text-gray-900">{member.name}</div>
          <div className="text-[11px] font-bold mt-0.5" style={{ color: member.pColor }}>{member.party}</div>
        </div>
        {/* Stats */}
        <div className="flex gap-2">
          <div className="text-center">
            <div className="text-[15px] font-black text-emerald-500">{yesCount}</div>
            <div className="text-[9px] text-gray-400 font-bold">찬성</div>
          </div>
          <div className="text-center">
            <div className="text-[15px] font-black text-red-400">{bills.length - yesCount}</div>
            <div className="text-[9px] text-gray-400 font-bold">반대</div>
          </div>
        </div>
      </motion.div>

      {/* Bill list */}
      <div className="bg-white rounded-[20px] shadow-lg overflow-hidden">
        {bills.map((b, i) => (
          <motion.div
            key={b.name}
            initial={{ x: -16, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.15 + i * 0.1 }}
            className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 last:border-0"
          >
            <span className="text-[12px] text-gray-700 font-semibold truncate flex-1 pr-3">{b.name}</span>
            <span
              className="text-[11px] font-black px-2.5 py-1 rounded-full shrink-0"
              style={
                b.yes
                  ? { background: "#d1fae5", color: "#059669" }
                  : { background: "#fee2e2", color: "#ef4444" }
              }
            >
              {b.vote}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Illustration: 법안 탭 (검색 + AI 해설) ────────────────────────────────────
function BillIllus() {
  const bills = [
    { name: "저출생대응특별법", tag: "심사중", tagColor: "#f59e0b" },
    { name: "전세사기피해지원법", tag: "본회의 통과", tagColor: "#059669" },
  ];
  return (
    <div className="w-full max-w-[340px] space-y-3">
      {/* Search bar */}
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center gap-2 bg-white rounded-full px-4 py-3 shadow-lg"
      >
        <Search className="w-4 h-4 text-gray-400" />
        <span className="text-[13px] text-gray-400 font-semibold">법안 이름으로 검색…</span>
      </motion.div>

      {/* AI 해설 카드 */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="bg-white rounded-[20px] p-4 shadow-lg"
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[13px] font-black text-gray-900">저출생대응특별법</span>
          <span className="text-[10px] font-black text-white bg-violet-500 px-2 py-0.5 rounded-full ml-auto">AI 해설</span>
        </div>
        {[
          { q: "왜 나왔나", a: "출산·양육 부담을 줄이려고", color: "#6d28d9" },
          { q: "누구에게 좋은가", a: "신혼·양육 가구", color: "#059669" },
          { q: "누구에게 부담", a: "일부 기업·재정", color: "#ef4444" },
        ].map((row, i) => (
          <motion.div
            key={row.q}
            initial={{ x: -12, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.25 + i * 0.1 }}
            className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0"
          >
            <span className="text-[11px] font-black shrink-0 w-[72px]" style={{ color: row.color }}>{row.q}</span>
            <span className="text-[11px] text-gray-600 font-semibold flex-1">{row.a}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* 관련 법안 미니 리스트 */}
      <div className="bg-white rounded-[16px] shadow-md overflow-hidden">
        {bills.map((b, i) => (
          <motion.div
            key={b.name}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 + i * 0.1 }}
            className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 last:border-0"
          >
            <span className="text-[12px] text-gray-700 font-semibold truncate flex-1 pr-3">{b.name}</span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full shrink-0" style={{ background: `${b.tagColor}1a`, color: b.tagColor }}>
              {b.tag}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Illustration: 커뮤니티 탭 ─────────────────────────────────────────────────
function CommunityIllus() {
  const posts = [
    { avatar: "이", color: "#3A6BFF", title: "서울시장 후보 공약 비교해봤어요", likes: 142, hot: true },
    { avatar: "김", color: "#059669", title: "우리 동네 기초의원 누가 낫나요?", likes: 87, hot: false },
    { avatar: "박", color: "#f97316", title: "처음 투표하는데 어디서 정보 얻나요?", likes: 63, hot: false },
  ];
  return (
    <div className="w-full max-w-[340px] space-y-3">
      {posts.map((p, i) => (
        <motion.div
          key={p.title}
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 + i * 0.12, type: "spring", stiffness: 240, damping: 24 }}
          className="flex items-start gap-3 bg-white rounded-[20px] p-4 shadow-lg"
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-black shrink-0 shadow"
            style={{ background: `linear-gradient(135deg, ${p.color}99, ${p.color})` }}
          >
            {p.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-gray-800 leading-snug mb-2 line-clamp-2">{p.title}</p>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-rose-400 font-bold">♥ {p.likes}</span>
              {p.hot && (
                <span className="text-[10px] font-black text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full">🔥 인기</span>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Illustration: 마이 탭 ─────────────────────────────────────────────────────
function MoreIllus() {
  const menu = [
    { icon: "📍", label: "내 지역 변경", desc: "서울 · 경기 …" },
    { icon: "⭐", label: "즐겨찾기", desc: "관심 후보·의원" },
    { icon: "🔔", label: "알림 설정", desc: "선거 D-day 알림" },
    { icon: "👤", label: "로그인 · 계정", desc: "내 정보 관리" },
  ];
  return (
    <div className="w-full max-w-[340px] space-y-3">
      {/* Profile header */}
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center gap-3 bg-white rounded-[20px] px-4 py-3.5 shadow-lg"
      >
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center text-white text-[15px] font-black shadow-md">
          나
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-black text-gray-900">나의 이유</div>
          <div className="text-[11px] font-bold text-gray-400 mt-0.5">서울 유권자</div>
        </div>
      </motion.div>

      {/* Menu rows */}
      <div className="bg-white rounded-[20px] shadow-lg overflow-hidden">
        {menu.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ x: 16, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.12 + i * 0.1 }}
            className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0"
          >
            <span className="text-lg w-6 text-center">{m.icon}</span>
            <div className="flex-1">
              <div className="text-[13px] font-bold text-gray-800">{m.label}</div>
              <div className="text-[10px] text-gray-400 font-semibold">{m.desc}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Illustration: Final ──────────────────────────────────────────────────────
function FinalIllus() {
  const icons = ["🏠", "👥", "📜", "💬"];
  return (
    <div className="flex flex-col items-center gap-5">
      <motion.div
        className="relative"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 16 }}
      >
        {/* Orbit ring */}
        <motion.div
          className="absolute inset-[-28px] rounded-full border-2 border-white/20"
          animate={{ rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        >
          {icons.map((icon, i) => (
            <div
              key={i}
              className="absolute w-9 h-9 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-lg border border-white/20 shadow-lg"
              style={{
                top: "50%",
                left: "50%",
                transform: `rotate(${i * 90}deg) translateX(44px) rotate(-${i * 90}deg) translate(-50%, -50%)`,
              }}
            >
              {icon}
            </div>
          ))}
        </motion.div>

        {/* Center badge */}
        <div className="w-24 h-24 rounded-[28px] bg-white/25 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-2xl">
          <motion.span
            className="text-5xl"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
          >
            ✓
          </motion.span>
        </div>
      </motion.div>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white text-[13px] font-bold px-4 py-2 rounded-full border border-white/20"
      >
        <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
        준비가 완료됐어요
      </motion.div>
    </div>
  );
}

// ─── Slide data ───────────────────────────────────────────────────────────────

interface SlideData {
  id: number;
  bg: string;
  accent: string;
  accentText?: string;
  tag: string;
  title: string;
  desc: string;
  tabIndex?: number; // 하단 탭바에서 강조할 탭 (없으면 미표시)
  Illustration: () => React.JSX.Element;
}

const SLIDES: SlideData[] = [
  {
    id: 0,
    bg: "linear-gradient(140deg, #000000 0%, #111111 40%, #201a09 100%)",
    accent: "#facc15",
    accentText: "#a16207",
    tag: "사용 가이드",
    title: "이렇게\n사용하세요",
    desc: "이유는 화면 맨 아래 5개 탭으로 움직여요. 탭마다 무엇을 할 수 있는지 하나씩 알려드릴게요.",
    Illustration: WelcomeIllus,
  },
  {
    id: 1,
    bg: "linear-gradient(140deg, #020617 0%, #1e3a8a 50%, #2563eb 100%)",
    accent: "#60a5fa",
    accentText: "#1d4ed8",
    tag: "① 홈 탭",
    title: "홈에서\n후보·공약 비교",
    desc: "앱을 켜면 가장 먼저 보이는 화면이에요. ① 내 지역의 단체장·기초의원 후보가 한눈에 뜨고, 두 후보의 맞대결도 보여줘요. ② 아래 '핵심 공약 비교'에서 후보 공약 카드를 2개 고르면, AI가 5개 축으로 나란히 채점해 강·약점을 비교해줘요. ③ 후보 이름을 누르면 공약·이력·뉴스 상세로, 위쪽에서 지역도 바꿀 수 있어요.",
    tabIndex: 2,
    Illustration: HomeIllus,
  },
  {
    id: 2,
    bg: "linear-gradient(140deg, #020617 0%, #064e3b 50%, #059669 100%)",
    accent: "#34d399",
    accentText: "#047857",
    tag: "② 인물 탭",
    title: "인물에서\n정치인 파헤치기",
    desc: "현직 국회의원과 출마 후보를 검색해요. 이름을 누르면 정치 성향, 입법 관심분야, 그리고 실제로 어떤 법안에 찬성·반대했는지 표결 기록까지 확인할 수 있어요.",
    tabIndex: 1,
    Illustration: PeopleIllus,
  },
  {
    id: 3,
    bg: "linear-gradient(140deg, #020617 0%, #4c1d95 50%, #7c3aed 100%)",
    accent: "#a78bfa",
    accentText: "#6d28d9",
    tag: "③ 법안 탭",
    title: "법안에서\nAI 해설 보기",
    desc: "관심 있는 법안을 검색하면, AI가 '왜 나왔고 · 누구에게 좋은지 · 누구에게 부담인지'를 쉽게 풀어줘요. 어려운 법안도 한눈에 이해할 수 있어요.",
    tabIndex: 3,
    Illustration: BillIllus,
  },
  {
    id: 4,
    bg: "linear-gradient(140deg, #020617 0%, #78350f 50%, #d97706 100%)",
    accent: "#fbbf24",
    accentText: "#b45309",
    tag: "④ 커뮤니티 탭",
    title: "커뮤니티에서\n이웃과 토론",
    desc: "같은 지역 이웃들과 후보·지역 현안을 이야기해요. 글쓰기 버튼으로 질문을 올리고, '오늘의 투표'에 참여해 여론을 확인해보세요.",
    tabIndex: 0,
    Illustration: CommunityIllus,
  },
  {
    id: 5,
    bg: "linear-gradient(140deg, #020617 0%, #334155 50%, #64748b 100%)",
    accent: "#cbd5e1",
    accentText: "#475569",
    tag: "⑤ 마이 탭",
    title: "마이에서\n내 설정 관리",
    desc: "내 지역 변경, 즐겨찾기한 후보·의원, 알림 설정, 로그인·계정 관리를 모두 여기서 할 수 있어요.",
    tabIndex: 4,
    Illustration: MoreIllus,
  },
  {
    id: 6,
    bg: "linear-gradient(140deg, #000000 0%, #111111 40%, #1c1809 100%)",
    accent: "#facc15",
    accentText: "#a16207",
    tag: "준비 완료",
    title: "이제\n시작해볼까요?",
    desc: "이유있는 투표와 함께 이번 2026 지방선거, 제대로 준비해보세요.",
    Illustration: FinalIllus,
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

const contentVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 64 : -64, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir: number) => ({ x: dir < 0 ? 64 : -64, opacity: 0 }),
};

export default function IntroTour() {
  const [, setLocation] = useLocation();
  const [index, setIndex]     = useState(0);
  const [direction, setDir]   = useState(1);
  const touchStartX = useRef<number | null>(null);

  const goTo = (next: number, dir: number) => { setDir(dir); setIndex(next); };

  const handleDone = () => {
    localStorage.setItem("hasSeenTour", "true");
    window.location.href = "/";
  };

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(dx) > 48) {
      if (dx > 0 && index < SLIDES.length - 1) goTo(index + 1, 1);
      if (dx < 0 && index > 0) goTo(index - 1, -1);
    }
    touchStartX.current = null;
  };

  const slide  = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  return (
    <div
      className="relative z-0 min-h-screen w-full flex flex-col select-none overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Animated background ── */}
      <AnimatePresence>
        <motion.div
          key={index + "-bg"}
          className="absolute inset-0 -z-10"
          style={{ background: slide.bg }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55 }}
        />
      </AnimatePresence>

      {/* Decorative ambient glows */}
      <div
        className="absolute top-0 right-0 w-72 h-72 rounded-full blur-3xl pointer-events-none -z-10 transition-colors duration-500"
        style={{ backgroundColor: `${slide.accent}0d` }}
      />
      <div
        className="absolute bottom-48 left-0 w-56 h-56 rounded-full blur-2xl pointer-events-none -z-10 transition-colors duration-500"
        style={{ backgroundColor: `${slide.accent}0d` }}
      />

      {/* ── Top bar ── */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-12 pb-0 w-full max-w-[480px] mx-auto">
        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {SLIDES.map((_, i) => (
            <motion.button
              key={i}
              onClick={() => goTo(i, i > index ? 1 : -1)}
              animate={{ width: i === index ? 22 : 6, opacity: i <= index ? 1 : 0.35 }}
              transition={{ duration: 0.3 }}
              className="h-[6px] rounded-full bg-white focus:outline-none"
            />
          ))}
        </div>

        {!isLast && (
          <button
            onClick={handleDone}
            className="text-white/55 text-[13px] font-bold hover:text-white/85 transition-colors"
          >
            건너뛰기
          </button>
        )}
      </div>

      {/* ── Illustration area ── */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-5 py-8 w-full max-w-[480px] mx-auto">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={index + "-illus"}
            custom={direction}
            variants={contentVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="w-full flex items-center justify-center"
          >
            <slide.Illustration />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Bottom sheet ── */}
      <div className="relative z-10 w-full bg-white rounded-t-[32px] shadow-[0_-8px_48px_rgba(0,0,0,0.18)]">
        <div className="w-full max-w-[480px] mx-auto px-6 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px)+0.75rem)]">
          {/* Drag handle */}
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3" />

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={index + "-text"}
              custom={direction}
              variants={contentVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Tag */}
              <div
                className="inline-flex items-center gap-1.5 text-[11px] font-black tracking-widest uppercase px-3 py-1 rounded-full mb-2 border"
                style={{
                  color: slide.accentText || slide.accent,
                  background: slide.accent + "18",
                  borderColor: slide.accent + "33"
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: slide.accent }}
                />
                {slide.tag}
              </div>

              {/* Headline */}
              <h2 className="text-[28px] font-black text-gray-900 leading-[1.15] tracking-tight mb-2 whitespace-pre-line">
                {slide.title}
              </h2>

              {/* Description */}
              <p className="text-[13px] text-gray-500 leading-relaxed mb-4">
                {slide.desc}
              </p>

              {/* 하단 탭 위치 안내 */}
              {slide.tabIndex !== undefined && (
                <TabHint active={slide.tabIndex} accent={slide.accentText || slide.accent} />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center gap-3">
            {index > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => goTo(index - 1, -1)}
                onTouchStart={(e: any) => e.stopPropagation()}
                onTouchEnd={(e: any) => e.stopPropagation()}
                className="w-14 h-14 rounded-[16px] bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors active:scale-95"
              >
                <ChevronLeft className="w-5 h-5 text-gray-500" />
              </motion.button>
            )}

            {isLast ? (
              <motion.button
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15 }}
                onClick={handleDone}
                onTouchStart={(e: any) => e.stopPropagation()}
                onTouchEnd={(e: any) => e.stopPropagation()}
                className="flex-1 h-14 bg-[#0F172A] hover:bg-[#1e293b] active:scale-[0.98] text-white rounded-[16px] text-[16px] font-black flex items-center justify-center gap-2 shadow-xl shadow-[#0F172A]/30 transition-all"
              >
                홈 화면으로 시작하기
                <ChevronRight className="w-5 h-5" />
              </motion.button>
            ) : (
              <button
                onClick={() => goTo(index + 1, 1)}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                className="flex-1 h-14 bg-gray-900 hover:bg-gray-800 active:scale-[0.98] text-white rounded-[16px] text-[16px] font-black flex items-center justify-center gap-2 transition-all"
              >
                다음
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
