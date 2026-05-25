import { useState } from "react";
import {
  View, Text, Pressable, TextInput, FlatList,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Search, PenSquare, ThumbsUp, MessageCircle, Eye, X } from "lucide-react-native";
import { useAuth } from "@/lib/auth";
import type { CommunityPost } from "../../../shared/schema";

type PostWithCount = CommunityPost & {
  commentCount: number;
  displayName: string;
  authorBadges: string[];
};

const BOARDS = [
  { id: "free",        label: "자유",   color: "#6D28D9" },
  { id: "candidate",   label: "선거",   color: "#DC2626" },
  { id: "legislators", label: "의원",   color: "#2563EB" },
  { id: "bills",       label: "법안",   color: "#059669" },
] as const;
type BoardId = typeof BOARDS[number]["id"];

const SORTS = ["최신", "인기", "추천"] as const;
const SORT_MAP: Record<string, string> = { "최신": "latest", "인기": "popular", "추천": "recommend" };

function timeAgo(d: string | Date): string {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 60000) return "방금";
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}분`;
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `${h}시간`;
  return `${Math.floor(h / 24)}일`;
}

// ─── 게시글 행 ────────────────────────────────────────────────────
function PostRow({ post, accentColor, isLast }: { post: PostWithCount; accentColor: string; isLast: boolean }) {
  return (
    <Pressable
      onPress={() => router.push(`/community/${post.id}`)}
      style={({ pressed }) => [{
        backgroundColor: pressed ? "#F2F2F7" : "white",
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderBottomWidth: isLast ? 0 : 0.5,
        borderBottomColor: "#E5E5EA",
      }]}
    >
      {/* 제목 */}
      <Text style={{ fontSize: 15, fontWeight: "700", color: "#111827", lineHeight: 21, marginBottom: 5 }} numberOfLines={2}>
        {post.title}
      </Text>

      {/* 본문 미리보기 */}
      {post.content ? (
        <Text style={{ fontSize: 13, color: "#6B6B6B", lineHeight: 18, marginBottom: 10 }} numberOfLines={1}>
          {post.content}
        </Text>
      ) : <View style={{ marginBottom: 10 }} />}

      {/* 메타 */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <ThumbsUp color={accentColor} size={12} strokeWidth={2} />
            <Text style={{ fontSize: 12, fontWeight: "600", color: accentColor }}>{post.likes ?? 0}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <MessageCircle color="#8E8E93" size={12} strokeWidth={2} />
            <Text style={{ fontSize: 12, color: "#8E8E93" }}>{post.commentCount ?? 0}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Eye color="#8E8E93" size={12} strokeWidth={2} />
            <Text style={{ fontSize: 12, color: "#8E8E93" }}>{post.viewCount ?? 0}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 12, color: "#8E8E93" }}>{post.displayName ?? "익명"}</Text>
          <Text style={{ fontSize: 11, color: "#C7C7CC" }}>{timeAgo(post.createdAt as any)} 전</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────
export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [board, setBoard] = useState<BoardId>("free");
  const [sort, setSort] = useState("최신");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const currentBoard = BOARDS.find((b) => b.id === board)!;

  const { data, isLoading, refetch } = useQuery<PostWithCount[]>({
    queryKey: ["/api/community/posts", board, sort, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({ board, sort: SORT_MAP[sort] });
      if (searchQuery) params.set("search", searchQuery);
      const res = await fetch(`/api/community/posts?${params}`);
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const posts = data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: "#F2F2F7" }}>

      {/* ─── 헤더 ─── */}
      <View style={{ backgroundColor: "#F2F2F7", paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
          <Text style={{ fontSize: 34, fontWeight: "900", color: "#111827", letterSpacing: -0.5 }}>커뮤니티</Text>
          <View style={{ flexDirection: "row", gap: 8, paddingBottom: 4 }}>
            <Pressable
              onPress={() => setShowSearch((s) => !s)}
              style={({ pressed }) => [{ width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(118,118,128,0.12)", alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 }]}
            >
              <Search color="#3C3C43" size={16} strokeWidth={2.5} />
            </Pressable>
            {user && (
              <Pressable
                onPress={() => router.push("/community/write")}
                style={({ pressed }) => [{ width: 34, height: 34, borderRadius: 17, backgroundColor: currentBoard.color, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.75 : 1 }]}
              >
                <PenSquare color="white" size={15} strokeWidth={2.5} />
              </Pressable>
            )}
          </View>
        </View>

        {/* 검색창 */}
        {showSearch && (
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "rgba(118,118,128,0.12)", borderRadius: 12, paddingHorizontal: 10, height: 38, marginBottom: 12 }}>
            <Search color="#8E8E93" size={15} strokeWidth={2.5} />
            <TextInput
              autoFocus
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="게시글 검색"
              placeholderTextColor="#8E8E93"
              style={{ flex: 1, marginLeft: 6, fontSize: 15, color: "#111827" }}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")}>
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "#8E8E93", alignItems: "center", justifyContent: "center" }}>
                  <X color="white" size={11} strokeWidth={3} />
                </View>
              </Pressable>
            )}
          </View>
        )}

        {/* 게시판 탭 — underline 스타일 */}
        <View style={{ flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#E5E5EA" }}>
          {BOARDS.map((b) => {
            const active = board === b.id;
            return (
              <Pressable
                key={b.id}
                onPress={() => setBoard(b.id)}
                style={{ flex: 1, alignItems: "center", paddingBottom: 10 }}
              >
                <Text style={{ fontSize: 14, fontWeight: active ? "800" : "500", color: active ? b.color : "#8E8E93" }}>
                  {b.label}
                </Text>
                {active && (
                  <View style={{ position: "absolute", bottom: 0, left: 8, right: 8, height: 2, borderRadius: 1, backgroundColor: b.color }} />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 정렬 바 */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "white", borderBottomWidth: 0.5, borderBottomColor: "#E5E5EA" }}>
        {SORTS.map((s) => (
          <Pressable
            key={s}
            onPress={() => setSort(s)}
            style={({ pressed }) => [{
              paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100,
              backgroundColor: sort === s ? `${currentBoard.color}15` : "transparent",
              opacity: pressed ? 0.7 : 1,
            }]}
          >
            <Text style={{ fontSize: 13, fontWeight: "700", color: sort === s ? currentBoard.color : "#8E8E93" }}>{s}</Text>
          </Pressable>
        ))}
        <Text style={{ marginLeft: "auto", fontSize: 12, color: "#8E8E93" }}>{posts.length}개</Text>
      </View>

      {/* 피드 */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={currentBoard.color} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item: any) => String(item.id)}
          renderItem={({ item, index }) => (
            <PostRow
              post={item}
              accentColor={currentBoard.color}
              isLast={index === posts.length - 1}
            />
          )}
          style={{ backgroundColor: "white", marginTop: 8, borderRadius: 12, marginHorizontal: 0, overflow: "hidden" }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={currentBoard.color} />}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <MessageCircle color="#E5E5EA" size={40} strokeWidth={1.5} />
              <Text style={{ fontSize: 15, color: "#8E8E93", marginTop: 12, fontWeight: "500" }}>아직 게시글이 없어요</Text>
              <Text style={{ fontSize: 13, color: "#C7C7CC", marginTop: 4 }}>첫 번째 글을 남겨보세요</Text>
            </View>
          }
        />
      )}

      {/* 로그인 유도 FAB */}
      {!user && (
        <Pressable
          onPress={() => router.push("/auth")}
          style={({ pressed }) => [{
            position: "absolute", bottom: 24, right: 20,
            backgroundColor: currentBoard.color,
            borderRadius: 28, paddingHorizontal: 20, paddingVertical: 13,
            flexDirection: "row", alignItems: "center", gap: 8,
            shadowColor: currentBoard.color, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
            elevation: 8, opacity: pressed ? 0.85 : 1,
          }]}
        >
          <PenSquare color="white" size={16} strokeWidth={2.5} />
          <Text style={{ color: "white", fontWeight: "800", fontSize: 14 }}>글쓰기</Text>
        </Pressable>
      )}
    </View>
  );
}
