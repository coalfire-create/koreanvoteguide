import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, BarChart3, TrendingUp, TrendingDown } from "lucide-react-native";
import { useAssemblyMembers } from "@/lib/api-data";
import { getPartyColor } from "@/lib/utils";

function getScoreColor(score: number): string {
  if (score >= 80) return "#059669";
  if (score >= 60) return "#3B82F6";
  if (score >= 40) return "#F59E0B";
  return "#EF4444";
}

function getScoreGrade(score: number): string {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

export default function EvaluationScreen() {
  const insets = useSafeAreaInsets();
  const { members, isLoading } = useAssemblyMembers();
  const sorted = [...members].sort((a: any, b: any) => (b.score?.totalScore ?? 0) - (a.score?.totalScore ?? 0));

  return (
    <View style={{ flex: 1, backgroundColor: "#F8F9FA" }}>
      <View style={{ paddingTop: insets.top, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#f0f0f5" }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft color="#374151" size={20} strokeWidth={2} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "900", color: "#111827" }}>객관적 평가</Text>
            <Text style={{ fontSize: 12, color: "#9CA3AF" }}>출석률·법안 발의 기반 점수</Text>
          </View>
        </View>

        {/* Method explanation */}
        <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingBottom: 14 }}>
          {[
            { label: "출석률", weight: "70%", color: "#6366f1" },
            { label: "법안 발의", weight: "30%", color: "#10B981" },
          ].map((item) => (
            <View key={item.label} style={{ flex: 1, backgroundColor: "#F8F9FA", borderRadius: 12, padding: 10, borderWidth: 1, borderColor: "#f0f0f5" }}>
              <Text style={{ fontSize: 11, color: "#9CA3AF" }}>{item.label}</Text>
              <Text style={{ fontSize: 16, fontWeight: "800", color: item.color }}>{item.weight}</Text>
            </View>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const color = getPartyColor((item as any).party);
            const score = (item as any).score?.totalScore ?? 0;
            const scoreColor = getScoreColor(score);
            const grade = getScoreGrade(score);
            const attendanceRate = (item as any).score?.attendanceRate ?? 0;

            return (
              <TouchableOpacity
                onPress={() => router.push(`/members/${(item as any).id}`)}
                activeOpacity={0.85}
                style={{ backgroundColor: "white", borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#f0f0f5", flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                {/* Rank */}
                <Text style={{ width: 28, fontSize: 14, fontWeight: "800", color: index < 3 ? "#F59E0B" : "#9CA3AF", textAlign: "center" }}>
                  {index + 1}
                </Text>

                {/* Avatar */}
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${color}20`, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 15, fontWeight: "900", color }}>{(item as any).name.slice(0, 1)}</Text>
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#111827" }}>{(item as any).name}</Text>
                    <View style={{ backgroundColor: `${color}18`, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 100 }}>
                      <Text style={{ fontSize: 9, fontWeight: "700", color }}>{((item as any).party ?? "").slice(0, 4)}</Text>
                    </View>
                  </View>
                  {/* Progress bar */}
                  <View style={{ height: 4, backgroundColor: "#f3f4f6", borderRadius: 2, overflow: "hidden" }}>
                    <View style={{ height: "100%", width: `${score}%`, backgroundColor: scoreColor, borderRadius: 2 }} />
                  </View>
                  <Text style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>출석 {attendanceRate}%</Text>
                </View>

                {/* Score */}
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 18, fontWeight: "900", color: scoreColor }}>{score}</Text>
                  <View style={{ backgroundColor: `${scoreColor}18`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: "800", color: scoreColor }}>{grade}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
