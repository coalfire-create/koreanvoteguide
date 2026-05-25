import { useState } from "react";
import {
  View, Text, Pressable, FlatList,
  ActivityIndicator, Linking, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, ChevronDown, ChevronUp, Layers, AlignJustify } from "lucide-react-native";

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  sourceCode: string;
}

interface NewsGroup {
  headline: string;
  articles: NewsItem[];
}

interface NewsResponse {
  items: NewsItem[];
  sources: string[];
  grouped?: NewsGroup[];
}

const SOURCE_COLOR: Record<string, string> = {
  yna: "#DC2626", kbs: "#2563EB", mbc: "#7C3AED", sbs: "#DB2777",
  jtbc: "#EA580C", ytn: "#0284C7", hani: "#047857", khan: "#0F766E",
  chosun: "#475569", joongang: "#D97706", donga: "#4338CA", news1: "#E11D48",
};

function formatTime(d: string): string {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "방금";
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function SourceChip({ sourceCode, source }: { sourceCode: string; source: string }) {
  const color = SOURCE_COLOR[sourceCode] ?? "#6B7280";
  return (
    <View style={{ backgroundColor: `${color}15`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 }}>
      <Text style={{ fontSize: 11, fontWeight: "800", color }}>{source}</Text>
    </View>
  );
}

// ─── 그룹 카드 ────────────────────────────────────────────────────
function GroupCard({ group, isFirst, isLast }: { group: NewsGroup; isFirst: boolean; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const first = group.articles[0];
  const extras = group.articles.slice(1);
  const accentColor = SOURCE_COLOR[first?.sourceCode] ?? "#6B7280";

  return (
    <View>
      {/* 메인 기사 */}
      <Pressable
        onPress={() => first?.link && Linking.openURL(first.link)}
        style={({ pressed }) => [{
          backgroundColor: pressed ? "#F2F2F7" : "white",
          paddingHorizontal: 16,
          paddingVertical: 14,
        }]}
      >
        {/* 상단 좌측 바 */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ width: 3, borderRadius: 2, backgroundColor: accentColor, alignSelf: "stretch" }} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <SourceChip sourceCode={first?.sourceCode} source={first?.source} />
              <Text style={{ fontSize: 11, color: "#8E8E93" }}>{formatTime(first?.pubDate)}</Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: "800", color: "#111827", lineHeight: 23, marginBottom: 8 }}>
              {group.headline || first?.title}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <ExternalLink color="#8E8E93" size={12} strokeWidth={2} />
              <Text style={{ fontSize: 12, color: "#8E8E93" }}>기사 보기</Text>
            </View>
          </View>
        </View>
      </Pressable>

      {/* 관련 기사 토글 */}
      {extras.length > 0 && (
        <>
          <Pressable
            onPress={() => setExpanded((e) => !e)}
            style={({ pressed }) => [{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 16,
              paddingVertical: 10,
              backgroundColor: pressed ? "#F2F2F7" : "#FAFAFA",
              borderTopWidth: 0.5,
              borderTopColor: "#E5E5EA",
            }]}
          >
            {expanded
              ? <ChevronUp color={accentColor} size={13} strokeWidth={2.5} />
              : <ChevronDown color={accentColor} size={13} strokeWidth={2.5} />}
            <Text style={{ fontSize: 13, fontWeight: "700", color: accentColor }}>
              관련 기사 {extras.length}개
            </Text>
          </Pressable>

          {expanded && extras.map((a, i) => (
            <Pressable
              key={i}
              onPress={() => Linking.openURL(a.link)}
              style={({ pressed }) => [{
                paddingHorizontal: 16, paddingVertical: 12,
                backgroundColor: pressed ? "#F2F2F7" : "#FAFAFA",
                borderTopWidth: 0.5, borderTopColor: "#E5E5EA",
                flexDirection: "row", gap: 10, alignItems: "flex-start",
              }]}
            >
              <View style={{ width: 2.5, height: "100%", backgroundColor: `${SOURCE_COLOR[a.sourceCode] ?? "#ccc"}60`, borderRadius: 2, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: "#374151", lineHeight: 20, marginBottom: 6 }} numberOfLines={2}>{a.title}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <SourceChip sourceCode={a.sourceCode} source={a.source} />
                  <Text style={{ fontSize: 11, color: "#8E8E93" }}>{formatTime(a.pubDate)}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </>
      )}

      {!isLast && <View style={{ height: 8, backgroundColor: "#F2F2F7" }} />}
    </View>
  );
}

// ─── 단순 뉴스 행 ─────────────────────────────────────────────────
function NewsRow({ item, isLast }: { item: NewsItem; isLast: boolean }) {
  const color = SOURCE_COLOR[item.sourceCode] ?? "#6B7280";
  return (
    <Pressable
      onPress={() => Linking.openURL(item.link)}
      style={({ pressed }) => [{
        flexDirection: "row",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 13,
        backgroundColor: pressed ? "#F2F2F7" : "white",
        borderBottomWidth: isLast ? 0 : 0.5,
        borderBottomColor: "#E5E5EA",
      }]}
    >
      <View style={{ width: 3, borderRadius: 2, backgroundColor: color, alignSelf: "stretch" }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: "#111827", lineHeight: 21, marginBottom: 7 }} numberOfLines={3}>
          {item.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <SourceChip sourceCode={item.sourceCode} source={item.source} />
          <Text style={{ fontSize: 11, color: "#8E8E93" }}>{formatTime(item.pubDate)}</Text>
        </View>
      </View>
      <ExternalLink color="#C7C7CC" size={14} strokeWidth={2} style={{ marginTop: 2 }} />
    </Pressable>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────
export default function NewsScreen() {
  const insets = useSafeAreaInsets();
  const [viewMode, setViewMode] = useState<"grouped" | "list">("grouped");

  const { data, isLoading, refetch } = useQuery<NewsResponse>({
    queryKey: ["/api/news"],
    staleTime: 15 * 60 * 1000,
  });

  const grouped = data?.grouped ?? [];
  const items = data?.items ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: "#F2F2F7" }}>

      {/* ─── 헤더 ─── */}
      <View style={{ backgroundColor: "#F2F2F7", paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 34, fontWeight: "900", color: "#111827", letterSpacing: -0.5 }}>정치 뉴스</Text>

          {/* 뷰 모드 토글 */}
          <View style={{ flexDirection: "row", backgroundColor: "rgba(118,118,128,0.12)", borderRadius: 10, padding: 3, marginBottom: 4, gap: 2 }}>
            {(["grouped", "list"] as const).map((mode) => {
              const active = viewMode === mode;
              const Icon = mode === "grouped" ? Layers : AlignJustify;
              return (
                <Pressable
                  key={mode}
                  onPress={() => setViewMode(mode)}
                  style={{ width: 34, height: 30, borderRadius: 8, backgroundColor: active ? "white" : "transparent", alignItems: "center", justifyContent: "center",
                    shadowColor: active ? "#000" : "transparent", shadowOpacity: active ? 0.1 : 0, shadowRadius: 4,
                  }}
                >
                  <Icon color={active ? "#111827" : "#8E8E93"} size={15} strokeWidth={2} />
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#6D28D9" />
        </View>
      ) : viewMode === "grouped" ? (
        <FlatList
          data={grouped}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item, index }) => (
            <GroupCard group={item} isFirst={index === 0} isLast={index === grouped.length - 1} />
          )}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#6D28D9" />}
          contentContainerStyle={{ paddingBottom: 40 }}
          style={{ backgroundColor: "white" }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <Text style={{ fontSize: 15, color: "#8E8E93", fontWeight: "500" }}>뉴스를 불러오는 중...</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item, index }) => <NewsRow item={item} isLast={index === items.length - 1} />}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#6D28D9" />}
          contentContainerStyle={{ paddingBottom: 40 }}
          style={{ backgroundColor: "white" }}
        />
      )}
    </View>
  );
}
