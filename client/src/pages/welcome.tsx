import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Search, UserCheck, Bell, ChevronLeft, X, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useAssemblyMembers } from "@/lib/api-data";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PoliticianPhoto } from "@/components/PoliticianPhoto";
import { getPartyRank } from "@/lib/mock-data";

type Step = 0 | 1 | 2;
const TOTAL_STEPS = 3;

export default function Welcome() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const [step, setStep] = useState<Step>(0);

  // OAuth 콜백에서 /welcome?loginSuccess=1 으로 온 경우 auth 쿼리 즉시 갱신
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("loginSuccess") === "1") {
      url.searchParams.delete("loginSuccess");
      window.history.replaceState({}, "", url.pathname + (url.search || ""));
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    }
  }, []);

  // 비로그인 시 로그인으로
  useEffect(() => {
    if (!isLoading && !user) setLocation("/login");
  }, [isLoading, user, setLocation]);

  const finish = () => {
    try { localStorage.setItem("welcomeDone", "1"); } catch {}
    setLocation("/");
  };

  const next = () => setStep((s) => (s < TOTAL_STEPS - 1 ? ((s + 1) as Step) : s));
  const skip = () => {
    // 마지막 단계가 아니면 마지막(안내) 단계로 점프, 마지막이면 종료
    if (step < TOTAL_STEPS - 1) setStep((TOTAL_STEPS - 1) as Step);
    else finish();
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col text-foreground">
      {/* 상단 진행바 + 건너뛰기 */}
      <header className="sticky top-0 z-20 bg-black backdrop-blur-xl border-b border-gray-800 px-4 pt-[env(safe-area-inset-top)] text-white">
        <div className="flex items-center gap-3 h-12">
          {step > 0 ? (
            <button
              onClick={() => setStep((s) => (s > 0 ? ((s - 1) as Step) : s))}
              className="p-1 -ml-1 active:opacity-60"
              aria-label="이전"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
          ) : (
            <div className="w-7" />
          )}
          <div className="flex-1 flex items-center gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full flex-1 transition-colors ${
                  i <= step ? "bg-indigo-500" : "bg-gray-800"
                }`}
              />
            ))}
          </div>
          <button
            onClick={skip}
            className="text-[13px] font-bold text-gray-300 active:opacity-60 px-1"
          >
            건너뛰기
          </button>
        </div>
      </header>

      {/* 본문 */}
      <main className="flex-1 px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+96px)]">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <NicknameStep
              key="nickname"
              initial={user.nickname || user.name || ""}
              onDone={next}
              onSkip={() => setStep(1)}
            />
          )}
          {step === 1 && (
            <FollowStep
              key="follow"
              onDone={next}
              onSkip={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <TipsStep
              key="tips"
              onDone={finish}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — 닉네임
// ─────────────────────────────────────────────────────────────────────────────
function NicknameStep({
  initial,
  onDone,
  onSkip,
}: {
  initial: string;
  onDone: () => void;
  onSkip: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(initial);
  const trimmed = value.trim();
  const valid = trimmed.length >= 2 && trimmed.length <= 20;

  const mutation = useMutation({
    mutationFn: async (nickname: string) => {
      const res = await apiRequest("PATCH", "/api/users/nickname", { nickname });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "변경 실패");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      onDone();
    },
    onError: (e: Error) => {
      toast({ title: "닉네임 변경 실패", description: e.message, variant: "destructive" });
    },
  });

  const submit = () => {
    if (!valid) return;
    // 이미 같은 닉네임이면 그대로 진행 (API 호출 생략)
    if (trimmed === initial.trim()) {
      onDone();
      return;
    }
    mutation.mutate(trimmed);
  };

  return (
    <motion.section
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.2 }}
      className="max-w-md mx-auto"
    >
      <div className="mb-7">
        <span className="inline-block text-[10px] font-black tracking-wider text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md mb-3">
          STEP 1 / 3
        </span>
        <h1 className="text-[24px] font-black leading-tight text-gray-900">
          어떻게 불러드릴까요?
        </h1>
        <p className="text-[13px] text-gray-500 mt-1.5 leading-relaxed">
          커뮤니티에서 표시될 닉네임을 정해 주세요.<br />
          2~20자, 한글·영문·숫자 모두 가능합니다.
        </p>
      </div>

      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="예: 정치알리미"
        maxLength={20}
        className="h-14 rounded-2xl border-gray-200 text-[16px] px-4"
        autoFocus
      />
      <p className="text-[11px] text-gray-400 mt-2 px-1">
        {trimmed.length}/20 · 변경 후 7일간 다시 변경할 수 없어요
      </p>

      <FooterActions
        primaryLabel={mutation.isPending ? "저장 중…" : "다음"}
        primaryDisabled={!valid || mutation.isPending}
        onPrimary={submit}
        secondaryLabel="나중에"
        onSecondary={onSkip}
      />
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — 의원 팔로우
// ─────────────────────────────────────────────────────────────────────────────
function FollowStep({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const { members, isLoading } = useAssemblyMembers();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const list = useMemo(() => {
    const all = (members ?? []) as any[];
    const q = query.trim();
    const filtered = q
      ? all.filter((m) =>
          (m.name || "").includes(q) ||
          (m.party || "").includes(q) ||
          (m.district || "").includes(q)
        )
      : all;
    // 정당 우선순위로 정렬
    return [...filtered]
      .sort((a, b) => getPartyRank(a.party) - getPartyRank(b.party) || a.name.localeCompare(b.name))
      .slice(0, 60);
  }, [members, query]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const followMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // 병렬 follow — 일부 실패해도 나머지는 진행
      const results = await Promise.allSettled(
        ids.map((id) =>
          apiRequest("POST", `/api/users/me/follows/${encodeURIComponent(id)}`).then((r) => {
            if (!r.ok && r.status !== 409) throw new Error(`${id}: ${r.status}`);
            return id;
          })
        )
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.length - ok;
      return { ok, fail };
    },
    onSuccess: ({ ok, fail }) => {
      if (ok > 0) toast({ title: `${ok}명 팔로우 완료`, description: fail ? `${fail}건 실패` : undefined });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/follows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feed/stories"] });
      onDone();
    },
    onError: (e: Error) => {
      toast({ title: "팔로우 실패", description: e.message, variant: "destructive" });
    },
  });

  const submit = () => {
    if (selected.size === 0) {
      onDone();
      return;
    }
    followMutation.mutate([...selected]);
  };

  return (
    <motion.section
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.2 }}
      className="max-w-md mx-auto"
    >
      <div className="mb-5">
        <span className="inline-block text-[10px] font-black tracking-wider text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md mb-3">
          STEP 2 / 3
        </span>
        <h1 className="text-[24px] font-black leading-tight text-gray-900">
          관심 있는 의원을 골라 주세요
        </h1>
        <p className="text-[13px] text-gray-500 mt-1.5 leading-relaxed">
          팔로우한 의원의 법안·표결·뉴스가 인물 탭에 모입니다.<br />
          여러 명을 선택할 수 있어요.
        </p>
      </div>

      {/* 검색 */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="의원·정당·지역구 검색"
          className="h-11 rounded-2xl border-gray-200 pl-10 text-[14px]"
        />
      </div>

      {/* 선택 카운터 */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-[12px] font-bold text-gray-500">
          {list.length === 0 && !isLoading ? "결과 없음" : `${list.length}명 표시`}
        </span>
        {selected.size > 0 && (
          <button
            onClick={() => setSelected(new Set())}
            className="text-[11px] font-bold text-gray-400 active:opacity-60 flex items-center gap-1"
          >
            <X className="w-3 h-3" /> 선택 해제 ({selected.size})
          </button>
        )}
      </div>

      {/* 의원 리스트 */}
      <div className="grid grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pb-2 -mx-1 px-1 scrollbar-hide">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-[88px] bg-gray-50 rounded-2xl animate-pulse" />
            ))
          : list.map((m: any) => {
              const id = m.id || m.monaCd;
              const on = selected.has(id);
              return (
                <button
                  key={id}
                  onClick={() => toggle(id)}
                  className={`relative flex items-center gap-2.5 p-2.5 rounded-2xl border transition-all text-left active:scale-[0.98] ${
                    on
                      ? "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200"
                      : "bg-white border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 ring-2 ring-white shadow-sm">
                    <PoliticianPhoto
                      name={m.name}
                      photo={m.photo || m.photoUrl}
                      monaCd={id}
                      context={m.party}
                      avatarClassName="w-full h-full flex items-center justify-center bg-indigo-100 text-indigo-600 font-bold text-sm"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-black text-gray-900 truncate">{m.name}</p>
                    <p className="text-[10px] font-bold text-gray-500 truncate">{m.party || "무소속"}</p>
                    {m.district && (
                      <p className="text-[10px] text-gray-400 truncate mt-0.5">{m.district}</p>
                    )}
                  </div>
                  {on && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center shadow-sm">
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
      </div>

      <FooterActions
        primaryLabel={
          followMutation.isPending
            ? "팔로우 중…"
            : selected.size > 0
            ? `${selected.size}명 팔로우하고 다음`
            : "다음"
        }
        primaryDisabled={followMutation.isPending}
        onPrimary={submit}
        secondaryLabel="나중에"
        onSecondary={onSkip}
      />
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — 안내 (변경 방법 + 인물탭 안내)
// ─────────────────────────────────────────────────────────────────────────────
function TipsStep({ onDone }: { onDone: () => void }) {
  return (
    <motion.section
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.2 }}
      className="max-w-md mx-auto"
    >
      <div className="mb-7">
        <span className="inline-block text-[10px] font-black tracking-wider text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md mb-3">
          STEP 3 / 3
        </span>
        <h1 className="text-[24px] font-black leading-tight text-gray-900">
          시작하기 전에 알아두세요
        </h1>
        <p className="text-[13px] text-gray-500 mt-1.5 leading-relaxed">
          준비 끝났어요. 다음 두 가지만 기억해 주세요.
        </p>
      </div>

      <div className="space-y-3">
        <TipCard
          icon={<UserCheck className="w-5 h-5 text-indigo-500" />}
          title="닉네임은 언제든 바꿀 수 있어요"
          body={
            <>
              <span className="font-bold text-gray-900">마이페이지 → 닉네임 변경</span>
              에서 다시 정할 수 있어요. (7일에 한 번)
            </>
          }
          tone="indigo"
        />
        <TipCard
          icon={<Bell className="w-5 h-5 text-emerald-500" />}
          title="팔로우한 의원 소식은 인물 탭에서"
          body={
            <>
              <span className="font-bold text-gray-900">인물 탭</span>
              에서 팔로우한 의원의 법안·표결·관련 뉴스를
              <span className="font-bold text-gray-900"> 실시간</span>으로 확인할 수 있어요.
            </>
          }
          tone="emerald"
        />
      </div>

      <FooterActions
        primaryLabel="시작하기"
        primaryDisabled={false}
        onPrimary={onDone}
        secondaryLabel={undefined}
        onSecondary={undefined}
      />
    </motion.section>
  );
}

function TipCard({
  icon,
  title,
  body,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
  tone: "indigo" | "emerald";
}) {
  const ring = tone === "indigo" ? "bg-indigo-50" : "bg-emerald-50";
  return (
    <div className="flex items-start gap-3 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
      <div className={`w-10 h-10 rounded-xl ${ring} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[14px] font-black text-gray-900 mb-1">{title}</h3>
        <p className="text-[12.5px] text-gray-500 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 공통 하단 버튼
// ─────────────────────────────────────────────────────────────────────────────
function FooterActions({
  primaryLabel,
  primaryDisabled,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  primaryLabel: string;
  primaryDisabled: boolean;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] bg-gradient-to-t from-white via-white/95 to-transparent">
      <div className="max-w-md mx-auto flex gap-2">
        {secondaryLabel && onSecondary && (
          <Button
            variant="ghost"
            onClick={onSecondary}
            className="h-12 px-5 rounded-2xl text-[14px] font-bold text-gray-500 hover:bg-gray-100"
          >
            {secondaryLabel}
          </Button>
        )}
        <Button
          onClick={onPrimary}
          disabled={primaryDisabled}
          className="flex-1 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-[15px] font-black shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {primaryLabel}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
