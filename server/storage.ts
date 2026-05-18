import {
  type User, type InsertUser, users, verificationCodes, assemblyDataCache, schedulerStatus,
  communityPosts, communityComments, communityReactions, communityReports, communityBookmarks,
  type CommunityPost, type CommunityComment,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, asc, inArray, or } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  getUserByPhoneHash(phoneHash: string): Promise<User | undefined>;
  createUser(user: Partial<User> & InsertUser): Promise<User>;
  withdrawUser(userId: string): Promise<void>;
  hidePost(postId: string): Promise<void>;
  unhidePost(postId: string): Promise<void>;
  verifyVote(userId: string): Promise<User>;
  getUserBadges(userId: string): Promise<string[]>;
  createVerificationCode(phone: string, code: string, expiresAt: Date): Promise<void>;
  getVerificationCode(phone: string, code: string): Promise<{ id: string; phone: string; code: string; expiresAt: Date; used: boolean } | undefined>;
  markVerificationCodeUsed(id: string): Promise<void>;
  getCachedData(key: string): Promise<any[] | null>;
  getSchedulerStatus(): Promise<{ lastRun: Date | null; success: boolean | null; errorMessage: string | null; consecutiveFailures: number } | null>;
  getPosts(opts?: { boardType?: string; category?: string; sort?: string; legislatorId?: string }): Promise<(CommunityPost & { commentCount: number; authorBadges: string[]; authorName: string })[]>;
  getPost(id: string): Promise<(CommunityPost & { authorBadges: string[]; authorName: string }) | undefined>;
  createPost(userId: string, title: string, content: string, anonNickname: string, boardType?: string, category?: string, showRealName?: boolean, legislatorId?: string, authorType?: string, displayName?: string | null, isVerified?: boolean, thumbnailUrl?: string | null, tagType?: string | null, tagId?: string | null, tagName?: string | null, attachments?: any[], contentType?: string, hasPoll?: boolean): Promise<CommunityPost>;
  incrementViewCount(postId: string): Promise<void>;
  getComments(postId: string): Promise<(CommunityComment & { authorBadges: string[] })[]>;
  createComment(postId: string, userId: string, content: string, anonNickname: string, authorType?: string, displayName?: string | null, isVerified?: boolean): Promise<CommunityComment & { authorBadges: string[] }>;
  addReaction(postId: string, userId: string, type: string): Promise<void>;
  getUserReactions(postId: string, userId: string): Promise<{ sentiment: string | null; stance: string | null }>;
  createReport(userId: string, reason: string, postId?: string, commentId?: string): Promise<void>;
  toggleBookmark(postId: string, userId: string): Promise<{ bookmarked: boolean }>;
  getUserBookmarks(userId: string): Promise<string[]>;
  updateUserFavorites(userId: string, favorites: string[]): Promise<User>;
  updateUserFavoriteRegions(userId: string, regions: any[]): Promise<User>;
  updateNickname(userId: string, nickname: string): Promise<User>;
  verifyRealName(userId: string, realName: string): Promise<User>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user;
  }

  async getUserByPhoneHash(phoneHash: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phoneHash, phoneHash));
    return user;
  }

  async createUser(insertUser: Partial<User> & InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({
      ...insertUser,
      phoneVerified: true,
      badges: ["first_post"] as any,
    } as any).returning();
    return user;
  }

  async withdrawUser(userId: string): Promise<void> {
    // 회원 탈퇴 — 식별정보를 즉시 비식별화하고 soft delete. 30일 후 cron으로 완전 삭제.
    const now = new Date();
    await db
      .update(users)
      .set({
        deletedAt: now,
        username: `deleted_${userId.slice(0, 8)}_${Date.now()}`,
        name: "탈퇴회원",
        realName: null,
        phone: "",
        phoneHash: null,
        nickname: null,
      } as any)
      .where(eq(users.id, userId));
  }

  async hidePost(postId: string): Promise<void> {
    await db.update(communityPosts).set({ hiddenAt: new Date() } as any).where(eq(communityPosts.id, postId));
  }

  async unhidePost(postId: string): Promise<void> {
    await db.update(communityPosts).set({ hiddenAt: null } as any).where(eq(communityPosts.id, postId));
  }

  async verifyVote(userId: string): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("사용자를 찾을 수 없습니다");
    const currentBadges = (user.badges as string[]) ?? [];
    const newBadges = currentBadges.includes("vote_verified")
      ? currentBadges
      : [...currentBadges, "vote_verified"];
    const [updated] = await db
      .update(users)
      .set({ voteVerified: true, badges: newBadges as any })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async getUserBadges(userId: string): Promise<string[]> {
    const [user] = await db.select({ badges: users.badges, postCount: users.postCount, phoneVerified: users.phoneVerified }).from(users).where(eq(users.id, userId));
    if (!user) return [];
    const badges = (user.badges as string[]) ?? [];
    // 실명 인증 뱃지 자동 부여 (휴대폰 인증 완료자)
    if (user.phoneVerified && !badges.includes("real_name_verified")) badges.push("real_name_verified");
    // 활동 배지 자동 부여
    if (user.postCount >= 50 && !badges.includes("veteran")) badges.push("veteran");
    else if (user.postCount >= 10 && !badges.includes("active")) badges.push("active");
    return badges;
  }

  async createVerificationCode(phone: string, code: string, expiresAt: Date): Promise<void> {
    await db.insert(verificationCodes).values({ phone, code, expiresAt });
  }

  async getVerificationCode(phone: string, code: string) {
    const [record] = await db
      .select()
      .from(verificationCodes)
      .where(eq(verificationCodes.phone, phone));

    const match = record && record.code === code && !record.used && new Date(record.expiresAt) > new Date()
      ? record
      : undefined;
    return match;
  }

  async markVerificationCodeUsed(id: string): Promise<void> {
    await db.update(verificationCodes).set({ used: true }).where(eq(verificationCodes.id, id));
  }

  async getCachedData(key: string): Promise<any[] | null> {
    const [record] = await db.select().from(assemblyDataCache).where(eq(assemblyDataCache.key, key));
    if (!record) return null;
    const data = record.data;
    if (typeof data === "string") {
      try { return JSON.parse(data); } catch { return null; }
    }
    return Array.isArray(data) ? data : null;
  }

  async getSchedulerStatus() {
    const [record] = await db.select().from(schedulerStatus).where(eq(schedulerStatus.id, "main"));
    if (!record) return null;
    return {
      lastRun: record.lastRun,
      success: record.success,
      errorMessage: record.errorMessage,
      consecutiveFailures: record.consecutiveFailures,
    };
  }

  async getPosts(opts: { boardType?: string; category?: string; sort?: string; legislatorId?: string; tagType?: string; tagId?: string } = {}): Promise<(CommunityPost & { commentCount: number; authorBadges: string[]; authorName: string })[]> {
    const orderCol = opts.sort === "popular"
      ? desc(sql`${communityPosts.likes} + ${communityPosts.agreeCount}`)
      : opts.sort === "views"
      ? desc(communityPosts.viewCount)
      : desc(communityPosts.createdAt);
      
    // Build conditions
    const conditions = [];
    if (opts.boardType) conditions.push(eq(communityPosts.boardType, opts.boardType));
    if (opts.category) conditions.push(eq(communityPosts.category, opts.category));
    if (opts.legislatorId) {
      // Both the board-specific column and the general tag columns should be checked
      conditions.push(or(
        eq(communityPosts.legislatorId, opts.legislatorId),
        and(
          eq(communityPosts.tagId, opts.legislatorId),
          eq(communityPosts.tagType, "legislator")
        )
      ));
    }
    
    // If tagId is provided specifically (other than legislator search), use it
    if (opts.tagId && !opts.legislatorId) {
       if (opts.tagType) {
         conditions.push(and(eq(communityPosts.tagId, opts.tagId), eq(communityPosts.tagType, opts.tagType)));
       } else {
         conditions.push(eq(communityPosts.tagId, opts.tagId));
       }
    }
    
    const posts = await db
      .select()
      .from(communityPosts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderCol)
      .limit(200);

    const counts = await db
      .select({ postId: communityComments.postId, count: sql<number>`count(*)::int` })
      .from(communityComments)
      .groupBy(communityComments.postId);
    const countMap = new Map(counts.map((c) => [c.postId, c.count]));

    // 작성자 배지 일괄 조회
    const userIds = Array.from(new Set(posts.map((p) => p.userId)));
    const authorBadgeMap = new Map<string, string[]>();
    const authorNameMap = new Map<string, string>();
    if (userIds.length > 0) {
      const authorRows = await db
        .select({ id: users.id, badges: users.badges, postCount: users.postCount, phoneVerified: users.phoneVerified, name: users.name })
        .from(users)
        .where(inArray(users.id, userIds));
      for (const u of authorRows) {
        const b = (u.badges as string[]) ?? [];
        if (u.phoneVerified && !b.includes("real_name_verified")) b.push("real_name_verified");
        if (u.postCount >= 50 && !b.includes("veteran")) b.push("veteran");
        else if (u.postCount >= 10 && !b.includes("active")) b.push("active");
        authorBadgeMap.set(u.id, b);
        const name = u.name;
        authorNameMap.set(u.id, name.length <= 1 ? name : name[0] + "*".repeat(name.length - 2) + name[name.length - 1]);
      }
    }

    let allComments: any[] = [];
    let commentLikes = new Map<string, number>();
    if (posts.length > 0) {
      allComments = await db.select().from(communityComments).where(inArray(communityComments.postId, posts.map(p => p.id)));
      const commentIds = allComments.map(c => c.id);
      if (commentIds.length > 0) {
        const { reactions } = await import("@shared/schema");
        const likesData = await db.select({ targetId: reactions.targetId, count: sql<number>`count(*)::int` })
          .from(reactions)
          .where(and(eq(reactions.targetType, 'comment'), eq(reactions.type, 'like'), inArray(reactions.targetId, commentIds)))
          .groupBy(reactions.targetId);
        likesData.forEach(ld => commentLikes.set(ld.targetId, ld.count));
      }
    }

    return posts.map((p) => {
      const postComments = allComments.filter(c => c.postId === p.id);
      postComments.sort((a, b) => (commentLikes.get(b.id) || 0) - (commentLikes.get(a.id) || 0));
      return {
        ...p,
        commentCount: countMap.get(p.id) || 0,
        authorBadges: authorBadgeMap.get(p.userId) ?? [],
        authorName: authorNameMap.get(p.userId) ?? "",
        topComment: postComments[0] || null,
        topCommentLikes: postComments[0] ? (commentLikes.get(postComments[0].id) || 0) : 0,
      };
    });
  }

  async getPost(id: string): Promise<(CommunityPost & { authorBadges: string[]; authorName: string }) | undefined> {
    const [post] = await db.select().from(communityPosts).where(eq(communityPosts.id, id));
    if (!post) return undefined;
    const badges = await this.getUserBadges(post.userId);
    const [authorRow] = await db.select({ name: users.name }).from(users).where(eq(users.id, post.userId));
    const authorName = authorRow ? (authorRow.name.length <= 1 ? authorRow.name : authorRow.name[0] + "*".repeat(authorRow.name.length - 2) + authorRow.name[authorRow.name.length - 1]) : "";
    return { ...post, authorBadges: badges, authorName };
  }

  async createPost(userId: string, title: string, content: string, anonNickname: string, boardType = "open", category = "자유", showRealName = false, legislatorId?: string, authorType = "anonymous", displayName?: string | null, isVerified = false, thumbnailUrl?: string | null, tagType?: string | null, tagId?: string | null, tagName?: string | null, attachments: any[] = [], contentType = "plain", hasPoll = false): Promise<CommunityPost> {
    const [post] = await db
      .insert(communityPosts)
      .values({ userId, title, content, anonNickname, boardType, category, showRealName, legislatorId, authorType, displayName: displayName ?? null, isVerified, thumbnailUrl: thumbnailUrl ?? null, tagType: tagType ?? null, tagId: tagId ?? null, tagName: tagName ?? null, attachments: attachments ?? [], contentType, hasPoll })
      .returning();
    // postCount 증가 & 배지 자동 부여
    await db.execute(sql`UPDATE users SET post_count = post_count + 1 WHERE id = ${userId}`);
    const postCount = ((await db.select({ postCount: users.postCount }).from(users).where(eq(users.id, userId)))[0]?.postCount) ?? 0;
    if (postCount >= 50) {
      await db.execute(sql`
        UPDATE users SET badges = badges || '["veteran"]'::jsonb
        WHERE id = ${userId} AND NOT (badges @> '["veteran"]'::jsonb)
      `);
    } else if (postCount >= 10) {
      await db.execute(sql`
        UPDATE users SET badges = badges || '["active"]'::jsonb
        WHERE id = ${userId} AND NOT (badges @> '["active"]'::jsonb)
      `);
    }
    return post;
  }

  async incrementViewCount(postId: string): Promise<void> {
    await db.execute(sql`UPDATE community_posts SET view_count = view_count + 1 WHERE id = ${postId}`);
  }

  async getComments(postId: string): Promise<(CommunityComment & { authorBadges: string[] })[]> {
    const comments = await db
      .select()
      .from(communityComments)
      .where(eq(communityComments.postId, postId))
      .orderBy(communityComments.createdAt);
    const userIds = Array.from(new Set(comments.map((c) => c.userId)));
    const authorBadgeMap = new Map<string, string[]>();
    if (userIds.length > 0) {
      const authorRows = await db
        .select({ id: users.id, badges: users.badges, postCount: users.postCount })
        .from(users)
        .where(inArray(users.id, userIds));
      for (const u of authorRows) {
        const b = (u.badges as string[]) ?? [];
        if (u.postCount >= 50 && !b.includes("veteran")) b.push("veteran");
        else if (u.postCount >= 10 && !b.includes("active")) b.push("active");
        authorBadgeMap.set(u.id, b);
      }
    }
    return comments.map((c) => ({ ...c, authorBadges: authorBadgeMap.get(c.userId) ?? [] }));
  }

  async createComment(postId: string, userId: string, content: string, anonNickname: string, authorType = "anonymous", displayName?: string | null, isVerified = false): Promise<CommunityComment & { authorBadges: string[] }> {
    const [comment] = await db.insert(communityComments).values({ postId, userId, content, anonNickname, authorType, displayName: displayName ?? null, isVerified }).returning();
    const badges = await this.getUserBadges(userId);
    return { ...comment, authorBadges: badges };
  }

  async toggleBookmark(postId: string, userId: string): Promise<{ bookmarked: boolean }> {
    const [existing] = await db
      .select()
      .from(communityBookmarks)
      .where(and(eq(communityBookmarks.postId, postId), eq(communityBookmarks.userId, userId)));
    if (existing) {
      await db.delete(communityBookmarks).where(eq(communityBookmarks.id, existing.id));
      return { bookmarked: false };
    }
    await db.insert(communityBookmarks).values({ postId, userId });
    return { bookmarked: true };
  }

  async getUserBookmarks(userId: string): Promise<string[]> {
    const rows = await db
      .select({ postId: communityBookmarks.postId })
      .from(communityBookmarks)
      .where(eq(communityBookmarks.userId, userId))
      .orderBy(desc(communityBookmarks.createdAt));
    return rows.map((r) => r.postId);
  }

  private getDimension(type: string): string {
    return (type === "agree" || type === "disagree") ? "stance" : "sentiment";
  }

  private getColumnName(type: string): string {
    switch (type) {
      case "like": return "likes";
      case "dislike": return "dislikes";
      case "agree": return "agree_count";
      case "disagree": return "disagree_count";
      default: return "likes";
    }
  }

  async addReaction(postId: string, userId: string, type: string): Promise<void> {
    const dimension = this.getDimension(type);
    const [existing] = await db.select().from(communityReactions)
      .where(and(
        eq(communityReactions.postId, postId),
        eq(communityReactions.userId, userId),
        eq(communityReactions.dimension, dimension),
      ));

    if (existing) {
      if (existing.type === type) {
        await db.delete(communityReactions).where(eq(communityReactions.id, existing.id));
        const col = this.getColumnName(type);
        await db.execute(sql`UPDATE community_posts SET ${sql.identifier(col)} = ${sql.identifier(col)} - 1 WHERE id = ${postId}`);
      } else {
        const oldCol = this.getColumnName(existing.type);
        const newCol = this.getColumnName(type);
        await db.update(communityReactions).set({ type }).where(eq(communityReactions.id, existing.id));
        await db.execute(sql`UPDATE community_posts SET ${sql.identifier(oldCol)} = ${sql.identifier(oldCol)} - 1, ${sql.identifier(newCol)} = ${sql.identifier(newCol)} + 1 WHERE id = ${postId}`);
      }
    } else {
      await db.insert(communityReactions).values({ postId, userId, type, dimension });
      const col = this.getColumnName(type);
      await db.execute(sql`UPDATE community_posts SET ${sql.identifier(col)} = ${sql.identifier(col)} + 1 WHERE id = ${postId}`);
    }
  }

  async getUserReactions(postId: string, userId: string): Promise<{ sentiment: string | null; stance: string | null }> {
    const rows = await db.select().from(communityReactions)
      .where(and(eq(communityReactions.postId, postId), eq(communityReactions.userId, userId)));
    const result: { sentiment: string | null; stance: string | null } = { sentiment: null, stance: null };
    for (const r of rows) {
      if (r.dimension === "sentiment") result.sentiment = r.type;
      else if (r.dimension === "stance") result.stance = r.type;
    }
    return result;
  }

  async createReport(userId: string, reason: string, postId?: string, commentId?: string): Promise<void> {
    await db.insert(communityReports).values({ userId, reason, postId: postId ?? null, commentId: commentId ?? null });
    if (postId) {
      await db.execute(sql`UPDATE community_posts SET report_count = report_count + 1 WHERE id = ${postId}`);
    }
  }

  async updateUserFavorites(userId: string, favorites: string[]): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ favorites: favorites as any })
      .where(eq(users.id, userId))
      .returning();
    if (!updated) throw new Error("사용자를 찾을 수 없습니다");
    return updated;
  }

  async updateUserFavoriteRegions(userId: string, regions: any[]): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ favoriteRegions: regions as any })
      .where(eq(users.id, userId))
      .returning();
    if (!updated) throw new Error("사용자를 찾을 수 없습니다");
    return updated;
  }

  async updateNickname(userId: string, nickname: string): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ nickname, nicknameUpdatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    if (!updated) throw new Error("사용자를 찾을 수 없습니다");
    return updated;
  }

  async verifyRealName(userId: string, realName: string): Promise<User> {
    const currentBadges = await this.getUserBadges(userId);
    const newBadges = currentBadges.includes("real_name_verified")
      ? currentBadges
      : [...currentBadges, "real_name_verified"];
    const [updated] = await db
      .update(users)
      .set({ realNameVerified: true, realName, badges: newBadges as any })
      .where(eq(users.id, userId))
      .returning();
    if (!updated) throw new Error("사용자를 찾을 수 없습니다");
    return updated;
  }
}

export const storage = new DatabaseStorage();
