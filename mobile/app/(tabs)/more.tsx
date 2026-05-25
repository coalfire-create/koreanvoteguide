import { useState } from "react";
import {
  View, Text, ScrollView, Pressable, Alert, Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronRight, LogOut, MapPin, Bell, CircleHelp,
  FileText, Heart, ThumbsUp, BarChart3, Newspaper,
  Users, Star, ShieldCheck, Settings,
} from "lucide-react-native";
import { useAuth } from "@/lib/auth";
import { useFavorites } from "@/lib/useFavorites";
import { getPartyColor } from "@/lib/utils";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";

// ─── iOS 설정 스타일 행 ───────────────────────────────────────────
function SettingRow({
  icon: Icon, iconBg, label, value, onPress, isDanger, isLast,
}: {
  icon: any; iconBg: string; label: string;
  value?: string; onPress?: () => void; isDanger?: boolean; isLast?: boolean;
}) {
  return (
    <>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: pressed ? "#F2F2F7" : "white",
          minHeight: 50,
        }]}
      >
        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: iconBg, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
          <Icon color="white" size={16} strokeWidth={2} />
        </View>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: "500", color: isDanger ? "#FF3B30" : "#111827" }}>{label}</Text>
        {value && <Text style={{ fontSize: 14, color: "#8E8E93", marginRight: 6 }}>{value}</Text>}
        <ChevronRight color="#C7C7CC" size={15} strokeWidth={2} />
      </Pressable>
      {!isLast && <View style={{ height: 0.5, backgroundColor: "#E5E5EA", marginLeft: 60 }} />}
    </>
  );
}

function SectionLabel({ title }: { title: string }) {
  return (
    <Text style={{ fontSize: 13, fontWeight: "600", color: "#6B6B6B", paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 }}>
      {title}
    </Text>
  );
}

function GroupedList({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: "white", borderRadius: 12, marginHorizontal: 16, overflow: "hidden" }}>
      {children}
    </View>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────
export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { favorites } = useFavorites();

  const myActivityQuery = useQuery({
    queryKey: ["/api/auth/my-activity"],
    enabled: !!user,
    staleTime: 60 * 1000,
  });
  const activity: any = myActivityQuery.data;

  const handleLogout = () => {
    Alert.alert("로그아웃", "로그아웃 하시겠습니까?", [
      { text: "취소", style: "cancel" },
      { text: "로그아웃", style: "destructive", onPress: async () => { await logout(); } },
    ]);
  };

  const STATS = [
    { icon: FileText, label: "게시글", value: user?.postCount ?? 0, color: "#6D28D9" },
    { icon: Heart, label: "즐겨찾기", value: favorites.length, color: "#E11D48" },
    { icon: ThumbsUp, label: "투표 법안", value: activity?.votedBills?.length ?? 0, color: "#2563EB" },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F2F2F7" }}
      contentContainerStyle={{ paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, marginBottom: 6 }}>
        <Text style={{ fontSize: 34, fontWeight: "900", color: "#111827", letterSpacing: -0.5 }}>마이</Text>
      </View>

      {/* ─── 프로필 카드 ─── */}
      {user ? (
        <View style={{ backgroundColor: "white", borderRadius: 20, marginHorizontal: 16, marginTop: 6, overflow: "hidden" }}>
          {/* 프로필 헤더 */}
          <View style={{ backgroundColor: "#4c1d95", padding: 20, paddingTop: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.3)" }}>
                <Text style={{ fontSize: 24, fontWeight: "900", color: "white" }}>{user.name.slice(0, 1)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 20, fontWeight: "800", color: "white" }}>{user.nickname ?? user.name}</Text>
                  {user.voteVerified && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 }}>
                      <ShieldCheck color="#4ade80" size={11} strokeWidth={2.5} />
                      <Text style={{ fontSize: 10, fontWeight: "700", color: "#4ade80" }}>투표인증</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>{user.username}</Text>
              </View>
            </View>
          </View>

          {/* 통계 */}
          <View style={{ flexDirection: "row" }}>
            {STATS.map((s, i) => {
              const Icon = s.icon;
              return (
                <View key={s.label} style={{ flex: 1, alignItems: "center", paddingVertical: 16, borderRightWidth: i < STATS.length - 1 ? 0.5 : 0, borderRightColor: "#E5E5EA" }}>
                  <Text style={{ fontSize: 22, fontWeight: "900", color: s.color }}>{s.value}</Text>
                  <Text style={{ fontSize: 11, color: "#8E8E93", marginTop: 3, fontWeight: "500" }}>{s.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        /* 비로그인 */
        <View style={{ backgroundColor: "white", borderRadius: 20, marginHorizontal: 16, marginTop: 6, padding: 28, alignItems: "center" }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#F2F2F7", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
            <Users color="#8E8E93" size={32} strokeWidth={1.5} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 6 }}>로그인이 필요해요</Text>
          <Text style={{ fontSize: 14, color: "#8E8E93", textAlign: "center", lineHeight: 21, marginBottom: 20 }}>
            관심 의원·투표 기록·활동 내역을{"\n"}확인하려면 로그인하세요.
          </Text>
          <Pressable
            onPress={() => router.push("/auth")}
            style={({ pressed }) => [{ width: "100%", height: 50, backgroundColor: "#6D28D9", borderRadius: 14, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={{ color: "white", fontSize: 16, fontWeight: "800" }}>로그인 / 회원가입</Text>
          </Pressable>
        </View>
      )}

      {/* ─── 즐겨찾기 ─── */}
      {favorites.length > 0 && (
        <>
          <SectionLabel title="즐겨찾기" />
          <View style={{ backgroundColor: "white", borderRadius: 12, marginHorizontal: 16, paddingVertical: 16 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 16, flexDirection: "row" }}>
              {favorites.slice(0, 8).map((f) => {
                const color = getPartyColor((f as any).party);
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => router.push(f.type === "member" ? `/members/${f.id}` : `/candidates/${f.id}`)}
                    style={({ pressed }) => [{ alignItems: "center", gap: 6, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: `${color}15`, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: `${color}30` }}>
                      <Text style={{ fontSize: 20, fontWeight: "900", color }}>{f.name.slice(0, 1)}</Text>
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: "#374151", textAlign: "center" }} numberOfLines={1}>{f.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </>
      )}

      {/* ─── 둘러보기 ─── */}
      <SectionLabel title="둘러보기" />
      <GroupedList>
        <SettingRow icon={BarChart3}  iconBg="#6D28D9" label="의원 객관적 평가" onPress={() => router.push("/evaluation")} />
        <SettingRow icon={Newspaper}  iconBg="#2563EB" label="정치 뉴스"        onPress={() => router.push("/(tabs)/news")} />
        <SettingRow icon={Users}      iconBg="#059669" label="선거 후보자"      onPress={() => router.push("/candidates/" as any)} isLast />
      </GroupedList>

      {/* ─── 설정 ─── */}
      <SectionLabel title="설정" />
      <GroupedList>
        <SettingRow icon={MapPin}     iconBg="#EA580C" label="관심 지역 변경"   onPress={() => router.push("/city-select")} />
        <SettingRow icon={Bell}       iconBg="#0284C7" label="알림 설정"        onPress={() => Alert.alert("준비중", "알림 설정은 곧 지원됩니다.")} />
        <SettingRow icon={CircleHelp} iconBg="#6B7280" label="앱 정보"          onPress={() => Alert.alert("이유있는 투표", "버전 1.0.0\n안티그래비티")} isLast />
      </GroupedList>

      {/* ─── 계정 ─── */}
      {user && (
        <>
          <SectionLabel title="계정" />
          <GroupedList>
            <SettingRow icon={LogOut} iconBg="#FF3B30" label="로그아웃" onPress={handleLogout} isDanger isLast />
          </GroupedList>
        </>
      )}
    </ScrollView>
  );
}
