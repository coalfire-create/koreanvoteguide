import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  RefreshControl, ActivityIndicator, Pressable, Dimensions,
} from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedScrollHandler,
  interpolate, Extrapolation, withSpring,
} from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  MapPin, Users, FileText, Newspaper,
  MessageSquare, ChevronRight, Bell, Settings,
} from "lucide-react-native";
import { MAYOR_RACES } from "@/lib/mayor-candidates";
import { getDaysUntilElection } from "@/lib/election-config";
import { getPartyColor } from "@/lib/utils";

const { width: SCREEN_W } = Dimensions.get("window");
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

interface FeedItem {
  type: "bill" | "vote";
  id: string;
  politicianId: string;
  politicianName: string;
  party: string | null;
  photo: string | null;
  title: string;
  subtitle: string;
  occurredAt: string;
  voteResult?: string;
}

function partyBg(party: string | null | undefined) {
  const p = party ?? "";
  if (p.includes("더불어민주당")) return { bg: "#2563EB", text: "민주" };
  if (p.includes("국민의힘")) return { bg: "#DC2626", text: "국힘" };
  if (p.includes("조국혁신당")) return { bg: "#4338CA", text: "조국" };
  if (p.includes("개혁신당")) return { bg: "#EA580C", text: "개혁" };
  return { bg: "#6B7280", text: "무소" };
}

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "방금 전";
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

// ─── 지역 스토리 원형 ──────────────────────────────────────────────
function RegionStory({ regionCode, onPress }: { regionCode: string; onPress: () => void }) {
  const race = MAYOR_RACES.find((r) => r.regionCode === regionCode);
  if (!race) return null;
  const top = race.candidates[0];
  const color = top ? getPartyColor(top.party) : "#6D28D9";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ alignItems: "center", marginRight: 18, opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={{
        width: 64, height: 64, borderRadius: 32,
        borderWidth: 2.5, borderColor: color,
        alignItems: "center", justifyContent: "center",
        backgroundColor: `${color}18`,
        marginBottom: 6,
      }}>
        <Text style={{ fontSize: 22, fontWeight: "900", color }}>{race.regionShort.slice(0, 1)}</Text>
      </View>
      <Text style={{ fontSize: 11, fontWeight: "600", color: "#111827" }}>{race.regionShort}</Text>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginTop: 3 }} />
    </Pressable>
  );
}

// ─── 후보 VS 카드 ─────────────────────────────────────────────────
function CandidateVsCard({ regionCode }: { regionCode: string }) {
  const race = MAYOR_RACES.find((r) => r.regionCode === regionCode);
  if (!race) return null;
  const [c1, c2] = race.candidates;
  if (!c1 || !c2) return null;
  const col1 = getPartyColor(c1.party);
  const col2 = getPartyColor(c2.party);

  return (
    <Pressable
      onPress={() => router.push("/city-select")}
      style={({ pressed }) => [{
        backgroundColor: "white",
        borderRadius: 20,
        marginBottom: 12,
        overflow: "hidden",
        opacity: pressed ? 0.95 : 1,
      }]}
    >
      {/* 지역 헤더 */}
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <MapPin color="#6D28D9" size={12} strokeWidth={2.5} />
          <Text style={{ fontSize: 13, fontWeight: "800", color: "#6D28D9" }}>{race.regionShort}</Text>
          <Text style={{ fontSize: 11, color: "#9CA3AF" }}>{race.positionLabel}</Text>
        </View>
        <ChevronRight color="#D1D5DB" size={14} strokeWidth={2} />
      </View>

      {/* VS */}
      <View style={{ flexDirection: "row" }}>
        {/* 후보 1 */}
        <View style={{ flex: 1, backgroundColor: `${col1}10`, padding: 16, alignItems: "center" }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: col1, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: "900", color: "white" }}>{c1.name.slice(0, 1)}</Text>
          </View>
          <Text style={{ fontSize: 15, fontWeight: "900", color: "#111827" }}>{c1.name}</Text>
          <View style={{ backgroundColor: col1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, marginTop: 5 }}>
            <Text style={{ fontSize: 10, fontWeight: "800", color: "white" }}>{c1.party.slice(0, 4)}</Text>
          </View>
          {c1.isIncumbent && (
            <Text style={{ fontSize: 10, color: "#9CA3AF", marginTop: 4 }}>현직</Text>
          )}
        </View>

        {/* VS 구분 */}
        <View style={{ width: 1, backgroundColor: "#F3F4F6" }} />
        <View style={{ position: "absolute", left: "50%", top: "50%", transform: [{ translateX: -14 }, { translateY: -12 }], width: 28, height: 24, backgroundColor: "white", borderRadius: 8, alignItems: "center", justifyContent: "center", zIndex: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: "900", color: "#9CA3AF" }}>VS</Text>
        </View>

        {/* 후보 2 */}
        <View style={{ flex: 1, backgroundColor: `${col2}10`, padding: 16, alignItems: "center" }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: col2, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: "900", color: "white" }}>{c2.name.slice(0, 1)}</Text>
          </View>
          <Text style={{ fontSize: 15, fontWeight: "900", color: "#111827" }}>{c2.name}</Text>
          <View style={{ backgroundColor: col2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, marginTop: 5 }}>
            <Text style={{ fontSize: 10, fontWeight: "800", color: "white" }}>{c2.party.slice(0, 4)}</Text>
          </View>
          {c2.isIncumbent && (
            <Text style={{ fontSize: 10, color: "#9CA3AF", marginTop: 4 }}>현직</Text>
          )}
        </View>
      </View>

      {/* 공약 비교 CTA */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderTopWidth: 1, borderTopColor: "#F3F4F6" }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: "#6D28D9" }}>공약 비교 보기</Text>
        <ChevronRight color="#6D28D9" size={13} strokeWidth={2.5} />
      </View>
    </Pressable>
  );
}

// ─── 빠른 메뉴 그리드 ─────────────────────────────────────────────
const QUICK_MENU = [
  { icon: Users,        label: "국회의원",  sub: "표결·활동 추적", path: "/(tabs)/members",    bg: "#1e3a8a", accent: "#60A5FA" },
  { icon: FileText,     label: "법안",      sub: "인기·최신 법안", path: "/(tabs)/bills",      bg: "#064e3b", accent: "#34D399" },
  { icon: Newspaper,    label: "뉴스",      sub: "AI 분석 뉴스",   path: "/news" as any,       bg: "#78350f", accent: "#FCD34D" },
  { icon: MessageSquare,label: "커뮤니티",  sub: "지역 이야기",    path: "/(tabs)/community",  bg: "#831843", accent: "#F9A8D4" },
];

function QuickMenuGrid() {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {QUICK_MENU.map((item) => {
        const Icon = item.icon;
        return (
          <Pressable
            key={item.label}
            onPress={() => router.push(item.path as any)}
            style={({ pressed }) => [{
              width: (SCREEN_W - 40 - 10) / 2,
              backgroundColor: item.bg,
              borderRadius: 20,
              padding: 18,
              opacity: pressed ? 0.85 : 1,
            }]}
          >
            <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <Icon color={item.accent} size={20} strokeWidth={2} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: "900", color: "white", marginBottom: 3 }}>{item.label}</Text>
            <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: "500" }}>{item.sub}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── 피드 아이템 (트위터 스타일) ──────────────────────────────────
function FeedRow({ item }: { item: FeedItem }) {
  const party = partyBg(item.party);
  const isVote = item.type === "vote";
  const voteColor = item.voteResult?.includes("찬성") ? "#059669"
    : item.voteResult?.includes("반대") ? "#DC2626" : "#6B7280";

  return (
    <Pressable
      onPress={() => router.push(`/members/${item.politicianId}`)}
      style={({ pressed }) => [{
        flexDirection: "row",
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: pressed ? "#F9FAFB" : "white",
        borderBottomWidth: 1,
        borderBottomColor: "#F3F4F6",
      }]}
    >
      {/* 아바타 */}
      <View style={{ alignItems: "center", gap: 4 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: party.bg, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "white", fontWeight: "900", fontSize: 15 }}>{item.politicianName.slice(0, 1)}</Text>
        </View>
        <View style={{ width: 2, flex: 1, backgroundColor: "#F3F4F6", minHeight: 8 }} />
      </View>

      {/* 내용 */}
      <View style={{ flex: 1, paddingBottom: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <Text style={{ fontSize: 14, fontWeight: "800", color: "#111827" }}>{item.politicianName}</Text>
          <View style={{ backgroundColor: `${party.bg}20`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: party.bg }}>{party.text}</Text>
          </View>
          <Text style={{ fontSize: 11, color: "#9CA3AF", marginLeft: "auto" }}>{timeAgo(item.occurredAt)}</Text>
        </View>

        <Text style={{ fontSize: 13, color: "#374151", lineHeight: 19, marginBottom: isVote ? 6 : 0 }} numberOfLines={2}>
          {item.title}
        </Text>

        {isVote && item.voteResult && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
            <View style={{ backgroundColor: `${voteColor}15`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: voteColor }}>{item.voteResult}</Text>
            </View>
            <Text style={{ fontSize: 11, color: "#9CA3AF" }}>표결 결과</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const daysLeft = getDaysUntilElection();
  const [regions, setRegions] = useState<{ code: string; name: string }[]>([]);
  const scrollY = useSharedValue(0);

  useEffect(() => {
    AsyncStorage.getItem("userRegions").then((val) => {
      if (!val) return;
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) setRegions(parsed);
      } catch {}
    });
  }, []);

  const feedQuery = useQuery<{ items: FeedItem[] }>({
    queryKey: ["/api/members/timeline"],
    staleTime: 5 * 60 * 1000,
  });

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  // 상단 헤더 축소 애니메이션
  const heroStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 100], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 100], [0, -20], Extrapolation.CLAMP) }],
  }));

  const headerBgStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(76,29,149,${interpolate(scrollY.value, [80, 120], [0, 1], Extrapolation.CLAMP)})`,
  }));

  const feedItems = feedQuery.data?.items ?? [];
  const isLoading = feedQuery.isLoading;

  return (
    <View style={{ flex: 1, backgroundColor: "#F2F2F7" }}>

      {/* ─── 고정 상단 바 ─── */}
      <Animated.View style={[{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
        paddingTop: insets.top,
      }, headerBgStyle]}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Image source={require("../../assets/icon.png")} style={{ width: 28, height: 28, borderRadius: 8 }} />
            <Text style={{ fontSize: 17, fontWeight: "900", color: "white" }}>이유</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Pressable style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}>
              <Bell color="white" size={17} strokeWidth={2} />
            </Pressable>
            <Pressable
              onPress={() => router.push("/city-select")}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}
            >
              <Settings color="white" size={17} strokeWidth={2} />
            </Pressable>
          </View>
        </View>
      </Animated.View>

      <AnimatedScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => feedQuery.refetch()}
            tintColor="#6D28D9"
          />
        }
        showsVerticalScrollIndicator={false}
      >

        {/* ─── 히어로 헤더 ─── */}
        <View style={{ backgroundColor: "#4c1d95", paddingTop: insets.top + 56, paddingBottom: 28, paddingHorizontal: 20 }}>
          <Animated.View style={heroStyle}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
              <View>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.55)", letterSpacing: 0.5, marginBottom: 6 }}>2026 지방선거</Text>
                <Text style={{ fontSize: 44, fontWeight: "900", color: "white", lineHeight: 48 }}>D-{daysLeft}</Text>
                <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>6월 3일 투표일</Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 10, paddingTop: 4 }}>
                <View style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center" }}>
                  <Text style={{ fontSize: 22, fontWeight: "900", color: "white" }}>{daysLeft}</Text>
                  <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: "600", marginTop: 1 }}>일 남음</Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* 지역 스토리 */}
          {regions.length > 0 && (
            <View style={{ marginTop: 24 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.5)", letterSpacing: 0.5, marginBottom: 14 }}>내 관심 지역</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingLeft: 20 }}>
                {regions.map((r) => (
                  <RegionStory key={r.code} regionCode={r.code} onPress={() => router.push("/city-select")} />
                ))}
                <Pressable
                  onPress={() => router.push("/city-select")}
                  style={{ alignItems: "center", marginRight: 8 }}
                >
                  <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: "rgba(255,255,255,0.2)", borderStyle: "dashed", alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
                    <Text style={{ fontSize: 22, color: "rgba(255,255,255,0.4)" }}>+</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>추가</Text>
                </Pressable>
              </ScrollView>
            </View>
          )}

          {regions.length === 0 && (
            <Pressable
              onPress={() => router.push("/city-select")}
              style={({ pressed }) => [{
                marginTop: 20, backgroundColor: "rgba(255,255,255,0.12)",
                borderRadius: 16, padding: 14,
                flexDirection: "row", alignItems: "center", gap: 12,
                opacity: pressed ? 0.8 : 1,
              }]}
            >
              <MapPin color="rgba(255,255,255,0.6)" size={18} strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "white" }}>지역을 선택해 주세요</Text>
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>내 지역 후보 정보를 바로 볼 수 있어요</Text>
              </View>
              <ChevronRight color="rgba(255,255,255,0.4)" size={16} strokeWidth={2} />
            </Pressable>
          )}
        </View>

        {/* ─── 빠른 메뉴 ─── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 }}>
          <QuickMenuGrid />
        </View>

        {/* ─── 후보 VS 카드 ─── */}
        {regions.length > 0 && (
          <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <Text style={{ fontSize: 17, fontWeight: "900", color: "#111827" }}>지역 후보 비교</Text>
              <Pressable onPress={() => router.push("/city-select")} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                <Text style={{ fontSize: 13, color: "#6D28D9", fontWeight: "600" }}>전체보기</Text>
                <ChevronRight color="#6D28D9" size={13} strokeWidth={2.5} />
              </Pressable>
            </View>
            {regions.map((r) => (
              <CandidateVsCard key={r.code} regionCode={r.code} />
            ))}
          </View>
        )}

        {/* ─── 의원 활동 피드 ─── */}
        <View style={{ marginTop: 24 }}>
          <View style={{ paddingHorizontal: 16, marginBottom: 2, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 17, fontWeight: "900", color: "#111827" }}>의원 활동</Text>
            <Pressable onPress={() => router.push("/(tabs)/members")} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Text style={{ fontSize: 13, color: "#6D28D9", fontWeight: "600" }}>더보기</Text>
              <ChevronRight color="#6D28D9" size={13} strokeWidth={2.5} />
            </Pressable>
          </View>

          <View style={{ backgroundColor: "white", borderRadius: 20, marginHorizontal: 16, overflow: "hidden" }}>
            {isLoading ? (
              <ActivityIndicator color="#6D28D9" style={{ paddingVertical: 32 }} />
            ) : feedItems.length > 0 ? (
              feedItems.slice(0, 10).map((item) => <FeedRow key={item.id} item={item} />)
            ) : (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Users color="#E5E7EB" size={36} strokeWidth={1.5} />
                <Text style={{ fontSize: 14, color: "#9CA3AF", marginTop: 10 }}>최근 활동이 없습니다</Text>
              </View>
            )}
          </View>
        </View>

      </AnimatedScrollView>
    </View>
  );
}
