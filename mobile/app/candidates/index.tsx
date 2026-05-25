import { useState, useMemo } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Search, ArrowLeft, MapPin, ChevronRight } from "lucide-react-native";
import { MAYOR_RACES } from "@/lib/mayor-candidates";
import { getPartyColor } from "@/lib/utils";

export default function CandidatesScreen() {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");

  // Flatten all candidates from all races
  const allCandidates = useMemo(() => {
    return MAYOR_RACES.flatMap((race) =>
      race.candidates.map((c) => ({
        ...c,
        positionLabel: race.positionLabel,
        regionShort: race.regionShort,
      }))
    );
  }, []);

  const filtered = useMemo(() =>
    allCandidates.filter((c) =>
      !searchQuery ||
      c.name.includes(searchQuery) ||
      c.party.includes(searchQuery) ||
      c.regionShort.includes(searchQuery)
    ),
  [allCandidates, searchQuery]);

  return (
    <View style={{ flex: 1, backgroundColor: "#F8F9FA" }}>
      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 12, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#f0f0f5" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft color="#374151" size={18} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: "900", color: "#111827" }}>후보자 목록</Text>
          <Text style={{ fontSize: 13, color: "#9CA3AF" }}>{filtered.length}명</Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 12, height: 42 }}>
          <Search color="#9CA3AF" size={16} strokeWidth={2} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="이름·정당·지역 검색"
            placeholderTextColor="#9CA3AF"
            style={{ flex: 1, marginLeft: 8, fontSize: 14, color: "#111827" }}
          />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item: any) => String(item.id)}
        renderItem={({ item }) => {
          const color = getPartyColor(item.party);
          return (
            <TouchableOpacity
              onPress={() => router.push(`/candidates/${item.id}`)}
              activeOpacity={0.85}
              style={{ backgroundColor: "white", borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#f0f0f5", flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${color}20`, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: `${color}40` }}>
                <Text style={{ fontSize: 18, fontWeight: "900", color }}>{item.name.slice(0, 1)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#111827" }}>{item.name}</Text>
                  <View style={{ backgroundColor: `${color}18`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100 }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color }}>{item.party.slice(0, 5)}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <MapPin color="#9CA3AF" size={11} strokeWidth={2} />
                  <Text style={{ fontSize: 12, color: "#6B7280" }}>{item.regionShort} · {item.positionLabel}</Text>
                </View>
              </View>
              <ChevronRight color="#d1d5db" size={16} strokeWidth={2} />
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
