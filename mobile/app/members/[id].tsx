import { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Linking, RefreshControl,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Heart, HeartOff, MapPin, Calendar, FileText, Vote,
  ExternalLink, ChevronRight, Users, Mail, Globe, Newspaper, Share2,
} from "lucide-react-native";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useAssemblyMembers, useMemberDetail } from "@/lib/api-data";
import { getPartyColor } from "@/lib/utils";
import { useFavorites } from "@/lib/useFavorites";
import { shareMember } from "@/lib/useShare";

const TABS = ["기본정보", "표결", "법안", "뉴스"];

function partyAbbr(p: string | null): string {
  if (!p) return "무소속";
  if (p.includes("더불어민주당")) return "민주당";
  if (p.includes("국민의힘")) return "국민의힘";
  return p.slice(0, 6);
}

function voteResultColor(result?: string): { bg: string; text: string } {
  if (!result) return { bg: "#F9FAFB", text: "#6B7280" };
  if (result.includes("찬성")) return { bg: "#ECFDF5", text: "#059669" };
  if (result.includes("반대")) return { bg: "#FEF2F2", text: "#DC2626" };
  if (result.includes("기권") || result.includes("불참")) return { bg: "#FFFBEB", text: "#D97706" };
  return { bg: "#F9FAFB", text: "#6B7280" };
}

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "방금";
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function MemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavorites();
  const [tab, setTab] = useState("기본정보");

  const { members } = useAssemblyMembers();
  const member = members.find((m: any) => m.id === id);
  const { detail, isLoading: detailLoading } = useMemberDetail(id);

  const color = getPartyColor(member?.party);
  const isBookmarked = isFavorite(id ?? "");

  const votesQuery = useQuery({
    queryKey: ["/api/members", id, "votes"],
    queryFn: () => fetch(`/api/members/${id}/votes`).then((r) => r.json()),
    enabled: !!id && tab === "표결",
    staleTime: 12 * 60 * 60 * 1000,
  });

  const billsQuery = useQuery({
    queryKey: ["/api/members", id, "bills"],
    queryFn: () => fetch(`/api/members/${id}/bills`).then((r) => r.json()),
    enabled: !!id && tab === "법안",
    staleTime: 12 * 60 * 60 * 1000,
  });

  const newsQuery = useQuery({
    queryKey: ["/api/news", "member", id],
    queryFn: () => fetch(`/api/news?member=${encodeURIComponent(member?.name ?? "")}`).then((r) => r.json()),
    enabled: !!id && !!member?.name && tab === "뉴스",
    staleTime: 15 * 60 * 1000,
  });

  const followQuery = useQuery({
    queryKey: ["/api/members", id, "follow-status"],
    queryFn: () => fetch(`/api/members/${id}/follow-status`).then((r) => r.json()),
    enabled: !!id && !!user,
  });

  const queryClient = useQueryClient();
  const followMutation = useMutation({
    mutationFn: async () => {
      if (followQuery.data?.isFollowing) {
        await apiRequest("DELETE", `/api/members/${id}/follow`);
      } else {
        await apiRequest("POST", `/api/members/${id}/follow`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members", id, "follow-status"] });
    },
  });

  const handleBookmark = () => {
    if (!member) return;
    if (isBookmarked) {
      removeFavorite(id ?? "");
    } else {
      addFavorite({ id: id ?? "", name: member.name, type: "member", party: member.party });
    }
  };

  if (!member) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "white" }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F8F9FA" }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#f0f0f5" }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft color="#374151" size={20} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 17, fontWeight: "800", color: "#111827", textAlign: "center" }}>{member.name} 의원</Text>
          <TouchableOpacity
            onPress={() => shareMember({
              id: member.id,
              name: member.name,
              party: member.party ?? "",
              district: member.district ?? "",
              promises: (detail as any)?.promises ?? [],
            })}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" }}
          >
            <Share2 color="#374151" size={18} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleBookmark} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" }}>
            {isBookmarked
              ? <Heart color="#EF4444" size={20} strokeWidth={2} fill="#EF4444" />
              : <Heart color="#9CA3AF" size={20} strokeWidth={2} />
            }
          </TouchableOpacity>
        </View>

        {/* Profile */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 16, flexDirection: "row", gap: 16 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: `${color}20`, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: `${color}40` }}>
            <Text style={{ fontSize: 28, fontWeight: "900", color }}>{member.name.slice(0, 1)}</Text>
          </View>
          <View style={{ flex: 1, justifyContent: "center" }}>
            <Text style={{ fontSize: 22, fontWeight: "900", color: "#111827", marginBottom: 4 }}>{member.name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <View style={{ backgroundColor: `${color}20`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color }}>{partyAbbr(member.party)}</Text>
              </View>
              {member.district && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <MapPin color="#9CA3AF" size={12} strokeWidth={2} />
                  <Text style={{ fontSize: 12, color: "#6B7280" }}>{member.district}</Text>
                </View>
              )}
            </View>
            {member.committee && (
              <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>{member.committee}</Text>
            )}
          </View>
        </View>

        {/* Follow Button */}
        {user && (
          <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
            <TouchableOpacity
              onPress={() => followMutation.mutate()}
              disabled={followMutation.isPending}
              activeOpacity={0.85}
              style={{
                height: 40, borderRadius: 12,
                backgroundColor: followQuery.data?.isFollowing ? "#EEF2FF" : "#6366f1",
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <Users color={followQuery.data?.isFollowing ? "#6366f1" : "white"} size={16} strokeWidth={2} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: followQuery.data?.isFollowing ? "#6366f1" : "white" }}>
                {followQuery.data?.isFollowing ? "팔로잉" : "팔로우"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

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
        {/* 기본정보 */}
        {tab === "기본정보" && (
          <View>
            {detailLoading ? (
              <ActivityIndicator color="#6366f1" style={{ marginTop: 20 }} />
            ) : detail ? (
              <View>
                {/* 재산/학력/전과 */}
                <View style={{ backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#f0f0f5" }}>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: "#111827", marginBottom: 14 }}>공직자 정보</Text>
                  {[
                    { label: "재산", value: detail.propertyAmount },
                    { label: "학력", value: detail.education },
                    { label: "전과", value: detail.criminalRecord ? `${detail.criminalCount}건` : "없음" },
                    { label: "경력", value: detail.career },
                  ].map((row) => (
                    <View key={row.label} style={{ flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f9fafb" }}>
                      <Text style={{ width: 48, fontSize: 13, fontWeight: "600", color: "#9CA3AF" }}>{row.label}</Text>
                      <Text style={{ flex: 1, fontSize: 13, color: "#374151", lineHeight: 20 }} numberOfLines={3}>{row.value || "정보 없음"}</Text>
                    </View>
                  ))}
                </View>

                {/* 연락처 */}
                {(detail.email || detail.homepage) && (
                  <View style={{ backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#f0f0f5" }}>
                    <Text style={{ fontSize: 15, fontWeight: "800", color: "#111827", marginBottom: 12 }}>연락처</Text>
                    {detail.email && (
                      <TouchableOpacity onPress={() => Linking.openURL(`mailto:${detail.email}`)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}>
                        <Mail color="#6366f1" size={16} strokeWidth={2} />
                        <Text style={{ fontSize: 14, color: "#6366f1" }}>{detail.email}</Text>
                      </TouchableOpacity>
                    )}
                    {detail.homepage && (
                      <TouchableOpacity onPress={() => Linking.openURL(detail.homepage!)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}>
                        <Globe color="#6366f1" size={16} strokeWidth={2} />
                        <Text style={{ fontSize: 14, color: "#6366f1" }} numberOfLines={1}>{detail.homepage}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            ) : (
              /* Fallback to basic member data */
              <View style={{ backgroundColor: "white", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#f0f0f5" }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: "#111827", marginBottom: 14 }}>기본 정보</Text>
                {[
                  { label: "소속", value: member.party },
                  { label: "지역구", value: member.district },
                  { label: "위원회", value: member.committee },
                ].map((row) => (
                  row.value ? (
                    <View key={row.label} style={{ flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f9fafb" }}>
                      <Text style={{ width: 64, fontSize: 13, fontWeight: "600", color: "#9CA3AF" }}>{row.label}</Text>
                      <Text style={{ flex: 1, fontSize: 13, color: "#374151" }}>{row.value}</Text>
                    </View>
                  ) : null
                ))}
              </View>
            )}
          </View>
        )}

        {/* 표결 */}
        {tab === "표결" && (
          <View>
            {votesQuery.isLoading ? (
              <ActivityIndicator color="#6366f1" style={{ marginTop: 20 }} />
            ) : (
              (votesQuery.data ?? []).map((vote: any, i: number) => {
                const vc = voteResultColor(vote.result);
                return (
                  <View key={i} style={{ backgroundColor: "white", borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#f0f0f5" }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827", flex: 1, lineHeight: 20 }} numberOfLines={2}>{vote.billName || vote.bill_name}</Text>
                      <View style={{ backgroundColor: vc.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, marginLeft: 8 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: vc.text }}>{vote.result}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 11, color: "#9CA3AF" }}>{vote.voteDate || vote.vote_date || ""}</Text>
                  </View>
                );
              })
            )}
            {!votesQuery.isLoading && (votesQuery.data ?? []).length === 0 && (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Text style={{ fontSize: 14, color: "#9CA3AF" }}>표결 데이터가 없습니다</Text>
              </View>
            )}
          </View>
        )}

        {/* 법안 */}
        {tab === "법안" && (
          <View>
            {billsQuery.isLoading ? (
              <ActivityIndicator color="#6366f1" style={{ marginTop: 20 }} />
            ) : (
              (billsQuery.data ?? []).map((bill: any, i: number) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => router.push(`/bills/${bill.billId || bill.id}`)}
                  activeOpacity={0.85}
                  style={{ backgroundColor: "white", borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#f0f0f5" }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827", lineHeight: 20, marginBottom: 6 }} numberOfLines={2}>{bill.billName || bill.name}</Text>
                  <Text style={{ fontSize: 12, color: "#9CA3AF" }}>{bill.proposeDate || bill.proposedDate || ""}</Text>
                </TouchableOpacity>
              ))
            )}
            {!billsQuery.isLoading && (billsQuery.data ?? []).length === 0 && (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Text style={{ fontSize: 14, color: "#9CA3AF" }}>발의 법안이 없습니다</Text>
              </View>
            )}
          </View>
        )}

        {/* 뉴스 */}
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
