import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
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

export const ratingSchema = z.object({
  candidateId: z.string(),
  rating: z.number().min(1).max(5),
});

export type RatingInput = z.infer<typeof ratingSchema>;
