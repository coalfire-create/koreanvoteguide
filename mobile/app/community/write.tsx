import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send } from "lucide-react-native";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

const BOARDS = [
  { id: "free", label: "자유 게시판" },
  { id: "candidate", label: "선거 게시판" },
  { id: "legislators", label: "의원 게시판" },
  { id: "bills", label: "법안 게시판" },
] as const;

export default function CommunityWriteScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [board, setBoard] = useState("free");
  const [authorType, setAuthorType] = useState<"anonymous" | "nickname">("anonymous");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/community/posts", {
        title: title.trim(),
        content: content.trim(),
        board,
        authorType,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
      router.back();
    },
    onError: (e: any) => {
      Alert.alert("오류", e.message ?? "게시글 작성에 실패했습니다");
    },
  });

  if (!user) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "white" }}>
        <Text style={{ fontSize: 16, color: "#9CA3AF", marginBottom: 16 }}>로그인이 필요합니다</Text>
        <TouchableOpacity onPress={() => router.push("/auth")} style={{ backgroundColor: "#6366f1", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}>
          <Text style={{ color: "white", fontWeight: "700" }}>로그인하기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const canSubmit = title.trim().length > 0 && content.trim().length > 0;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: "#F8F9FA" }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#f0f0f5" }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft color="#374151" size={20} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: "800", color: "#111827" }}>글쓰기</Text>
          <TouchableOpacity
            onPress={() => mutation.mutate()}
            disabled={!canSubmit || mutation.isPending}
            style={{ backgroundColor: canSubmit ? "#6366f1" : "#e5e7eb", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 }}
          >
            <Text style={{ color: canSubmit ? "white" : "#9CA3AF", fontWeight: "700", fontSize: 14 }}>등록</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        {/* Board Select */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {BOARDS.map((b) => (
              <TouchableOpacity
                key={b.id}
                onPress={() => setBoard(b.id)}
                activeOpacity={0.8}
                style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, backgroundColor: board === b.id ? "#6366f1" : "white", borderWidth: 1, borderColor: board === b.id ? "#6366f1" : "#e5e7eb" }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: board === b.id ? "white" : "#374151" }}>{b.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Author Type */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
          {[{ id: "anonymous", label: "익명" }, { id: "nickname", label: user.nickname ?? user.name }].map((a) => (
            <TouchableOpacity
              key={a.id}
              onPress={() => setAuthorType(a.id as any)}
              activeOpacity={0.8}
              style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, backgroundColor: authorType === a.id ? "#EEF2FF" : "white", borderWidth: 1, borderColor: authorType === a.id ? "#6366f1" : "#e5e7eb" }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: authorType === a.id ? "#6366f1" : "#374151" }}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Title */}
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="제목을 입력하세요"
          placeholderTextColor="#9CA3AF"
          style={{ backgroundColor: "white", borderRadius: 14, padding: 16, fontSize: 17, fontWeight: "700", color: "#111827", borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 12 }}
        />

        {/* Content */}
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="내용을 입력하세요..."
          placeholderTextColor="#9CA3AF"
          multiline
          style={{ backgroundColor: "white", borderRadius: 14, padding: 16, fontSize: 15, color: "#374151", lineHeight: 24, borderWidth: 1, borderColor: "#e5e7eb", minHeight: 200 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
