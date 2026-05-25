import { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ThumbsUp, ThumbsDown, FileText, Users, Share2 } from "lucide-react-native";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { shareBill } from "@/lib/useShare";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  "통과": { bg: "#ECFDF5", text: "#059669" },
  "계류": { bg: "#EFF6FF", text: "#3B82F6" },
  "폐기": { bg: "#FEF2F2", text: "#DC2626" },
};

export default function BillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: bill, isLoading } = useQuery({
    queryKey: ["/api/bills", id],
    queryFn: () => fetch(`/api/bills/${id}`).then((r) => r.json()),
    enabled: !!id,
  });

  const { data: votesData } = useQuery({
    queryKey: ["/api/bills", id, "votes"],
    queryFn: () => fetch(`/api/bills/${id}/votes`).then((r) => r.json()),
    enabled: !!id,
  });

  const { data: userVote } = useQuery({
    queryKey: ["/api/bills", id, "my-vote"],
    queryFn: () => fetch(`/api/bills/${id}/my-vote`).then((r) => r.json()),
    enabled: !!id && !!user,
  });

  const voteMutation = useMutation({
    mutationFn: (opinion: "agree" | "disagree") =>
      apiRequest("POST", `/api/bills/${id}/vote`, { opinion }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills", id, "my-vote"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bills", id, "votes"] });
    },
    onError: () => Alert.alert("오류", "투표에 실패했습니다"),
  });

  const handleVote = (opinion: "agree" | "disagree") => {
    if (!user) { Alert.alert("로그인 필요", "투표하려면 로그인하세요"); return; }
    voteMutation.mutate(opinion);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "white" }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!bill) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "white" }}>
        <Text style={{ fontSize: 15, color: "#9CA3AF" }}>법안을 찾을 수 없습니다</Text>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[bill.status] ?? { bg: "#F9FAFB", text: "#6B7280" };
  const agreeCount = votesData?.agree ?? 0;
  const disagreeCount = votesData?.disagree ?? 0;
  const total = agreeCount + disagreeCount;
  const agreeRate = total > 0 ? Math.round((agreeCount / total) * 100) : 50;

  return (
    <View style={{ flex: 1, backgroundColor: "#F8F9FA" }}>
      <View style={{ paddingTop: insets.top, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#f0f0f5" }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft color="#374151" size={20} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 16, fontWeight: "700", color: "#111827", textAlign: "center" }}>법안 상세</Text>
          <TouchableOpacity
            onPress={() => bill && shareBill({ id: bill.id ?? id!, name: bill.name ?? bill.billName, status: bill.status ?? "계류", proposer: bill.proposer, summary: bill.summary ?? bill.committee })}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" }}
          >
            <Share2 color="#374151" size={18} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Bill Info */}
        <View style={{ backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#f0f0f5" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <View style={{ backgroundColor: statusColor.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: statusColor.text }}>{bill.status}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 18, fontWeight: "800", color: "#111827", lineHeight: 26, marginBottom: 12 }}>{bill.name}</Text>
          {[
            { label: "소관 위원회", value: bill.summary },
            { label: "제안자", value: bill.proposer },
            { label: "제안일", value: bill.proposedDate?.slice(0, 10) },
          ].map((row) => (
            row.value ? (
              <View key={row.label} style={{ flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f9fafb" }}>
                <Text style={{ width: 80, fontSize: 13, fontWeight: "600", color: "#9CA3AF" }}>{row.label}</Text>
                <Text style={{ flex: 1, fontSize: 13, color: "#374151" }}>{row.value}</Text>
              </View>
            ) : null
          ))}
        </View>

        {/* Citizen Vote */}
        <View style={{ backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#f0f0f5" }}>
          <Text style={{ fontSize: 15, fontWeight: "800", color: "#111827", marginBottom: 14 }}>시민 의견</Text>
          {total > 0 && (
            <View style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#059669" }}>찬성 {agreeRate}%</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#DC2626" }}>반대 {100 - agreeRate}%</Text>
              </View>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: "#f3f4f6", overflow: "hidden" }}>
                <View style={{ height: "100%", width: `${agreeRate}%`, backgroundColor: "#059669", borderRadius: 4 }} />
              </View>
              <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6, textAlign: "center" }}>총 {total}명 참여</Text>
            </View>
          )}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              onPress={() => handleVote("agree")}
              activeOpacity={0.85}
              style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: userVote?.opinion === "agree" ? "#059669" : "#ECFDF5", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <ThumbsUp color={userVote?.opinion === "agree" ? "white" : "#059669"} size={18} strokeWidth={2} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: userVote?.opinion === "agree" ? "white" : "#059669" }}>찬성 {agreeCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleVote("disagree")}
              activeOpacity={0.85}
              style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: userVote?.opinion === "disagree" ? "#DC2626" : "#FEF2F2", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <ThumbsDown color={userVote?.opinion === "disagree" ? "white" : "#DC2626"} size={18} strokeWidth={2} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: userVote?.opinion === "disagree" ? "white" : "#DC2626" }}>반대 {disagreeCount}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Member Votes */}
        {(votesData?.memberVotes ?? []).length > 0 && (
          <View style={{ backgroundColor: "white", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#f0f0f5" }}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: "#111827", marginBottom: 12 }}>의원 표결</Text>
            {(votesData.memberVotes ?? []).slice(0, 20).map((v: any, i: number) => {
              const vc = v.result?.includes("찬성") ? { bg: "#ECFDF5", text: "#059669" }
                : v.result?.includes("반대") ? { bg: "#FEF2F2", text: "#DC2626" }
                : { bg: "#F9FAFB", text: "#6B7280" };
              return (
                <TouchableOpacity key={i} onPress={() => router.push(`/members/${v.monaCd || v.memberId}`)} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f9fafb" }}>
                  <Text style={{ flex: 1, fontSize: 14, color: "#374151" }}>{v.name || v.memberName}</Text>
                  <Text style={{ fontSize: 12, color: "#9CA3AF", marginRight: 8 }}>{(v.party ?? "").slice(0, 4)}</Text>
                  <View style={{ backgroundColor: vc.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: vc.text }}>{v.result}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
