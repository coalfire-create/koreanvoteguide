import { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Heart, MapPin, CheckCircle2, Newspaper, ExternalLink } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { MAYOR_RACES } from "@/lib/mayor-candidates";
import { getPartyColor } from "@/lib/utils";
import { useFavorites } from "@/lib/useFavorites";

const TABS = ["기본정보", "공약", "뉴스"];

function partyAbbr(p: string): string {
  if (p.includes("더불어민주당")) return "민주당";
  if (p.includes("국민의힘")) return "국민의힘";
  return p.slice(0, 6);
}

export default function CandidateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState("기본정보");
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();

  // Find candidate in MAYOR_RACES
  let candidate: any = null;
  for (const race of MAYOR_RACES) {
    const found = race.candidates.find((c) => String(c.id) === id);
    if (found) { candidate = { ...found, positionLabel: race.positionLabel }; break; }
  }

  const color = getPartyColor(candidate?.party);
  const isBookmarked = isFavorite(id ?? "");

  const newsQuery = useQuery({
    queryKey: ["/api/news", "candidate", candidate?.name],
    queryFn: () => fetch(`/api/news?member=${encodeURIComponent(candidate?.name ?? "")}`).then((r) => r.json()),
    enabled: !!candidate?.name && tab === "뉴스",
    staleTime: 15 * 60 * 1000,
  });

  if (!candidate) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "white" }}>
        <Text style={{ fontSize: 15, color: "#9CA3AF" }}>후보를 찾을 수 없습니다</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 14, color: "#6366f1", fontWeight: "700" }}>돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBookmark = () => {
    if (isBookmarked) removeFavorite(id ?? "");
    else addFavorite({ id: id ?? "", name: candidate.name, type: "candidate", party: candidate.party });
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F8F9FA" }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#f0f0f5" }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft color="#374151" size={20} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 17, fontWeight: "800", color: "#111827", textAlign: "center" }}>{candidate.name}</Text>
          <TouchableOpacity onPress={handleBookmark} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" }}>
            <Heart color={isBookmarked ? "#EF4444" : "#9CA3AF"} size={20} strokeWidth={2} fill={isBookmarked ? "#EF4444" : "none"} />
          </TouchableOpacity>
        </View>

        {/* Profile */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 16, alignItems: "center" }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: `${color}20`, alignItems: "center", justifyContent: "center", marginBottom: 12, borderWidth: 3, borderColor: `${color}40` }}>
            <Text style={{ fontSize: 30, fontWeight: "900", color }}>{candidate.name.slice(0, 1)}</Text>
          </View>
          <Text style={{ fontSize: 24, fontWeight: "900", color: "#111827", marginBottom: 8 }}>{candidate.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <View style={{ backgroundColor: `${color}20`, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color }}>{candidate.party}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <MapPin color="#9CA3AF" size={13} strokeWidth={2} />
              <Text style={{ fontSize: 13, color: "#6B7280" }}>{candidate.positionLabel}</Text>
            </View>
          </View>
          {candidate.slogan && (
            <Text style={{ fontSize: 14, color: "#374151", marginTop: 10, textAlign: "center", fontStyle: "italic" }}>"{candidate.slogan}"</Text>
          )}
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 4 }}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              activeOpacity={0.8}
              style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: tab === t ? "#6366f1" : "transparent" }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: tab === t ? "#6366f1" : "#6B7280" }}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {tab === "기본정보" && (
          <View>
            {candidate.background && (
              <View style={{ backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#f0f0f5" }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: "#111827", marginBottom: 10 }}>배경</Text>
                <Text style={{ fontSize: 14, color: "#374151", lineHeight: 22 }}>{candidate.background}</Text>
              </View>
            )}
            {candidate.pastActivities?.length > 0 && (
              <View style={{ backgroundColor: "white", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#f0f0f5" }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: "#111827", marginBottom: 10 }}>주요 경력</Text>
                {candidate.pastActivities.map((a: string, i: number) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 6 }}>
                    <CheckCircle2 color="#6366f1" size={16} strokeWidth={2} style={{ marginTop: 2 }} />
                    <Text style={{ fontSize: 13, color: "#374151", lineHeight: 20, flex: 1 }}>{a}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {tab === "공약" && (
          <View>
            {(candidate.promises ?? []).length > 0 ? (
              candidate.promises.map((p: any, i: number) => (
                <View key={i} style={{ backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: "#f0f0f5" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: `${color}20`, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 12, fontWeight: "900", color }}>{i + 1}</Text>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#111827", flex: 1 }}>{p.title}</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: "#6B7280", lineHeight: 20 }}>{p.description}</Text>
                </View>
              ))
            ) : (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Text style={{ fontSize: 14, color: "#9CA3AF" }}>공약 데이터가 없습니다</Text>
              </View>
            )}
          </View>
        )}

        {tab === "뉴스" && (
          <View>
            {newsQuery.isLoading ? (
              <ActivityIndicator color="#6366f1" style={{ marginTop: 20 }} />
            ) : (
              (newsQuery.data?.items ?? []).map((news: any, i: number) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => Linking.openURL(news.link)}
                  activeOpacity={0.85}
                  style={{ backgroundColor: "white", borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#f0f0f5" }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827", lineHeight: 20, marginBottom: 8 }} numberOfLines={3}>{news.title}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 12, color: "#9CA3AF" }}>{news.source}</Text>
                    <ExternalLink color="#9CA3AF" size={12} strokeWidth={2} />
                  </View>
                </TouchableOpacity>
              ))
            )}
            {!newsQuery.isLoading && (newsQuery.data?.items ?? []).length === 0 && (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Text style={{ fontSize: 14, color: "#9CA3AF" }}>관련 뉴스가 없습니다</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
