import { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, FlatList, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search, MapPin, ChevronRight } from "lucide-react-native";
import { getPartyColor } from "@/lib/utils";

const REGION_TABS = [
  { code: "11", label: "서울" },
  { code: "26", label: "부산" },
  { code: "27", label: "대구" },
  { code: "28", label: "인천" },
  { code: "29", label: "광주" },
  { code: "30", label: "대전" },
  { code: "41", label: "경기" },
];

export default function AssemblyElectionScreen() {
  const insets = useSafeAreaInsets();
  const [regionCode, setRegionCode] = useState("11");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: candidates, isLoading } = useQuery({
    queryKey: ["/api/election/candidates", regionCode],
    queryFn: () => fetch(`/api/election/candidates?regionCode=${regionCode}&electionType=assembly`).then((r) => r.json()),
    enabled: !!regionCode,
    staleTime: 10 * 60 * 1000,
  });

  const filtered = (candidates ?? []).filter(
    (c: any) => !searchQuery || (c.name ?? "").includes(searchQuery) || (c.district ?? "").includes(searchQuery)
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#F8F9FA" }}>
      <View style={{ paddingTop: insets.top, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#f0f0f5" }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft color="#374151" size={20} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 17, fontWeight: "800", color: "#111827", textAlign: "center" }}>국회의원 선거</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, marginHorizontal: 16, paddingHorizontal: 12, height: 40, marginBottom: 10 }}>
          <Search color="#9CA3AF" size={15} strokeWidth={2} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="이름·지역구 검색"
            placeholderTextColor="#9CA3AF"
            style={{ flex: 1, marginLeft: 8, fontSize: 14, color: "#111827" }}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 12 }}>
          {REGION_TABS.map((r) => (
            <TouchableOpacity
              key={r.code}
              onPress={() => setRegionCode(r.code)}
              activeOpacity={0.8}
              style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, backgroundColor: regionCode === r.code ? "#6366f1" : "#F3F4F6" }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: regionCode === r.code ? "white" : "#374151" }}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item: any) => String(item.id)}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const color = getPartyColor(item.party);
            return (
              <TouchableOpacity
                onPress={() => router.push(`/candidates/${item.id}`)}
                activeOpacity={0.85}
                style={{ backgroundColor: "white", borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#f0f0f5", flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${color}20`, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 16, fontWeight: "900", color }}>{(item.name ?? "?").slice(0, 1)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#111827" }}>{item.name}</Text>
                    <View style={{ backgroundColor: `${color}18`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100 }}>
                      <Text style={{ fontSize: 10, fontWeight: "700", color }}>{(item.party ?? "").slice(0, 5)}</Text>
                    </View>
                  </View>
                  {item.district && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <MapPin color="#9CA3AF" size={11} strokeWidth={2} />
                      <Text style={{ fontSize: 12, color: "#6B7280" }}>{item.district}</Text>
                    </View>
                  )}
                </View>
                <ChevronRight color="#d1d5db" size={16} strokeWidth={2} />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <Text style={{ fontSize: 14, color: "#9CA3AF" }}>후보 데이터가 없습니다</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
