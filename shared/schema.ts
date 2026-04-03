import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  phoneVerified: boolean("phone_verified").default(false).notNull(),
  voteVerified: boolean("vote_verified").default(false).notNull(),
  badges: jsonb("badges").default([]).notNull(), // e.g. ["vote_verified","active","veteran"]
  postCount: integer("post_count").default(0).notNull(),
  favorites: jsonb("favorites").default([]).notNull(), // favorite member IDs or gallery keys
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const verificationCodes = pgTable("verification_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phone: text("phone").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  phone: true,
});

export const registerSchema = z.object({
  username: z.string().min(3, "아이디는 3자 이상이어야 합니다"),
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다"),
  name: z.string().min(2, "이름은 2자 이상이어야 합니다"),
  phone: z.string().regex(/^01[016789]-?\d{3,4}-?\d{4}$/, "올바른 휴대폰 번호를 입력하세요"),
  verificationCode: z.string().length(6, "인증번호 6자리를 입력하세요"),
});

export const loginSchema = z.object({
  username: z.string().min(1, "아이디를 입력하세요"),
  password: z.string().min(1, "비밀번호를 입력하세요"),
});

export const phoneVerificationSchema = z.object({
  phone: z.string().regex(/^01[016789]-?\d{3,4}-?\d{4}$/, "올바른 휴대폰 번호를 입력하세요"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type VoteType = "찬성" | "반대" | "불출석" | "미참석";

export interface VotingRecord {
  billId: string;
  billName: string;
  vote: VoteType;
  date: string;
}

export interface Activity {
  id: string;
  type: "speech" | "event" | "press";
  title: string;
  description: string;
  date: string;
}

export interface ObjectiveScore {
  attendanceRate: number;
  billProposalCount: number;
  votingParticipationRate: number;
  totalScore: number;
}

export interface PoliticianStance {
  econScore: number;
  socialScore: number;
  envScore: number;
  welfareScore: number;
  justiceScore: number;
  scoredBillCount: number;
  hasData: boolean;
}

export interface AssemblyMember {
  id: string;
  name: string;
  party: string;
  district: string;
  photo: string;
  electedYear: number;
  committee: string;
  votingRecords: VotingRecord[];
  activities: Activity[];
  score: ObjectiveScore;
  stance?: PoliticianStance;
}

export interface CandidatePromise {
  id: string;
  title: string;
  description: string;
}

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
}

export interface Candidate {
  id: string;
  name: string;
  party: string;
  photo: string;
  electionType: "presidential" | "local";
  background: string;
  promises: CandidatePromise[];
  pastActivities: string[];
  timeline: TimelineEvent[];
  ratings: number[];
}

export interface Bill {
  id: string;
  name: string;
  summary: string;
  proposedDate: string;
  proposer: string;
  status: "통과" | "계류" | "폐기";
  votes: {
    memberId: string;
    memberName: string;
    party: string;
    vote: VoteType;
  }[];
}

export const communityPosts = pgTable("community_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  anonNickname: text("anon_nickname").notNull(),
  boardType: text("board_type").default("open").notNull(), // 'open' | 'members'
  category: text("category").default("자유").notNull(),   // '자유' | '토론' | '정보공유' | '질문'
  showRealName: boolean("show_real_name").default(false).notNull(),
  viewCount: integer("view_count").default(0).notNull(),
  reportCount: integer("report_count").default(0).notNull(),
  likes: integer("likes").default(0).notNull(),
  dislikes: integer("dislikes").default(0).notNull(),
  agreeCount: integer("agree_count").default(0).notNull(),
  disagreeCount: integer("disagree_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const communityBookmarks = pgTable("community_bookmarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userPostUniq: uniqueIndex("bookmark_user_post_uniq").on(table.userId, table.postId),
}));

export const communityComments = pgTable("community_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(),
  userId: varchar("user_id").notNull(),
  content: text("content").notNull(),
  anonNickname: text("anon_nickname").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const communityReactions = pgTable("community_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(),
  dimension: text("dimension").notNull().default("sentiment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const communityReports = pgTable("community_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id"),
  commentId: varchar("comment_id"),
  userId: varchar("user_id").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPostSchema = createInsertSchema(communityPosts).pick({
  title: true,
  content: true,
}).extend({
  boardType: z.enum(["open", "members"]).default("open"),
  category: z.enum(["자유", "토론", "정보공유", "질문"]).default("자유"),
  showRealName: z.boolean().default(false),
});
export type InsertPost = z.infer<typeof insertPostSchema>;
export type CommunityPost = typeof communityPosts.$inferSelect;
export type CommunityBookmark = typeof communityBookmarks.$inferSelect;

export const BADGE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  vote_verified:      { label: "투표인증",   emoji: "🗳️", color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  real_name_verified: { label: "실명인증",   emoji: "✅",  color: "text-teal-600 bg-teal-50 border-teal-200" },
  active:             { label: "활동왕",     emoji: "⭐",  color: "text-amber-600 bg-amber-50 border-amber-200" },
  veteran:            { label: "베테랑",     emoji: "🏅",  color: "text-orange-600 bg-orange-50 border-orange-200" },
  first_post:         { label: "첫글",       emoji: "✏️",  color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
};

// 뱃지별 전용 테마(갤러리) 접근 제어 매핑
export const BADGE_THEMES: Record<string, { badge: string; name: string; description: string; icon: string }> = {
  vote_verified_theme:      { badge: "vote_verified",      name: "투표 인증자 라운지",  description: "투표를 인증한 시민만 참여할 수 있는 프리미엄 토론 공간", icon: "🗳️" },
  real_name_verified_theme: { badge: "real_name_verified", name: "실명 인증자 라운지",  description: "실명 인증된 회원만 참여할 수 있는 클린 토론 공간",       icon: "✅" },
};

export const insertCommentSchema = createInsertSchema(communityComments).pick({
  content: true,
});
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type CommunityComment = typeof communityComments.$inferSelect;

export const insertReportSchema = z.object({
  postId: z.string().optional(),
  commentId: z.string().optional(),
  reason: z.string().min(1),
});
export type InsertReport = z.infer<typeof insertReportSchema>;

export const assemblyDataCache = pgTable("assembly_data_cache", {
  key: text("key").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const schedulerStatus = pgTable("scheduler_status", {
  id: varchar("id").primaryKey().default(sql`'main'`),
  lastRun: timestamp("last_run"),
  success: boolean("success"),
  errorMessage: text("error_message"),
  consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAssemblyDataCacheSchema = createInsertSchema(assemblyDataCache).pick({
  key: true,
  data: true,
});
export type InsertAssemblyDataCache = z.infer<typeof insertAssemblyDataCacheSchema>;
export type AssemblyDataCache = typeof assemblyDataCache.$inferSelect;

export const insertSchedulerStatusSchema = createInsertSchema(schedulerStatus).pick({
  success: true,
  errorMessage: true,
  consecutiveFailures: true,
});
export type InsertSchedulerStatus = z.infer<typeof insertSchedulerStatusSchema>;
export type SchedulerStatus = typeof schedulerStatus.$inferSelect;

export const ratingSchema = z.object({
  candidateId: z.string(),
  rating: z.number().min(1).max(5),
});

export type RatingInput = z.infer<typeof ratingSchema>;

export const legislators = pgTable("legislators", {
  monaCd: text("mona_cd").primaryKey(),
  name: text("name").notNull(),
  party: text("party").notNull(),
  district: text("district").notNull(),
  photoUrl: text("photo_url").default("").notNull(),
  committee: text("committee").default("").notNull(),
  electedTerm: integer("elected_term").default(22).notNull(),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
});

export const assemblyBills = pgTable("assembly_bills", {
  billId: text("bill_id").primaryKey(),
  billNo: text("bill_no").default("").notNull(),
  billName: text("bill_name").notNull(),
  proposer: text("proposer").default("").notNull(),
  proposeDate: text("propose_date").default("").notNull(),
  result: text("result").default("").notNull(),
  committee: text("committee").default("").notNull(),
  yesCount: integer("yes_count").default(0).notNull(),
  noCount: integer("no_count").default(0).notNull(),
  abstainCount: integer("abstain_count").default(0).notNull(),
  econScore: real("econ_score"),
  socialScore: real("social_score"),
  envScore: real("env_score"),
  welfareScore: real("welfare_score"),
  justiceScore: real("justice_score"),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
});

export const assemblyVotes = pgTable("assembly_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  billId: text("bill_id").notNull(),
  legislatorId: text("legislator_id").notNull(),
  legislatorName: text("legislator_name").notNull(),
  party: text("party").default("").notNull(),
  voteResult: text("vote_result").notNull(),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
}, (table) => ({
  billLegislatorUniq: uniqueIndex("bill_legislator_uniq").on(table.billId, table.legislatorId),
}));

export type Legislator = typeof legislators.$inferSelect;
export type AssemblyBill = typeof assemblyBills.$inferSelect;
export type AssemblyVote = typeof assemblyVotes.$inferSelect;
