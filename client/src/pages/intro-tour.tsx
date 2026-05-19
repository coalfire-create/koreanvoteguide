import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Map, BarChart2, Newspaper, MessageCircle, CheckCircle2 } from "lucide-react";

// ── Mini illustration components ────────────────────────────────────────────

function CandidateIllustration() {
  const candidates = [
    { name: "김○○", party: "더불어민주당", color: "#3A6BFF", pct: 38 },
    { name: "이○○", party: "국민의힘",     color: "#FF3B3B", pct: 34 },
    { name: "박○○", party: "개혁신당",     color: "#f97316", pct: 18 },
  ];
  return (
    <div className="w-full max-w-[280px] bg-white rounded-[20px] shadow-lg overflow-hidden border border-gray-100">
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <Map className="w-4 h-4 text-[#6D28D9]" />
        <span className="text-[13px] font-black text-gray-800">서울 광역단체장</span>
      </div>
      <div className="px-4 pb-4 space-y-2.5">
        {candidates.map((c) => (
          <div key={c.name} className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0"
              style={{ background: c.color }}
            >
              {c.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[12px] font-black text-gray-900">{c.name}</span>
                <span className="text-[11px] font-bold" style={{ color: c.color }}>{c.pct}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${c.pct}%` }}
                  transition={{ delay: 0.3, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full rounded-full"
                  style={{ background: c.color }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VoteIllustration() {
  const bills = [
    { name: "민생회복지원금법",   vote: "찬성", color: "#059669" },
    { name: "반도체특별법",       vote: "반대", color: "#ef4444" },
    { name: "저출생대응특별법",   vote: "찬성", color: "#059669" },
  ];
  return (
    <div className="w-full max-w-[280px] bg-white rounded-[20px] shadow-lg overflow-hidden border border-gray-100">
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <BarChart2 className="w-4 h-4 text-blue-600" />
        <span className="text-[13px] font-black text-gray-800">국회의원 표결 기록</span>
      </div>
      <div className="px-4 pb-4 space-y-2">
        {bills.map((b, i) => (
          <motion.div
            key={b.name}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0"
          >
            <span className="text-[12px] text-gray-700 font-medium truncate flex-1 pr-2">{b.name}</span>
            <span
              className="text-[11px] font-black px-2 py-0.5 rounded-full shrink-0"
              style={{ background: `${b.color}18`, color: b.color }}
            >
              {b.vote}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function NewsIllustration() {
  const items = [
    { source: "조선일보", headline: "여당, 지방선거 공천 마무리…",  time: "2시간 전" },
    { source: "한겨레",   headline: "야당 후보 지지율 상승세…",     time: "4시간 전" },
  ];
  return (
    <div className="w-full max-w-[280px] bg-white rounded-[20px] shadow-lg overflow-hidden border border-gray-100">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-emerald-600" />
          <span className="text-[13px] font-black text-gray-800">AI 뉴스 분석</span>
        </div>
        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">12개 언론사</span>
      </div>
      <div className="px-4 pb-4 space-y-2.5">
        {items.map((n, i) => (
          <motion.div
            key={n.source}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.15 }}
            className="flex gap-2.5 p-2.5 bg-gray-50 rounded-[12px]"
          >
            <div className="w-1 bg-emerald-400 rounded-full shrink-0" />
            <div>
              <div className="text-[10px] font-bold text-gray-400 mb-0.5">{n.source} · {n.time}</div>
              <div className="text-[12px] font-bold text-gray-800 leading-tight">{n.headline}</div>
            </div>
          </motion.div>
        ))}
        <div className="flex items-center gap-1.5 p-2 bg-emerald-50 rounded-[10px]">
          <span className="text-[10px] font-black text-emerald-600">✦ AI 핵심 요약</span>
          <span className="text-[10px] text-gray-500">중립적으로 분석했어요</span>
        </div>
      </div>
    </div>
  );
}

function CommunityIllustration() {
  const posts = [
    { title: "서울시장 후보 공약 비교해봤어요", likes: 142, comments: 38 },
    { title: "우리 동네 기초의원 누구가 낫나요?", likes: 87,  comments: 21 },
  ];
  return (
    <div className="w-full max-w-[280px] bg-white rounded-[20px] shadow-lg overflow-hidden border border-gray-100">
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-orange-500" />
        <span className="text-[13px] font-black text-gray-800">유권자 커뮤니티</span>
      </div>
      <div className="px-4 pb-4 space-y-2">
        {posts.map((p, i) => (
          <motion.div
            key={p.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.15 }}
            className="p-3 bg-gray-50 rounded-[14px]"
          >
            <p className="text-[12px] font-bold text-gray-800 leading-snug mb-2">{p.title}</p>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-gray-400">❤ {p.likes}</span>
              <span className="text-[10px] text-gray-400">💬 {p.comments}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Slide data ───────────────────────────────────────────────────────────────

const SLIDES = [
  {
    id: 0,
    bg: "linear-gradient(145deg, #1e0040 0%, #4c1d95 45%, #6d28d9 100%)",
    tagColor: "#c4b5fd",
    tag: "2026 지방선거 D-15",
    title: "이유있게\n투표하세요",
    desc: "후보자 공약·국회의원 활동·정치 뉴스·커뮤니티\n투표 전 알아야 할 모든 걸 한 앱에서.",
    Illustration: () => (
      <div className="flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-[24px] bg-white/20 backdrop-blur flex items-center justify-center shadow-2xl border border-white/20">
          <span className="text-white font-black text-3xl">이유</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white/15 text-white/80 text-[12px] font-bold px-3 py-1.5 rounded-full border border-white/10">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-300 animate-pulse" />
          2026 지방선거 디데이 카운트다운
        </div>
      </div>
    ),
  },
  {
    id: 1,
    bg: "linear-gradient(145deg, #0c1445 0%, #1d3a8a 50%, #2563eb 100%)",
    tagColor: "#93c5fd",
    tag: "기능 ①",
    title: "내 지역\n후보자 비교",
    desc: "선택한 지역의 광역단체장·기초단체장 후보들의\n공약, 이력, 뉴스를 한눈에 비교해요.",
    Illustration: CandidateIllustration,
  },
  {
    id: 2,
    bg: "linear-gradient(145deg, #052e16 0%, #065f46 50%, #059669 100%)",
    tagColor: "#6ee7b7",
    tag: "기능 ②",
    title: "국회의원\n표결 추적",
    desc: "300명 국회의원이 어떤 법안에 어떻게 투표했는지\n투명하게 공개해드려요.",
    Illustration: VoteIllustration,
  },
  {
    id: 3,
    bg: "linear-gradient(145deg, #431407 0%, #9a3412 50%, #ea580c 100%)",
    tagColor: "#fdba74",
    tag: "기능 ③",
    title: "AI가 골라주는\n정치 뉴스",
    desc: "12개 주요 언론사 기사를 AI가 핵심만 정리해\n편향 없이 중립적으로 전달해요.",
    Illustration: NewsIllustration,
  },
  {
    id: 4,
    bg: "linear-gradient(145deg, #1c0533 0%, #3b0764 50%, #7c3aed 100%)",
    tagColor: "#d8b4fe",
    tag: "기능 ④",
    title: "유권자\n커뮤니티",
    desc: "같은 지역 이웃들과 후보자·지역 현안에 대해\n자유롭게 이야기 나눠요.",
    Illustration: CommunityIllustration,
  },
  {
    id: 5,
    bg: "linear-gradient(145deg, #1e0040 0%, #4c1d95 45%, #6d28d9 100%)",
    tagColor: "#a78bfa",
    tag: "준비 완료",
    title: "이제\n시작해볼까요?",
    desc: "이유있는 투표와 함께\n이번 2026 지방선거, 제대로 준비해보세요.",
    Illustration: () => (
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.15 }}
        className="w-24 h-24 rounded-full bg-white/15 backdrop-blur flex items-center justify-center border border-white/20 shadow-2xl"
      >
        <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={1.5} />
      </motion.div>
    ),
  },
];

// ── Page component ───────────────────────────────────────────────────────────

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "60%" : "-60%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir: number) => ({ x: dir < 0 ? "60%" : "-60%", opacity: 0 }),
};

export default function IntroTour() {
  const [, setLocation] = useLocation();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const touchStart = useRef<number | null>(null);

  const goTo = (next: number, dir: number) => {
    setDirection(dir);
    setIndex(next);
  };

  const handleNext = () => {
    if (index < SLIDES.length - 1) goTo(index + 1, 1);
  };

  const handlePrev = () => {
    if (index > 0) goTo(index - 1, -1);
  };

  const handleDone = () => {
    localStorage.setItem("hasSeenTour", "true");
    setLocation("/");
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const delta = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 50) {
      if (delta > 0 && index < SLIDES.length - 1) goTo(index + 1, 1);
      if (delta < 0 && index > 0) goTo(index - 1, -1);
    }
    touchStart.current = null;
  };

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  return (
    <div
      className="min-h-screen w-full flex flex-col overflow-hidden relative"
      style={{ background: slide.bg, transition: "background 0.6s ease" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 pointer-events-none blur-3xl" />
      <div className="absolute bottom-20 left-0 w-48 h-48 rounded-full bg-white/5 pointer-events-none blur-2xl" />

      {/* ─── Top bar ─── */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-14 pb-2 w-full max-w-[440px] mx-auto">
        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i, i > index ? 1 : -1)}
              className="transition-all duration-300 rounded-full"
              style={{
                width: i === index ? 20 : 6,
                height: 6,
                background: i === index ? "white" : "rgba(255,255,255,0.3)",
              }}
            />
          ))}
        </div>

        {/* Skip */}
        {!isLast && (
          <button
            onClick={handleDone}
            className="text-white/60 text-[13px] font-bold hover:text-white/90 transition-colors"
          >
            건너뛰기
          </button>
        )}
      </div>

      {/* ─── Slide content ─── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-between px-6 pb-10 w-full max-w-[440px] mx-auto overflow-hidden">

        {/* Illustration area */}
        <div className="flex-1 flex items-center justify-center py-6 w-full">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={index + "-illus"}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center justify-center w-full"
            >
              <slide.Illustration />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Text area */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={index + "-text"}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="w-full mb-8"
          >
            <div
              className="inline-block text-[11px] font-black tracking-widest uppercase px-3 py-1 rounded-full mb-4 border border-white/20"
              style={{ color: slide.tagColor, background: "rgba(255,255,255,0.1)" }}
            >
              {slide.tag}
            </div>

            <h2 className="text-[38px] font-black text-white leading-[1.1] tracking-tight mb-3 whitespace-pre-line">
              {slide.title}
            </h2>

            <p className="text-[14px] text-white/65 leading-relaxed whitespace-pre-line">
              {slide.desc}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="w-full flex items-center gap-3">
          {index > 0 && (
            <button
              onClick={handlePrev}
              className="w-14 h-14 rounded-[16px] bg-white/15 backdrop-blur flex items-center justify-center border border-white/20 transition-all active:scale-95"
            >
              <ChevronRight className="w-5 h-5 text-white rotate-180" />
            </button>
          )}

          {isLast ? (
            <motion.button
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              onClick={handleDone}
              className="flex-1 h-14 bg-white text-[#6D28D9] rounded-[16px] text-[16px] font-black flex items-center justify-center gap-2 shadow-2xl shadow-black/20 transition-all active:scale-[0.98]"
            >
              홈 화면으로 시작하기
              <ChevronRight className="w-5 h-5" />
            </motion.button>
          ) : (
            <button
              onClick={handleNext}
              className="flex-1 h-14 bg-white/20 backdrop-blur hover:bg-white/25 border border-white/20 text-white rounded-[16px] text-[16px] font-black flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              다음
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
