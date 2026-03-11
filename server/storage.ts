import {
  type User, type InsertUser, users, verificationCodes, assemblyDataCache, schedulerStatus,
  communityPosts, communityComments, communityReactions, communityReports,
  type CommunityPost, type CommunityComment,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createVerificationCode(phone: string, code: string, expiresAt: Date): Promise<void>;
  getVerificationCode(phone: string, code: string): Promise<{ id: string; phone: string; code: string; expiresAt: Date; used: boolean } | undefined>;
  markVerificationCodeUsed(id: string): Promise<void>;
  getCachedData(key: string): Promise<any[] | null>;
  getSchedulerStatus(): Promise<{ lastRun: Date | null; success: boolean | null; errorMessage: string | null; consecutiveFailures: number } | null>;
  getPosts(): Promise<(CommunityPost & { commentCount: number })[]>;
  getPost(id: string): Promise<CommunityPost | undefined>;
  createPost(userId: string, title: string, content: string, anonNickname: string): Promise<CommunityPost>;
  getComments(postId: string): Promise<CommunityComment[]>;
  createComment(postId: string, userId: string, content: string, anonNickname: string): Promise<CommunityComment>;
  addReaction(postId: string, userId: string, type: string): Promise<void>;
  getUserReactions(postId: string, userId: string): Promise<{ sentiment: string | null; stance: string | null }>;
  createReport(userId: string, reason: string, postId?: string, commentId?: string): Promise<void>;
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

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({
      ...insertUser,
      phoneVerified: true,
    }).returning();
    return user;
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

  async getPosts(): Promise<(CommunityPost & { commentCount: number })[]> {
    const posts = await db.select().from(communityPosts).orderBy(desc(communityPosts.createdAt));
    const counts = await db
      .select({ postId: communityComments.postId, count: sql<number>`count(*)::int` })
      .from(communityComments)
      .groupBy(communityComments.postId);
    const countMap = new Map(counts.map((c) => [c.postId, c.count]));
    return posts.map((p) => ({ ...p, commentCount: countMap.get(p.id) || 0 }));
  }

  async getPost(id: string): Promise<CommunityPost | undefined> {
    const [post] = await db.select().from(communityPosts).where(eq(communityPosts.id, id));
    return post;
  }

  async createPost(userId: string, title: string, content: string, anonNickname: string): Promise<CommunityPost> {
    const [post] = await db.insert(communityPosts).values({ userId, title, content, anonNickname }).returning();
    return post;
  }

  async getComments(postId: string): Promise<CommunityComment[]> {
    return db.select().from(communityComments).where(eq(communityComments.postId, postId)).orderBy(communityComments.createdAt);
  }

  async createComment(postId: string, userId: string, content: string, anonNickname: string): Promise<CommunityComment> {
    const [comment] = await db.insert(communityComments).values({ postId, userId, content, anonNickname }).returning();
    return comment;
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
  }
}

export const storage = new DatabaseStorage();
