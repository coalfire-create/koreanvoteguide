import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Animated, Platform, Alert, Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronRight, MapPin, Search, BarChart2, Newspaper, MessageCircle, X, Map, Share2 } from "lucide-react-native";
import { shareCandidate } from "@/lib/useShare";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MAYOR_RACES } from "@/lib/mayor-candidates";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

const PARTY_COLOR: Record<string, string> = {
  "더불어민주당": "#3A6BFF",
  "국민의힘": "#FF3B3B",
  "조국혁신당": "#1e3a8a",
  "개혁신당": "#f97316",
};

function getPartyText(party: string) {
  return PARTY_COLOR[party] ?? "#6b7280";
}

function abbrevParty(party: string): string {
  const MAP: Record<string, string> = {
    "더불어민주당": "민주당",
    "국민의힘": "국민의힘",
    "조국혁신당": "조국혁신당",
    "개혁신당": "개혁신당",
  };
  return MAP[party] ?? party.slice(0, 5);
}

const FEATURES = [
  { icon: Map, color: "#6D28D9", title: "지역별 후보자 비교", desc: "내 지역 후보들의 공약·이력을 한눈에" },
  { icon: BarChart2, color: "#2563EB", title: "국회의원 표결 추적", desc: "어떤 법안에 어떻게 투표했는지 확인" },
  { icon: Newspaper, color: "#059669", title: "AI 정치 뉴스 분석", desc: "12개 언론사 뉴스를 AI가 핵심만 전달" },
  { icon: MessageCircle, color: "#EA580C", title: "유권자 커뮤니티", desc: "이웃들과 지역 현안을 이야기" },
];

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const insets = useSafeAreaInsets();
  const daysLeft = Math.max(0, Math.ceil((new Date("2026-06-03").getTime() - Date.now()) / 86400000));

  return (
    <View style={{ flex: 1, backgroundColor: "#F8F9FA" }}>
      {/* Hero */}
      <View style={{ backgroundColor: "#4c1d95", paddingTop: insets.top + 40, paddingBottom: 40, paddingHorizontal: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <Image source={require("../assets/icon.png")} style={{ width: 40, height: 40, borderRadius: 12 }} />
          <Text style={{ color: "white", fontWeight: "900", fontSize: 18 }}>이유</Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, alignSelf: "flex-start", marginBottom: 20 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#fde047" }} />
          <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "700" }}>2026 지방선거 D-{daysLeft}</Text>
        </View>

        <Text style={{ fontSize: 40, fontWeight: "900", color: "white", lineHeight: 44, marginBottom: 12 }}>이유있게{"\n"}투표하세요</Text>
        <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 22 }}>후보자 정보부터 국회의원 활동까지{"\n"}투표에 필요한 모든 정보를 한 곳에서</Text>
      </View>

      {/* Features */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <Text style={{ fontSize: 11, fontWeight: "900", color: "#6D28D9", letterSpacing: 2, marginBottom: 12 }}>이런 걸 도와드려요</Text>
        {FEATURES.map((f, i) => {
          const Icon = f.icon;
          return (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "white", borderRadius: 18, padding: 14, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
              <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: `${f.color}18`, alignItems: "center", justifyContent: "center" }}>
                <Icon color={f.color} size={20} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "900", color: "#111827" }}>{f.title}</Text>
                <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{f.desc}</Text>
              </View>
              <ChevronRight color="#e5e7eb" size={16} strokeWidth={2} />
            </View>
          );
        })}

        {/* Stats */}
        <View style={{ flexDirection: "row", backgroundColor: "white", borderRadius: 18, borderWidth: 1, borderColor: "#f3f4f6", marginTop: 6, overflow: "hidden" }}>
          {[{ num: "17개", label: "광역시도" }, { num: "300+", label: "국회의원" }, { num: "12개", label: "언론사 뉴스" }].map((s, i) => (
            <View key={s.label} style={{ flex: 1, paddingVertical: 16, alignItems: "center", borderRightWidth: i < 2 ? 1 : 0, borderRightColor: "#f3f4f6" }}>
              <Text style={{ fontSize: 18, fontWeight: "900", color: "#6D28D9" }}>{s.num}</Text>
              <Text style={{ fontSize: 10, color: "#9ca3af", fontWeight: "500", marginTop: 2 }}>{s.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* CTA */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(248,249,250,0.95)", borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 16 }}>
        <TouchableOpacity
          onPress={onStart}
          activeOpacity={0.8}
          style={{ height: 56, backgroundColor: "#6D28D9", borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: "#6D28D9", shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 }}
        >
          <Text style={{ color: "white", fontSize: 16, fontWeight: "900" }}>지역 선택하고 시작하기</Text>
          <ChevronRight color="white" size={20} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", marginTop: 10, fontWeight: "500" }}>무료 · 광고 없음 · 1분이면 완료</Text>
      </View>
    </View>
  );
}

export default function CitySelect() {
  const { user, mutate } = useAuth();
  const insets = useSafeAreaInsets();
  const daysLeft = Math.max(0, Math.ceil((new Date("2026-06-03").getTime() - Date.now()) / 86400000));

  const [step, setStep] = useState<"welcome" | "select">("welcome");
  const [selectedRegions, setSelectedRegions] = useState<{ code: string; name: string; level: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    async function init() {
      const hasSeen = await AsyncStorage.getItem("hasSeenOnboarding");
      const stored = await AsyncStorage.getItem("userRegions");
      if (hasSeen || stored) setStep("select");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) setSelectedRegions(parsed.map((r: any) => ({ ...r, level: r.level ?? "metropolitan" })));
        } catch {}
      } else if (user?.favoriteRegions?.length) {
        setSelectedRegions(user.favoriteRegions.map((r: any) => ({ ...r, level: r.level ?? "metropolitan" })));
      }
      setInitialized(true);
    }
    init();
  }, [user]);

  const handleStartSelect = async () => {
    await AsyncStorage.setItem("hasSeenOnboarding", "true");
    setStep("select");
  };

  const handleSelect = (regionCode: string, regionShort: string, level: string) => {
    const exists = selectedRegions.find((r) => r.code === regionCode);
    if (exists) {
      setSelectedRegions((prev) => prev.filter((r) => r.code !== regionCode));
      return;
    }
    if (selectedRegions.length >= 3) {
      Alert.alert("선택 제한", "지역은 최대 3개까지만 선택 가능합니다");
      return;
    }
    setSelectedRegions((prev) => [...prev, { code: regionCode, name: regionShort, level }]);
  };

  const handleComplete = async () => {
    if (selectedRegions.length === 0) return;
    const isFirstTime = !(await AsyncStorage.getItem("hasSeenTour"));
    await AsyncStorage.setItem("userRegions", JSON.stringify(selectedRegions));
    if (user) {
      try {
        await apiRequest("PATCH", "/api/auth/favorite-regions", { regions: selectedRegions });
        await mutate();
      } catch {}
    }
    router.replace(isFirstTime ? "/intro-tour" : "/(tabs)");
  };

  const filteredRaces = MAYOR_RACES.filter(
    (r) => r.region.includes(searchQuery) || r.regionShort.includes(searchQuery),
  );

  if (!initialized) return null;
  if (step === "welcome") return <WelcomeScreen onStart={handleStartSelect} />;

  return (
    <View style={{ flex: 1, backgroundColor: "#F8F9FA" }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 24, paddingBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Image source={require("../assets/icon.png")} style={{ width: 36, height: 36, borderRadius: 11 }} />
            <Text style={{ color: "#6D28D9", fontWeight: "900", fontSize: 18 }}>이유</Text>
          </View>
          <View style={{ backgroundColor: "#EDE9FE", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 100 }}>
            <Text style={{ color: "#6D28D9", fontWeight: "700", fontSize: 12 }}>D-{daysLeft}</Text>
          </View>
        </View>

        <Text style={{ fontSize: 26, fontWeight: "900", color: "#111827", lineHeight: 32, marginBottom: 8 }}>
          어느 지역{"\n"}<Text style={{ color: "#6D28D9" }}>지방 선거</Text>가 궁금하세요?
        </Text>
        <Text style={{ fontSize: 13, color: "#6b7280", lineHeight: 20, marginBottom: 14 }}>
          광역단체장 후보를 최대 3개 지역까지 선택할 수 있어요.
        </Text>

        {/* Search */}
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "white", borderWidth: 2, borderColor: "#e5e7eb", borderRadius: 16, paddingHorizontal: 12, height: 44 }}>
          <Search color="#9ca3af" size={16} strokeWidth={2} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="지역명 검색 (서울, 부산, 경기...)"
            placeholderTextColor="#9ca3af"
            style={{ flex: 1, marginLeft: 8, fontSize: 15, color: "#111827" }}
          />
        </View>
        <Text style={{ fontSize: 11, fontWeight: "700", color: "#9ca3af", marginTop: 6 }}>
          선택 <Text style={{ color: "#6D28D9" }}>{selectedRegions.length}</Text> / 3
        </Text>
      </View>

      {/* Region Cards */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }}>
        {filteredRaces.map((race) => {
          const isSelected = selectedRegions.some((r) => r.code === race.regionCode);
          const selectedIndex = selectedRegions.findIndex((r) => r.code === race.regionCode);
          const topCandidates = race.candidates.slice(0, 3);

          return (
            <TouchableOpacity
              key={race.regionCode}
              onPress={() => handleSelect(race.regionCode, race.regionShort, race.level ?? "metropolitan")}
              activeOpacity={0.85}
              style={{
                backgroundColor: "white",
                borderRadius: 20,
                padding: 14,
                marginBottom: 10,
                borderWidth: 2,
                borderColor: isSelected ? "#6D28D9" : "#f3f4f6",
                shadowColor: isSelected ? "#6D28D9" : "#000",
                shadowOpacity: isSelected ? 0.1 : 0.04,
                shadowRadius: 6,
                elevation: isSelected ? 4 : 1,
              }}
            >
              {/* Header */}
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                <View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
                    <MapPin color="rgba(109,40,217,0.5)" size={11} strokeWidth={2} />
                    <Text style={{ fontSize: 10, fontWeight: "700", color: "#9ca3af" }}>{race.positionLabel}</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 20, fontWeight: "900", color: "#111827" }}>{race.regionShort}</Text>
                    {isSelected && (
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#6D28D9", alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ color: "white", fontSize: 10, fontWeight: "900" }}>{selectedIndex + 1}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      shareCandidate({
                        id: race.regionCode,
                        name: race.candidates[0]?.name ?? race.regionShort,
                        party: race.candidates[0]?.party ?? "",
                        region: race.regionShort,
                        promises: (race.candidates[0] as any)?.promises ?? [],
                      });
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Share2 color="#9ca3af" size={16} strokeWidth={2} />
                  </TouchableOpacity>
                  <View style={{
                    width: 24, height: 24, borderRadius: 12,
                    borderWidth: 2, borderColor: isSelected ? "#6D28D9" : "#d1d5db",
                    backgroundColor: isSelected ? "#6D28D9" : "white",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    {isSelected && <Text style={{ color: "white", fontSize: 12, fontWeight: "900" }}>✓</Text>}
                  </View>
                </View>
              </View>

              {/* Candidates */}
              <View style={{ gap: 6 }}>
                {topCandidates.map((cand, idx) => (
                  <View
                    key={idx}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 8,
                      backgroundColor: `${getPartyText(cand.party)}18`,
                      borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6,
                    }}
                  >
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: getPartyText(cand.party), alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: "white", fontSize: 8, fontWeight: "900" }}>{cand.name.slice(0, 1)}</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: "900", color: "#111827", flex: 1 }}>{cand.name}</Text>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: getPartyText(cand.party) }}>{abbrevParty(cand.party)}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Bottom CTA */}
      {selectedRegions.length > 0 ? (
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(255,255,255,0.97)", borderTopWidth: 1, borderTopColor: "#f3f4f6", paddingHorizontal: 20, paddingTop: 14, paddingBottom: insets.bottom + 14 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {selectedRegions.map((r, i) => (
                <TouchableOpacity
                  key={r.code}
                  onPress={() => setSelectedRegions((prev) => prev.filter((s) => s.code !== r.code))}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(109,40,217,0.1)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 }}
                >
                  <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: "#6D28D9", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "white", fontSize: 9, fontWeight: "900" }}>{i + 1}</Text>
                  </View>
                  <Text style={{ color: "#6D28D9", fontSize: 13, fontWeight: "700" }}>{r.name}</Text>
                  <X color="rgba(109,40,217,0.5)" size={12} strokeWidth={2} />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <TouchableOpacity
            onPress={handleComplete}
            activeOpacity={0.85}
            style={{ height: 56, backgroundColor: "#6D28D9", borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <Text style={{ color: "white", fontSize: 16, fontWeight: "900" }}>
              {selectedRegions.length === 1 ? `${selectedRegions[0].name} 선택 완료` : `${selectedRegions.length}개 지역 선택 완료`}
            </Text>
            <ChevronRight color="white" size={20} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(255,255,255,0.95)", borderTopWidth: 1, borderTopColor: "#f3f4f6", paddingHorizontal: 24, paddingTop: 14, paddingBottom: insets.bottom + 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 12, color: "#9ca3af", lineHeight: 18 }}>관심 지역을 선택하면{"\n"}맞춤 후보 정보를 바로 볼 수 있어요</Text>
          <TouchableOpacity onPress={async () => { await AsyncStorage.setItem("hasSeenTour", "true"); router.replace("/(tabs)"); }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#9ca3af" }}>건너뛰기</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
