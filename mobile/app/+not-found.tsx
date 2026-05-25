import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";

export default function NotFoundScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "white", padding: 24 }}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>🔍</Text>
      <Text style={{ fontSize: 20, fontWeight: "800", color: "#111827", marginBottom: 8 }}>페이지를 찾을 수 없어요</Text>
      <Text style={{ fontSize: 14, color: "#9CA3AF", textAlign: "center", marginBottom: 24 }}>요청하신 페이지가 존재하지 않거나{"\n"}삭제된 페이지입니다.</Text>
      <TouchableOpacity
        onPress={() => router.replace("/(tabs)")}
        style={{ backgroundColor: "#6366f1", paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 }}
        activeOpacity={0.85}
      >
        <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>홈으로 돌아가기</Text>
      </TouchableOpacity>
    </View>
  );
}
