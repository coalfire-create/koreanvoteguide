import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  phoneVerified: boolean("phone_verified").default(false).notNull(),
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
