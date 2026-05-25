import { useState, useMemo, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Dimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import {
  Search, TrendingUp, Clock, Newspaper,
  ChevronRight, Flame, FileText, ArrowUpRight,
} from "lucide-react-native";
import { useHotBills, useAssemblyBills } from "@/lib/api-data";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = SCREEN_W * 0.72;

const STATUS_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  "통과": { bg: "#ECFDF5", text: "#059669", dot: "#10B981" },
  "계류": { bg: "#EFF6FF", text: "#3B82F6", dot: "#60A5FA" },
  "폐기": { bg: "#FEF2F2", text: "#DC2626", dot: "#F87171" },
};

const SECTION_COLORS = [
  "#4c1d95", "#1e3a8a", "#064e3b", "#78350f", "#831843",
  "#1e3a5f", "#3b0764", "#0c4a6e",
];

function useNewsQuery() {
  return useQuery<any[]>({
    queryKey: ["/api/news"],
    queryFn: () => fetch("/api/news").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });
}

// ─── 인기 법안 가로 카드 ───────────────────────────────────────────
function HotBillCard({ bill, index }: { bill: any; index: number }) {
  const bg = SECTION_COLORS[index % SECTION_COLORS.length];
  const statusColor = STATUS_COLOR[bill.status] ?? { bg: "#F9FAFB", text: "#6B7280", dot: "#9CA3AF" };
  return (
    <TouchableOpacity
      onPress={() => router.push(`/bills/${bill.id}`)}
      activeOpacity={0.88}
      style={{
        width: CARD_W,
        marginRight: 12,
        borderRadius: 22,
        overflow: "hidden",
        backgroundColor: bg,
      }}
    >
      {/* gradient-like top */}
      <View style={{ padding: 18, paddingBottom: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 }}>
            <Flame color="#fde047" size={11} strokeWidth={2.5} />
            <Text style={{ fontSize: 11, fontWeight: "800", color: "white" }}>#{index + 1} 인기</Text>
          </View>
          <View style={{ backgroundColor: statusColor.bg, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 100 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: statusColor.text }}>{bill.status}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 15, fontWeight: "900", color: "white", lineHeight: 22, marginBottom: 8 }} numberOfLines={3}>
          {bill.name}
        </Text>
        {bill.summary ? (
          <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 18 }} numberOfLines={2}>
            {bill.summary}
          </Text>
        ) : null}
      </View>
      {/* footer */}
      <View style={{ backgroundColor: "rgba(0,0,0,0.2)", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 }}>
        <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: "600" }}>
          {bill.proposer ?? ""}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
            {bill.proposedDate?.slice(0, 10) ?? ""}
          </Text>
          <ArrowUpRight color="rgba(255,255,255,0.5)" size={12} strokeWidth={2} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── 뉴스 카드 ────────────────────────────────────────────────────
const NEWS_ACCENTS = ["#4c1d95", "#1e3a8a", "#064e3b", "#78350f"];

function NewsCard({ item, index }: { item: any; index: number }) {
  const accent = NEWS_ACCENTS[index % NEWS_ACCENTS.length];
  const dateStr = item.publishedAt
    ? new Date(item.publishedAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })
    : "";
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={{ backgroundColor: "white", borderRadius: 18, marginBottom: 10, overflow: "hidden", borderWidth: 1, borderColor: "#f0f0f5" }}
    >
      <View style={{ height: 4, backgroundColor: accent }} />
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <View style={{ backgroundColor: `${accent}18`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 }}>
            <Text style={{ fontSize: 10, fontWeight: "800", color: accent }}>{item.source ?? "뉴스"}</Text>
          </View>
          <Text style={{ fontSize: 11, color: "#9CA3AF" }}>{dateStr}</Text>
        </View>
        <Text style={{ fontSize: 14, fontWeight: "800", color: "#111827", lineHeight: 20, marginBottom: 6 }} numberOfLines={2}>
          {item.title}
        </Text>
        {item.summary ? (
          <Text style={{ fontSize: 12, color: "#6B7280", lineHeight: 18 }} numberOfLines={2}>
            {item.summary}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── 최신 법안 행 ─────────────────────────────────────────────────
function LatestBillRow({ bill, index }: { bill: any; index: number }) {
  const statusColor = STATUS_COLOR[bill.status] ?? { bg: "#F9FAFB", text: "#6B7280", dot: "#9CA3AF" };
  return (
    <TouchableOpacity
      onPress={() => router.push(`/bills/${bill.id}`)}
      activeOpacity={0.85}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#f5f5f7" }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 12, fontWeight: "900", color: "#6B7280" }}>{index + 1}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: "#111827", lineHeight: 18, marginBottom: 3 }} numberOfLines={2}>
          {bill.name}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: statusColor.dot }} />
          <Text style={{ fontSize: 11, color: statusColor.text, fontWeight: "700" }}>{bill.status}</Text>
          <Text style={{ fontSize: 11, color: "#9CA3AF" }}>· {bill.proposer?.slice(0, 8) ?? ""}</Text>
        </View>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Text style={{ fontSize: 10, color: "#9CA3AF" }}>{bill.proposedDate?.slice(0, 10) ?? ""}</Text>
        <ChevronRight color="#D1D5DB" size={14} strokeWidth={2} />
      </View>
    </TouchableOpacity>
  );
}

// ─── 섹션 헤더 ────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, color, count }: { icon: any; title: string; color: string; count?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 14 }}>
      <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: `${color}18`, alignItems: "center", justifyContent: "center" }}>
        <Icon color={color} size={15} strokeWidth={2.5} />
      </View>
      <Text style={{ fontSize: 16, fontWeight: "900", color: "#111827" }}>{title}</Text>
      {count != null && (
        <View style={{ backgroundColor: `${color}18`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color }}>{count}</Text>
        </View>
      )}
    </View>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────
export default function BillsScreen() {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"home" | "search">("home");

  const { bills: hotBills, isLoading: hotLoading } = useHotBills();
  const { bills: allBills, isLoading: billsLoading } = useAssemblyBills();
  const { data: newsRaw, isLoading: newsLoading } = useNewsQuery();

  // 최신순 법안
  const latestBills = useMemo(() => {
    return [...allBills]
      .sort((a, b) => (b.proposedDate ?? "").localeCompare(a.proposedDate ?? ""))
      .slice(0, 15);
  }, [allBills]);

  // 법안 관련 뉴스 — 키워드 매칭 우선, 부족하면 최신 뉴스로 채움
  const billNews = useMemo(() => {
    const all = Array.isArray(newsRaw) ? newsRaw : [];
    const keywords = ["법안", "법률", "입법", "국회", "의결", "가결", "폐기", "계류"];
    const matched = all.filter((n: any) =>
      keywords.some((kw) => (n.title ?? "").includes(kw) || (n.summary ?? "").includes(kw))
    );
    if (matched.length >= 3) return matched.slice(0, 10);
    const matchedTitles = new Set(matched.map((n: any) => n.title));
    const fallback = all
      .filter((n: any) => !matchedTitles.has(n.title))
      .slice(0, 3 - matched.length);
    return [...matched, ...fallback];
  }, [newsRaw]);

  // 검색 탭
  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    return allBills.filter((b: any) =>
      b.name.includes(searchQuery) || (b.proposer ?? "").includes(searchQuery)
    );
  }, [allBills, searchQuery]);

  const isLoading = hotLoading || billsLoading;

  return (
    <View style={{ flex: 1, backgroundColor: "#FAFAFA" }}>
      {/* ─── Header ─── */}
      <View style={{
        paddingTop: insets.top + 12,
        paddingHorizontal: 20,
        paddingBottom: 12,
        backgroundColor: "white",
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f5",
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <Text style={{ fontSize: 22, fontWeight: "900", color: "#111827" }}>법안</Text>
          <TouchableOpacity
            onPress={() => setActiveTab(activeTab === "search" ? "home" : "search")}
            style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: activeTab === "search" ? "#4c1d95" : "#F3F4F6", alignItems: "center", justifyContent: "center" }}
          >
            <Search color={activeTab === "search" ? "white" : "#374151"} size={16} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {activeTab === "search" && (
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 14, paddingHorizontal: 12, height: 44 }}>
            <Search color="#9CA3AF" size={15} strokeWidth={2} />
            <TextInput
              autoFocus
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="법안명·제안자 검색"
              placeholderTextColor="#9CA3AF"
              style={{ flex: 1, marginLeft: 8, fontSize: 14, color: "#111827" }}
            />
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#4c1d95" />
        </View>
      ) : activeTab === "search" ? (
        /* ─── 검색 결과 ─── */
        <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
          {searchQuery.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <Search color="#D1D5DB" size={40} strokeWidth={1.5} />
              <Text style={{ fontSize: 14, color: "#9CA3AF", marginTop: 12 }}>법안명이나 제안자를 검색하세요</Text>
            </View>
          ) : searchResults.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <Text style={{ fontSize: 14, color: "#9CA3AF" }}>검색 결과가 없습니다</Text>
            </View>
          ) : (
            searchResults.map((bill: any, i: number) => (
              <LatestBillRow key={bill.id} bill={bill} index={i} />
            ))
          )}
        </ScrollView>
      ) : (
        /* ─── 홈 피드 ─── */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

          {/* 🔥 인기 법안 */}
          <View style={{ paddingTop: 22, paddingHorizontal: 20, marginBottom: 8 }}>
            <SectionHeader icon={Flame} title="인기 법안" color="#DC2626" count={hotBills.length} />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4 }}
            decelerationRate="fast"
            snapToInterval={CARD_W + 12}
          >
            {hotBills.length > 0
              ? hotBills.map((bill: any, i: number) => <HotBillCard key={bill.id} bill={bill} index={i} />)
              : [0, 1, 2].map((i) => (
                  <View key={i} style={{ width: CARD_W, height: 160, marginRight: 12, borderRadius: 22, backgroundColor: "#E5E7EB" }} />
                ))}
          </ScrollView>

          {/* 📰 법안 뉴스 */}
          <View style={{ paddingHorizontal: 20, marginTop: 28, marginBottom: 8 }}>
            <SectionHeader icon={Newspaper} title="법안 뉴스" color="#2563EB" count={billNews.length} />
          </View>
          <View style={{ paddingHorizontal: 20 }}>
            {newsLoading ? (
              <ActivityIndicator color="#2563EB" style={{ marginVertical: 20 }} />
            ) : billNews.length === 0 ? (
              <View style={{ backgroundColor: "white", borderRadius: 18, padding: 24, alignItems: "center", borderWidth: 1, borderColor: "#f0f0f5" }}>
                <Newspaper color="#D1D5DB" size={28} strokeWidth={1.5} />
                <Text style={{ fontSize: 13, color: "#9CA3AF", marginTop: 8 }}>법안 관련 뉴스를 불러오는 중...</Text>
              </View>
            ) : (
              billNews.map((item: any, i: number) => <NewsCard key={i} item={item} index={i} />)
            )}
          </View>

          {/* 🆕 최신 법안 */}
          <View style={{ paddingHorizontal: 20, marginTop: 28, marginBottom: 4 }}>
            <SectionHeader icon={Clock} title="최신 법안" color="#059669" count={latestBills.length} />
          </View>
          <View style={{ backgroundColor: "white", marginHorizontal: 20, borderRadius: 20, paddingHorizontal: 16, borderWidth: 1, borderColor: "#f0f0f5" }}>
            {latestBills.map((bill: any, i: number) => (
              <LatestBillRow key={bill.id} bill={bill} index={i} />
            ))}
            <TouchableOpacity
              onPress={() => setActiveTab("search")}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14 }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#6B7280" }}>전체 법안 검색하기</Text>
              <ChevronRight color="#9CA3AF" size={14} strokeWidth={2} />
            </TouchableOpacity>
          </View>

        </ScrollView>
      )}
    </View>
  );
}
