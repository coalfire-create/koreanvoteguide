import { useState, useRef, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  Alert, Animated,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Heart, MessageCircle, Eye,
  Send, CornerDownRight, ThumbsUp, Share2,
} from "lucide-react-native";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { sharePost } from "@/lib/useShare";

function timeAgo(d: string | Date): string {
  const diff = Date.now() - new Date(d as string).getTime();
  if (diff < 60000) return "방금";
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

// ─── 대댓글 행 ────────────────────────────────────────────────────
function ReplyRow({
  reply, postUserId, onLike, myLikedIds,
}: {
  reply: any; postUserId: string; onLike: (id: string) => void; myLikedIds: Set<string>;
}) {
  const liked = myLikedIds.has(reply.id);
  return (
    <View style={{ flexDirection: "row", paddingTop: 10, paddingBottom: 2, paddingLeft: 16 }}>
      <CornerDownRight color="#C7C7CC" size={14} strokeWidth={2} style={{ marginRight: 8, marginTop: 3 }} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#E5E5EA", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 10, fontWeight: "800", color: "#6B6B6B" }}>
              {(reply.displayName ?? "익")[0]}
            </Text>
          </View>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#111827" }}>{reply.displayName ?? "익명"}</Text>
          <Text style={{ fontSize: 11, color: "#C7C7CC" }}>{timeAgo(reply.createdAt)}</Text>
        </View>
        <Text style={{ fontSize: 13, color: "#374151", lineHeight: 19, marginBottom: 6 }}>{reply.content}</Text>
        <Pressable
          onPress={() => onLike(reply.id)}
          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
        >
          <ThumbsUp
            color={liked ? "#6D28D9" : "#C7C7CC"}
            size={12}
            strokeWidth={2}
            fill={liked ? "#6D28D9" : "none"}
          />
          <Text style={{ fontSize: 11, fontWeight: "600", color: liked ? "#6D28D9" : "#C7C7CC" }}>
            {(reply.likes ?? 0) + (liked ? 1 : 0)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── 댓글 행 ─────────────────────────────────────────────────────
function CommentRow({
  comment, replies, postUserId, onReply, onLike, myLikedIds,
}: {
  comment: any;
  replies: any[];
  postUserId: string;
  onReply: (id: string, name: string) => void;
  onLike: (id: string) => void;
  myLikedIds: Set<string>;
}) {
  const liked = myLikedIds.has(comment.id);
  const [showReplies, setShowReplies] = useState(true);

  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: "#F2F2F7" }}>
      {/* 작성자 헤더 */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: comment.isAuthor ? "#4c1d95" : "#E5E5EA", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 14, fontWeight: "900", color: comment.isAuthor ? "white" : "#6B6B6B" }}>
            {(comment.displayName ?? "익")[0]}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#111827" }}>{comment.displayName ?? "익명"}</Text>
            {comment.isAuthor && (
              <View style={{ backgroundColor: "#4c1d95", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ fontSize: 10, fontWeight: "800", color: "white" }}>작성자</Text>
              </View>
            )}
            {comment.isVerified && (
              <View style={{ backgroundColor: "#ECFDF5", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ fontSize: 10, fontWeight: "700", color: "#059669" }}>인증</Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: 11, color: "#8E8E93", marginTop: 1 }}>{timeAgo(comment.createdAt)}</Text>
        </View>
      </View>

      {/* 댓글 내용 */}
      <Text style={{ fontSize: 14, color: "#374151", lineHeight: 21, marginBottom: 10 }}>{comment.content}</Text>

      {/* 액션 버튼 */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <Pressable
          onPress={() => onLike(comment.id)}
          style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 5, opacity: pressed ? 0.6 : 1 }]}
        >
          <ThumbsUp
            color={liked ? "#6D28D9" : "#8E8E93"}
            size={15}
            strokeWidth={2}
            fill={liked ? "#6D28D9" : "none"}
          />
          <Text style={{ fontSize: 13, fontWeight: "600", color: liked ? "#6D28D9" : "#8E8E93" }}>
            {(comment.likes ?? 0) + (liked ? 1 : 0)}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onReply(comment.id, comment.displayName ?? "익명")}
          style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 5, opacity: pressed ? 0.6 : 1 }]}
        >
          <CornerDownRight color="#8E8E93" size={15} strokeWidth={2} />
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#8E8E93" }}>답글</Text>
        </Pressable>

        {replies.length > 0 && (
          <Pressable
            onPress={() => setShowReplies((s) => !s)}
            style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 4, opacity: pressed ? 0.6 : 1, marginLeft: "auto" }]}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: "#6D28D9" }}>
              {showReplies ? "답글 숨기기" : `답글 ${replies.length}개`}
            </Text>
          </Pressable>
        )}
      </View>

      {/* 대댓글 */}
      {showReplies && replies.map((r: any) => (
        <ReplyRow key={r.id} reply={r} postUserId={postUserId} onLike={onLike} myLikedIds={myLikedIds} />
      ))}
    </View>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────
export default function CommunityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [comment, setComment] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [liked, setLiked] = useState(false);
  const [myLikedCommentIds, setMyLikedCommentIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<TextInput>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/community/posts", id],
    queryFn: () => fetch(`/api/community/posts/${id}`).then((r) => r.json()),
    enabled: !!id,
  });

  const post = data?.post ?? data;
  const rawComments: any[] = data?.comments ?? [];

  // 최상위 댓글 + 대댓글 분리
  const topComments = rawComments.filter((c) => !c.parentId);
  const repliesOf = (parentId: string) => rawComments.filter((c) => c.parentId === parentId);

  const likeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/community/posts/${id}/like`),
    onSuccess: () => {
      setLiked((l) => !l);
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts", id] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: (payload: { content: string; parentId?: string }) =>
      apiRequest("POST", `/api/community/posts/${id}/comments`, payload),
    onSuccess: () => {
      setComment("");
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts", id] });
    },
  });

  const commentLikeMutation = useMutation({
    mutationFn: (commentId: string) =>
      fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "comment", targetId: commentId, type: "like" }),
      }).then((r) => r.json()),
    onSuccess: (_, commentId) => {
      setMyLikedCommentIds((prev) => {
        const next = new Set(prev);
        next.has(commentId) ? next.delete(commentId) : next.add(commentId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts", id] });
    },
  });

  const handleReply = useCallback((commentId: string, name: string) => {
    setReplyTo({ id: commentId, name });
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSend = () => {
    if (!user) { Alert.alert("로그인 필요", "댓글을 작성하려면 로그인하세요"); return; }
    const trimmed = comment.trim();
    if (!trimmed) return;
    commentMutation.mutate({ content: trimmed, parentId: replyTo?.id });
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F2F2F7", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#6D28D9" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#F2F2F7" }}
      keyboardVerticalOffset={0}
    >
      {/* ─── 헤더 ─── */}
      <View style={{ paddingTop: insets.top, backgroundColor: "white", borderBottomWidth: 0.5, borderBottomColor: "#E5E5EA" }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#F2F2F7", alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 }]}
          >
            <ArrowLeft color="#111827" size={18} strokeWidth={2.5} />
          </Pressable>
          <Text style={{ flex: 1, fontSize: 16, fontWeight: "700", color: "#111827" }} numberOfLines={1}>
            {post?.title ?? "게시글"}
          </Text>
          {post && (
            <Pressable
              onPress={() => sharePost({ id: id!, title: post.title, content: post.content, authorName: post.displayName })}
              style={({ pressed }) => [{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#F2F2F7", alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 }]}
            >
              <Share2 color="#374151" size={17} strokeWidth={2} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {post && (
          <>
            {/* ─── 본문 ─── */}
            <View style={{ backgroundColor: "white", marginBottom: 8 }}>
              <View style={{ padding: 20 }}>
                <Text style={{ fontSize: 20, fontWeight: "900", color: "#111827", lineHeight: 28, marginBottom: 10 }}>
                  {post.title}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#E5E5EA", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: "#6B6B6B" }}>
                      {(post.displayName ?? "익")[0]}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#374151" }}>
                    {post.displayName ?? "익명"}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#C7C7CC" }}>·</Text>
                  <Text style={{ fontSize: 12, color: "#8E8E93" }}>{timeAgo(post.createdAt)}</Text>
                </View>
                <Text style={{ fontSize: 15, color: "#374151", lineHeight: 25 }}>{post.content}</Text>
              </View>

              {/* 액션 바 */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 0, borderTopWidth: 0.5, borderTopColor: "#F2F2F7" }}>
                <Pressable
                  onPress={() => likeMutation.mutate()}
                  style={({ pressed }) => [{
                    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                    gap: 6, paddingVertical: 13, opacity: pressed ? 0.6 : 1,
                  }]}
                >
                  <Heart color={liked ? "#EF4444" : "#8E8E93"} size={17} strokeWidth={2} fill={liked ? "#EF4444" : "none"} />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: liked ? "#EF4444" : "#8E8E93" }}>
                    {(post.likes ?? 0) + (liked ? 1 : 0)}
                  </Text>
                </Pressable>

                <View style={{ width: 0.5, height: 20, backgroundColor: "#E5E5EA" }} />

                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 13 }}>
                  <MessageCircle color="#8E8E93" size={17} strokeWidth={2} />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#8E8E93" }}>{rawComments.length}</Text>
                </View>

                <View style={{ width: 0.5, height: 20, backgroundColor: "#E5E5EA" }} />

                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 13 }}>
                  <Eye color="#8E8E93" size={17} strokeWidth={2} />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#8E8E93" }}>{post.viewCount ?? 0}</Text>
                </View>
              </View>
            </View>

            {/* ─── 댓글 섹션 ─── */}
            <View style={{ backgroundColor: "white" }}>
              <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: "#111827" }}>
                  댓글 <Text style={{ color: "#6D28D9" }}>{topComments.length}</Text>
                </Text>
              </View>

              {topComments.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <MessageCircle color="#E5E5EA" size={36} strokeWidth={1.5} />
                  <Text style={{ fontSize: 14, color: "#8E8E93", marginTop: 10, fontWeight: "500" }}>첫 댓글을 남겨보세요</Text>
                </View>
              ) : (
                topComments.map((c: any) => (
                  <CommentRow
                    key={c.id}
                    comment={c}
                    replies={repliesOf(c.id)}
                    postUserId={post.userId ?? ""}
                    onReply={handleReply}
                    onLike={(cid) => commentLikeMutation.mutate(cid)}
                    myLikedIds={myLikedCommentIds}
                  />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* ─── 댓글 입력창 ─── */}
      <View style={{
        backgroundColor: "white",
        borderTopWidth: 0.5, borderTopColor: "#E5E5EA",
        paddingBottom: insets.bottom + 8,
      }}>
        {/* 답글 대상 표시 */}
        {replyTo && (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#F2F2F7", borderBottomWidth: 0.5, borderBottomColor: "#E5E5EA" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <CornerDownRight color="#6D28D9" size={13} strokeWidth={2.5} />
              <Text style={{ fontSize: 13, color: "#6D28D9", fontWeight: "600" }}>{replyTo.name}에게 답글</Text>
            </View>
            <Pressable onPress={() => setReplyTo(null)}>
              <Text style={{ fontSize: 13, color: "#8E8E93", fontWeight: "600" }}>취소</Text>
            </Pressable>
          </View>
        )}

        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end", backgroundColor: "#F2F2F7", borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8, minHeight: 42 }}>
            <TextInput
              ref={inputRef}
              value={comment}
              onChangeText={setComment}
              placeholder={user ? (replyTo ? `@${replyTo.name} 에게 답글...` : "댓글을 입력하세요...") : "로그인 후 댓글 작성"}
              placeholderTextColor="#8E8E93"
              editable={!!user}
              multiline
              style={{ flex: 1, fontSize: 14, color: "#111827", maxHeight: 100, paddingTop: 0, paddingBottom: 0 }}
            />
          </View>
          <Pressable
            onPress={handleSend}
            disabled={!comment.trim() || commentMutation.isPending}
            style={({ pressed }) => [{
              width: 42, height: 42, borderRadius: 21,
              backgroundColor: comment.trim() ? "#6D28D9" : "#E5E5EA",
              alignItems: "center", justifyContent: "center",
              opacity: pressed ? 0.75 : 1,
            }]}
          >
            {commentMutation.isPending
              ? <ActivityIndicator size="small" color="white" />
              : <Send color={comment.trim() ? "white" : "#8E8E93"} size={17} strokeWidth={2.5} />
            }
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
