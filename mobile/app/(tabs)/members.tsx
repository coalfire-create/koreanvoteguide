import { useState, useMemo, useRef } from "react";
import {
  View, Text, Pressable, TextInput, ActivityIndicator,
  SectionList, Animated,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search, ChevronRight, X } from "lucide-react-native";
import { useAssemblyMembers } from "@/lib/api-data";
import { getPartyColor } from "@/lib/utils";

const PARTY_TABS = [
  { id: "전체",       short: "전체" },
  { id: "더불어민주당", short: "민주" },
  { id: "국민의힘",   short: "국힘" },
  { id: "조국혁신당", short: "조국" },
  { id: "개혁신당",   short: "개혁" },
  { id: "무소속",     short: "무소속" },
];

function partyShort(p: string | null): string {
  if (!p) return "무소속";
  if (p.includes("더불어민주당")) return "민주";
  if (p.includes("국민의힘")) return "국힘";
  if (p.includes("조국혁신당")) return "조국";
  if (p.includes("개혁신당")) return "개혁";
  return "무소속";
}

function scoreGrade(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "A", color: "#059669" };
  if (score >= 60) return { label: "B", color: "#2563EB" };
  if (score >= 40) return { label: "C", color: "#D97706" };
  return { label: "D", color: "#DC2626" };
}

// ─── 의원 행 ──────────────────────────────────────────────────────
function MemberRow({ member }: { member: any }) {
  const color = getPartyColor(member.party);
  const score = member.score?.totalScore ?? 0;
  const grade = scoreGrade(score);

  return (
    <Pressable
      onPress={() => router.push(`/members/${member.id}`)}
      style={({ pressed }) => [{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 11,
        paddingRight: 16,
        paddingLeft: 0,
        backgroundColor: pressed ? "#F2F2F7" : "white",
      }]}
    >
      {/* 당 색상 바 */}
      <View style={{ width: 3, height: 44, borderRadius: 2, backgroundColor: color, marginRight: 13, marginLeft: 16 }} />

      {/* 아바타 */}
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${color}15`, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "900", color }}>{member.name.slice(0, 1)}</Text>
      </View>

      {/* 이름·지역 */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 2 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#111827" }}>{member.name}</Text>
          <View style={{ backgroundColor: `${color}15`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
            <Text style={{ fontSize: 10, fontWeight: "800", color }}>{partyShort(member.party)}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 12, color: "#8E8E93" }} numberOfLines={1}>
          {member.district}{member.committee ? ` · ${member.committee}` : ""}
        </Text>
      </View>

      {/* 점수 */}
      {score > 0 && (
        <View style={{ alignItems: "center", marginRight: 10 }}>
          <Text style={{ fontSize: 18, fontWeight: "900", color: grade.color }}>{grade.label}</Text>
          <Text style={{ fontSize: 9, color: "#8E8E93", fontWeight: "600" }}>{score}점</Text>
        </View>
      )}

      <ChevronRight color="#C7C7CC" size={15} strokeWidth={2} />
    </Pressable>
  );
}

// ─── 섹션 헤더 ────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <View style={{ backgroundColor: "#F2F2F7", paddingHorizontal: 16, paddingVertical: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: "700", color: "#6B6B6B" }}>{title}</Text>
    </View>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────
export default function MembersScreen() {
  const insets = useSafeAreaInsets();
  const { members, isLoading } = useAssemblyMembers();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedParty, setSelectedParty] = useState("전체");
  const searchRef = useRef<TextInput>(null);

  const filtered = useMemo(() => {
    return members.filter((m: any) => {
      const matchSearch = !searchQuery || m.name.includes(searchQuery) || (m.district ?? "").includes(searchQuery);
      const matchParty = selectedParty === "전체" || (m.party ?? "").includes(selectedParty);
      return matchSearch && matchParty;
    });
  }, [members, searchQuery, selectedParty]);

  // 초성 섹션으로 그룹핑
  const sections = useMemo(() => {
    if (searchQuery) return [{ title: `검색 결과 ${filtered.length}명`, data: filtered }];
    const map = new Map<string, any[]>();
    for (const m of filtered) {
      const first = m.name[0];
      if (!map.has(first)) map.set(first, []);
      map.get(first)!.push(m);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b, "ko"))
      .map(([k, data]) => ({ title: k, data }));
  }, [filtered, searchQuery]);

  return (
    <View style={{ flex: 1, backgroundColor: "#F2F2F7" }}>

      {/* ─── 헤더 ─── */}
      <View style={{ backgroundColor: "#F2F2F7", paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12 }}>
          <Text style={{ fontSize: 34, fontWeight: "900", color: "#111827", letterSpacing: -0.5 }}>국회의원</Text>
          <Text style={{ fontSize: 14, color: "#8E8E93", fontWeight: "600", paddingBottom: 4 }}>{filtered.length}명</Text>
        </View>

        {/* 검색창 */}
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "rgba(118,118,128,0.12)", borderRadius: 12, paddingHorizontal: 10, height: 38, marginBottom: 12 }}>
          <Search color="#8E8E93" size={15} strokeWidth={2.5} />
          <TextInput
            ref={searchRef}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="이름 또는 지역으로 검색"
            placeholderTextColor="#8E8E93"
            style={{ flex: 1, marginLeft: 6, fontSize: 15, color: "#111827" }}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "#8E8E93", alignItems: "center", justifyContent: "center" }}>
                <X color="white" size={11} strokeWidth={3} />
              </View>
            </Pressable>
          )}
        </View>

        {/* 당 필터 */}
        <View style={{ flexDirection: "row", gap: 7 }}>
          {PARTY_TABS.map((p) => {
            const active = selectedParty === p.id;
            const color = active ? "#6D28D9" : "#8E8E93";
            return (
              <Pressable
                key={p.id}
                onPress={() => setSelectedParty(p.id)}
                style={({ pressed }) => [{
                  paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100,
                  backgroundColor: active ? "#6D28D9" : "rgba(118,118,128,0.12)",
                  opacity: pressed ? 0.75 : 1,
                }]}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "white" : "#3C3C43" }}>{p.short}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#6D28D9" />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item: any) => item.id}
          renderItem={({ item, index, section }) => (
            <>
              <MemberRow member={item} />
              {index < section.data.length - 1 && (
                <View style={{ height: 0.5, backgroundColor: "#E5E5EA", marginLeft: 75 }} />
              )}
            </>
          )}
          renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}
          renderSectionFooter={() => <View style={{ height: 8 }} />}
          stickySectionHeadersEnabled
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}
