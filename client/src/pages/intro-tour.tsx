import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft } from "lucide-react";

// ─── Illustration: Welcome ───────────────────────────────────────────────────
function WelcomeIllus() {
  const features = [
    { icon: "🗺️", label: "후보자 비교" },
    { icon: "📊", label: "표결 추적"  },
    { icon: "📰", label: "AI 뉴스"   },
    { icon: "💬", label: "커뮤니티"  },
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
            className="absolute inset-0 rounded-[32px] border-2 border-white/20"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1 + n * 0.22, opacity: 0 }}
            transition={{ duration: 2, delay: n * 0.5, repeat: Infinity, ease: "easeOut" }}
          />
        ))}
        <div className="w-28 h-28 rounded-[32px] bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-2xl border border-white/30">
          <span className="text-white font-black text-4xl tracking-tight">이유</span>
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
        2026 지방선거 D-15
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

// ─── Illustration: Candidates ─────────────────────────────────────────────────
function CandidateIllus() {
  const items = [
    { initials: "김", name: "김민준", party: "더불어민주당", color: "#3A6BFF", pct: 38 },
    { initials: "이", name: "이수현", party: "국민의힘",     color: "#FF3B3B", pct: 34 },
    { initials: "박", name: "박지우", party: "개혁신당",     color: "#f97316", pct: 18 },
  ];
  return (
    <div className="w-full max-w-[340px]">
      {/* Header chip */}
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full mb-4 w-fit"
      >
        <span className="text-white/80 text-[12px] font-black">📍 서울 광역단체장</span>
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
                <span className="text-[13px] font-black" style={{ color: c.color }}>{c.pct}%</span>
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

// ─── Illustration: Vote record ────────────────────────────────────────────────
function VoteIllus() {
  const member = { name: "홍길동", party: "더불어민주당", pColor: "#3A6BFF" };
  const bills = [
    { name: "민생회복지원금법",  vote: "찬성", yes: true  },
    { name: "반도체클러스터특별법", vote: "반대", yes: false },
    { name: "저출생대응특별법",  vote: "찬성", yes: true  },
    { name: "전세사기피해지원법", vote: "찬성", yes: true  },
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

// ─── Illustration: News ───────────────────────────────────────────────────────
function NewsIllus() {
  const sources = [
    { name: "조선일보", color: "#3A6BFF", headline: "여당, 지방선거 공천 마무리" },
    { name: "한겨레",   color: "#059669", headline: "야당 후보 지지율 급상승세" },
    { name: "중앙일보", color: "#f97316", headline: "경기지사 3파전 압축 전망" },
  ];
  return (
    <div className="w-full max-w-[340px] space-y-3">
      {/* AI summary banner */}
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-[20px] p-4 shadow-lg"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-black text-white">AI</div>
          <span className="text-[12px] font-black text-gray-800">핵심 요약</span>
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full ml-auto">12개 언론사</span>
        </div>
        <p className="text-[12px] text-gray-600 leading-relaxed">
          여야 공천이 마무리되며 주요 광역단체장 선거 판도가 윤곽을 드러내고 있습니다.
        </p>
      </motion.div>

      {/* News cards */}
      {sources.map((s, i) => (
        <motion.div
          key={s.name}
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 + i * 0.1 }}
          className="flex items-center gap-3 bg-white rounded-[16px] px-4 py-3 shadow-md"
        >
          <div className="w-1 h-8 rounded-full shrink-0" style={{ background: s.color }} />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold mb-0.5" style={{ color: s.color }}>{s.name}</div>
            <div className="text-[12px] font-bold text-gray-800 truncate">{s.headline}</div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Illustration: Community ──────────────────────────────────────────────────
function CommunityIllus() {
  const posts = [
    { avatar: "이", color: "#3A6BFF", title: "서울시장 후보 공약 비교해봤어요", likes: 142, hot: true },
    { avatar: "김", color: "#059669", title: "우리 동네 기초의원 누가 낫나요?",   likes: 87,  hot: false },
    { avatar: "박", color: "#f97316", title: "이번 선거 처음 투표하는데 어디서 정보 얻나요?", likes: 63, hot: false },
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

// ─── Illustration: Final ──────────────────────────────────────────────────────
function FinalIllus() {
  const icons = ["🗺️", "📊", "📰", "💬"];
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
  tag: string;
  title: string;
  desc: string;
  Illustration: () => React.JSX.Element;
}

const SLIDES: SlideData[] = [
  {
    id: 0,
    bg: "linear-gradient(150deg, #1e0040 0%, #4c1d95 50%, #6d28d9 100%)",
    accent: "#a78bfa",
    tag: "2026 지방선거",
    title: "이유있게\n투표하세요",
    desc: "후보자 공약부터 국회의원 표결, AI 정치 뉴스까지 — 투표에 필요한 모든 정보를 한 곳에서.",
    Illustration: WelcomeIllus,
  },
  {
    id: 1,
    bg: "linear-gradient(150deg, #0a1628 0%, #1e3a8a 50%, #2563eb 100%)",
    accent: "#93c5fd",
    tag: "기능 01",
    title: "공약 클릭 시\nAI 정밀 분석",
    desc: "무엇보다 중요한 기능입니다! 후보자의 공약을 클릭하면 AI가 실현가능성과 핵심 취약점을 다각도로 분석해 드립니다.",
    Illustration: CandidateIllus,
  },
  {
    id: 2,
    bg: "linear-gradient(150deg, #052e16 0%, #065f46 50%, #059669 100%)",
    accent: "#6ee7b7",
    tag: "기능 02",
    title: "국회의원\n표결 추적",
    desc: "300명 국회의원이 어떤 법안에 찬성·반대했는지 투명하게 공개해드려요.",
    Illustration: VoteIllus,
  },
  {
    id: 3,
    bg: "linear-gradient(150deg, #1a0a00 0%, #92400e 50%, #d97706 100%)",
    accent: "#fde68a",
    tag: "기능 03",
    title: "AI가 골라주는\n정치 뉴스",
    desc: "12개 주요 언론사 기사를 AI가 핵심만 정리해 편향 없이 중립적으로 전달해요.",
    Illustration: NewsIllus,
  },
  {
    id: 4,
    bg: "linear-gradient(150deg, #150a2e 0%, #3b0764 50%, #7c3aed 100%)",
    accent: "#d8b4fe",
    tag: "기능 04",
    title: "유권자\n커뮤니티",
    desc: "같은 지역 이웃들과 후보자·지역 현안에 대해 자유롭게 이야기 나눠요.",
    Illustration: CommunityIllus,
  },
  {
    id: 5,
    bg: "linear-gradient(150deg, #0c0020 0%, #3b0764 40%, #6d28d9 100%)",
    accent: "#c4b5fd",
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
    setLocation("/");
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
      className="min-h-screen w-full flex flex-col select-none overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Animated background ── */}
      <AnimatePresence>
        <motion.div
          key={index + "-bg"}
          className="fixed inset-0 -z-10"
          style={{ background: slide.bg }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55 }}
        />
      </AnimatePresence>

      {/* Decorative ambient glows */}
      <div className="fixed top-0 right-0 w-72 h-72 rounded-full bg-white/5 blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-48 left-0 w-56 h-56 rounded-full bg-white/5 blur-2xl pointer-events-none -z-10" />

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
        <div className="w-full max-w-[480px] mx-auto px-6 pt-5 pb-10">
          {/* Drag handle */}
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

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
                className="inline-flex items-center gap-1.5 text-[11px] font-black tracking-widest uppercase px-3 py-1 rounded-full mb-3 border"
                style={{ color: slide.accent === "#fde68a" ? "#b45309" : slide.accent.replace("fd", "8"), background: slide.accent + "18", borderColor: slide.accent + "33" }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: slide.accent === "#fde68a" ? "#b45309" : slide.accent }}
                />
                {slide.tag}
              </div>

              {/* Headline */}
              <h2 className="text-[36px] font-black text-gray-900 leading-[1.1] tracking-tight mb-3 whitespace-pre-line">
                {slide.title}
              </h2>

              {/* Description */}
              <p className="text-[14px] text-gray-500 leading-relaxed mb-6">
                {slide.desc}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center gap-3">
            {index > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => goTo(index - 1, -1)}
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
                className="flex-1 h-14 bg-[#6D28D9] hover:bg-[#5b21b6] active:scale-[0.98] text-white rounded-[16px] text-[16px] font-black flex items-center justify-center gap-2 shadow-xl shadow-[#6D28D9]/30 transition-all"
              >
                홈 화면으로 시작하기
                <ChevronRight className="w-5 h-5" />
              </motion.button>
            ) : (
              <button
                onClick={() => goTo(index + 1, 1)}
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
