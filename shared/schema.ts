import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, timestamp, jsonb, uniqueIndex, index, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  // 전화번호 평문 — 가급적 phoneHash로 lookup하고 평문은 본인 노출 시에만
  phone: text("phone").notNull(),
  // HMAC-SHA256(PHONE_PEPPER, phone) — 중복 가입 검사용. 평문 노출 위험 없음.
  phoneHash: text("phone_hash"),
  phoneVerified: boolean("phone_verified").default(false).notNull(),
  voteVerified: boolean("vote_verified").default(false).notNull(),
  // ⚠️ realNameVerified는 PASS/NICE 등 KISA 지정 본인확인기관 통과 시에만 true로 설정해야 함
  realNameVerified: boolean("real_name_verified").default(false).notNull(),
  realName: text("real_name"),
  // 본인확인기관 식별자 — pass/nice/kmc 등. null이면 자체 인증(법적 "실명인증" 아님)
  realNameProvider: text("real_name_provider"),
  // 출생연도 — 만 14세 미만 가입 차단용 (개인정보보호법 §22-2 법정대리인 동의 회피)
  birthYear: integer("birth_year"),
  // ===== 본인확인기관(PASS/NICE/PortOne 등) 콜백으로 수신하는 인적사항 =====
  // birthDate: 본인확인 API가 돌려주는 정확한 생년월일 (YYYYMMDD 8자리 문자열).
  // 통계용 — birthYear와 별개로 보관해 만나이 갱신/생일 기반 분석 가능.
  birthDate: text("birth_date"),
  // gender: "M" | "F" — 본인확인 API 응답값을 그대로 저장. ENUM 대신 text로 두어 외부값 호환.
  gender: text("gender"),
  // ageGroup: 10대=10, 20대=20, ... 60대 이상=60. 가입 시점 계산값을 캐시(주기적으로 재계산).
  ageGroup: integer("age_group"),
  // ci(Connecting Information): 본인확인기관이 부여하는 고유 식별값. 한 사람이 여러 계정 만드는 것 방지.
  // 평문 그대로 저장하지 말고 향후 SHA-256/HMAC 해시로 마이그레이션 권장. 현 단계는 구조만 잡아둠.
  ci: text("ci"),
  // ===== Kakao OAuth (메인 로그인 수단) =====
  // kakaoId: Kakao 사용자 고유 ID(숫자). 같은 사용자 재로그인 시 lookup 키.
  kakaoId: text("kakao_id"),
  // email: Kakao account_email scope에서 받은 이메일. 사용자 동의 시에만 채워짐.
  email: text("email"),
  // profileImageUrl: Kakao 프로필 이미지. 카카오톡 프로필 변경시 자동 반영되지 않음 — 로그인 때마다 갱신.
  profileImageUrl: text("profile_image_url"),
  nickname: text("nickname"),
  nicknameUpdatedAt: timestamp("nickname_updated_at"),
  badges: jsonb("badges").default([]).notNull(),
  postCount: integer("post_count").default(0).notNull(),
  favorites: jsonb("favorites").default([]).notNull(),
  favoriteRegions: jsonb("favorite_regions").default([]).notNull(),
  // 약관/개인정보처리방침 동의 시점
  tosAcceptedAt: timestamp("tos_accepted_at"),
  privacyAcceptedAt: timestamp("privacy_accepted_at"),
  // 회원 탈퇴 시각 — soft delete. 데이터 비식별화 후 30일 보존.
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  phoneHashIdx: uniqueIndex("users_phone_hash_uniq").on(table.phoneHash),
  // 본인확인 CI는 1인 1계정 보장용. NULL은 인덱스 대상에서 자연 제외되므로 미인증 사용자 공존 가능.
  ciUniqIdx: uniqueIndex("users_ci_uniq").on(table.ci),
  // Kakao 사용자 재로그인용 lookup 키. NULL은 비-Kakao 계정.
  kakaoIdUniq: uniqueIndex("users_kakao_id_uniq").on(table.kakaoId),
  ageGroupIdx: index("users_age_group_idx").on(table.ageGroup),
}));

// ===== 의원 팔로우 (Story 피드 & 개인화 타임라인) =====
// politicianId는 국회의원의 monaCd 또는 후보자 ID. 외부 데이터까지 포괄하려고 FK 대신 text.
export const userFollows = pgTable("user_follows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  politicianId: text("politician_id").notNull(),
  politicianType: text("politician_type").default("member").notNull(), // "member" | "candidate"
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userPoliticianUniq: uniqueIndex("user_follows_user_politician_uniq").on(table.userId, table.politicianId),
  userIdx: index("user_follows_user_idx").on(table.userId),
  politicianIdx: index("user_follows_politician_idx").on(table.politicianId),
}));

export type UserFollow = typeof userFollows.$inferSelect;

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

const CURRENT_YEAR = new Date().getFullYear();
export const registerSchema = z.object({
  username: z.string().min(3, "아이디는 3자 이상이어야 합니다").max(32),
  password: z
    .string()
    .min(10, "비밀번호는 10자 이상이어야 합니다")
    .max(128)
    .regex(/[A-Za-z]/, "영문을 포함해야 합니다")
    .regex(/[0-9]/, "숫자를 포함해야 합니다"),
  name: z.string().min(2, "이름은 2자 이상이어야 합니다").max(20),
  phone: z.string().regex(/^01[016789]-?\d{3,4}-?\d{4}$/, "올바른 휴대폰 번호를 입력하세요"),
  verificationCode: z.string().length(6, "인증번호 6자리를 입력하세요"),
  // 만 14세 미만 가입 차단(개인정보보호법 §22-2)
  birthYear: z
    .number()
    .int()
    .min(1900)
    .max(CURRENT_YEAR)
    .refine((y) => CURRENT_YEAR - y >= 14, "만 14세 이상만 가입할 수 있습니다"),
  agreeTos: z.boolean().refine((v) => v === true, "이용약관에 동의해야 합니다"),
  agreePrivacy: z.boolean().refine((v) => v === true, "개인정보처리방침에 동의해야 합니다"),
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
  // 선관위 22대 총선 데이터 (재산/학력/전과/경력)
  propertyAmount?: string | null;   // 재산 신고액 (예: "12억 3,456만원")
  education?: string | null;        // 최종 학력
  criminalRecord?: string | null;   // 전과 상세 (null이면 전과 없음으로 표시)
  criminalCount?: number | null;    // 전과 건수
  career?: string | null;           // 주요 경력
  // SNS / 연락처
  homepage?: string | null;
  email?: string | null;
  twitter?: string | null;
  facebook?: string | null;
  youtube?: string | null;
  blog?: string | null;
  // 공직자윤리위원회 재산 상세 (단위: 만원)
  propertyLand?: number | null;
  propertyBuilding?: number | null;
  propertyDeposit?: number | null;
  propertyStock?: number | null;
  propertyDebt?: number | null;
  propertyDetailSyncedAt?: string | null;
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
  education?: string;
  career?: string;
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
  legislatorId: varchar("legislator_id"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  anonNickname: text("anon_nickname").notNull(),
  boardType: text("board_type").default("open").notNull(),
  category: text("category").default("자유").notNull(),
  showRealName: boolean("show_real_name").default(false).notNull(),
  authorType: text("author_type").default("anonymous").notNull(),
  displayName: text("display_name"),
  isVerified: boolean("is_verified").default(false).notNull(),
  viewCount: integer("view_count").default(0).notNull(),
  reportCount: integer("report_count").default(0).notNull(),
  likes: integer("likes").default(0).notNull(),
  dislikes: integer("dislikes").default(0).notNull(),
  agreeCount: integer("agree_count").default(0).notNull(),
  disagreeCount: integer("disagree_count").default(0).notNull(),
  contentType: text("content_type").default("text").notNull(),
  attachments: jsonb("attachments"),
  thumbnailUrl: text("thumbnail_url"),
  tagType: text("tag_type"),
  tagId: text("tag_id"),
  tagName: text("tag_name"),
  // 모더레이션 — 신고로 임시조치된 글은 hiddenAt 설정 후 24시간 내 관리자 검토
  hiddenAt: timestamp("hidden_at"),
  // soft delete
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  boardCreatedIdx: index("posts_board_created_idx").on(table.boardType, table.createdAt),
  tagIdx: index("posts_tag_idx").on(table.tagType, table.tagId),
  userIdx: index("posts_user_idx").on(table.userId),
  createdIdx: index("posts_created_idx").on(table.createdAt),
}));

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
  authorType: text("author_type").default("anonymous").notNull(),
  displayName: text("display_name"),
  isVerified: boolean("is_verified").default(false).notNull(),
  hiddenAt: timestamp("hidden_at"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  postIdx: index("comments_post_idx").on(table.postId, table.createdAt),
  userIdx: index("comments_user_idx").on(table.userId),
}));

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
  boardType: z.enum(["open", "members", "free", "legislators", "bills", "candidate"]).default("free"),
  category: z.enum(["자유", "토론", "정보공유", "질문"]).default("자유"),
  showRealName: z.boolean().default(false),
  legislatorId: z.string().optional(),
  authorType: z.enum(["anonymous", "nickname", "realname"]).default("anonymous"),
  attachments: z.array(z.any()).optional(),
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
  // 선관위 22대 총선 데이터 (재산/학력/전과)
  propertyAmount: text("property_amount"),       // 재산 신고액 (문자열, 단위: 만원)
  education: text("education"),                  // 최종 학력
  criminalRecord: text("criminal_record"),       // 전과 상세 내용 (없으면 null)
  criminalCount: integer("criminal_count"),      // 전과 건수
  career: text("career"),                        // 주요 경력 (줄바꿈 구분)
  necDetailSyncedAt: timestamp("nec_detail_synced_at"), // 선관위 데이터 마지막 동기화 시각
  // 국회 API 추가 정보
  telNo: text("tel_no"),                           // 사무실 전화
  email: text("email"),                            // 이메일
  homepage: text("homepage"),                      // 홈페이지 (분류 후 저장)
  twitter: text("twitter"),                        // 트위터/X URL
  facebook: text("facebook"),                      // 페이스북 URL
  youtube: text("youtube"),                        // 유튜브 채널 URL
  blog: text("blog"),                              // 블로그 URL
  instagram: text("instagram"),                    // 인스타그램 URL
  birthDate: text("birth_date"),                   // 생년월일 (YYYY-MM-DD)
  gender: text("gender"),                          // 성별
  reelectionGbn: text("reelection_gbn"),           // 선수 (초선/재선/삼선 등)
  committees: text("committees"),                  // 소속 위원회 전체 (쉼표 구분)
  memTitle: text("mem_title"),                     // 의원 경력/이력 원문
  assemblyAddr: text("assembly_addr"),             // 의원실 주소
  // 공직자윤리위원회 재산 상세 (단위: 만원)
  propertyLand: integer("property_land"),
  propertyBuilding: integer("property_building"),
  propertyDeposit: integer("property_deposit"),
  propertyStock: integer("property_stock"),
  propertyDebt: integer("property_debt"),
  propertyDetailSyncedAt: timestamp("property_detail_synced_at"),
  // 트렌딩 점수 산정용 (Trending Score = follower*20 + profileView*1 + recentNews*5)
  followerCount: integer("follower_count").default(0).notNull(),
  profileViewCount: integer("profile_view_count").default(0).notNull(),
  recentNewsCount: integer("recent_news_count").default(0).notNull(),
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
  viewCount: integer("view_count").default(0).notNull(),
  voteCount: integer("vote_count").default(0).notNull(),
  newsMentionCount: integer("news_mention_count").default(0).notNull(),
  coProposerCount: integer("co_proposer_count").default(0).notNull(),
  mediaMentionCount: integer("media_mention_count").default(0).notNull(),
  category: text("category").default("일반").notNull(),
  passedDate: text("passed_date"),
  effectiveDate: text("effective_date"),
  aiDescription: text("ai_description"),
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
  legislatorIdx: index("votes_legislator_idx").on(table.legislatorId),
  billIdx: index("votes_bill_idx").on(table.billId),
}));

export type Legislator = typeof legislators.$inferSelect;
export type AssemblyBill = typeof assemblyBills.$inferSelect;
export type AssemblyVote = typeof assemblyVotes.$inferSelect;

// ===== 선거 후보자 =====
export const electionCandidates = pgTable("election_candidates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  electionType: text("election_type").notNull(),   // mayor | district | metro-council 등
  regionCode: text("region_code").notNull(),        // 시/도 코드 (raw sdName 사본)
  districtName: text("district_name").notNull(),    // 선거구명 (예: 마포구)
  name: text("name").notNull(),
  hanjaName: text("hanja_name"),                    // 한자 성명 (API: hanjaName)
  party: text("party").notNull(),
  photo: text("photo"),
  age: integer("age"),                              // 만 나이 (birthday 기반 계산)
  job: text("job"),                                 // 현직 (API: job)
  career: text("career"),                           // career1 + career2 결합 (백워드 호환)
  career1: text("career1"),                         // 주요 경력 1 (API: career1)
  career2: text("career2"),                         // 주요 경력 2 (API: career2)
  pledges: jsonb("pledges").default([]),            // 공약 목록
  edu: text("edu"),                                  // 학력 (API: edu)
  criminal: text("criminal"),                       // 전과기록 (legacy text 필드, 호환 유지)
  criminalRecords: jsonb("criminal_records").default([]).notNull(), // 전과기록 (신규 JSONB; 선관위 API 미제공으로 기본 [])
  status: text("status").notNull().default("예비후보"), // 라이프사이클 라벨: 예비후보 | 후보자
  candidateStatus: text("candidate_status"),        // API 등록 상태: 등록 | 사퇴 | 등록무효 등
  birthday: text("birthday"),                       // 생년월일 YYYYMMDD (API: birthday)
  gender: text("gender"),                           // 성별 (API: gender)
  sdName: text("sd_name"),                          // 시/도명 원본 (API: sdName)
  sggName: text("sgg_name"),                        // 선거구명 원본 (API: sggName)
  wiwName: text("wiw_name"),                        // 구/시/군명 원본 (API: wiwName)
  // NOTE: source_id UNIQUE 제약은 push 시 자동 적용하면 drizzle-kit이 기존 데이터 truncate를 제안함.
  // 별도 SQL로 dedup 후 수동 적용 예정. 코드 상 upsert는 source_id 기준으로 동작.
  sourceId: text("source_id"),                      // 선관위 API 후보 ID (huboid) — Deep Sync upsert 키
  matchKey: text("match_key"),                      // 이름_생년월일_선거구 조합 (외부 CSV 매칭용)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ===== 후보 발언/행보 =====
export const candidateStatements = pgTable("candidate_statements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  candidateId: varchar("candidate_id").notNull().references(() => electionCandidates.id),
  type: text("type").notNull(),  // "speech" | "action" | "pledge" | "controversy"
  title: text("title").notNull(),
  content: text("content").notNull(),
  source: text("source"),        // 출처 언론사 or URL
  occurredAt: timestamp("occurred_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ===== 발언 팩트체크 투표 =====
export const statementFactChecks = pgTable("statement_fact_checks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  statementId: varchar("statement_id").notNull().references(() => candidateStatements.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  verdict: text("verdict").notNull(),  // "true" | "false" | "misleading"
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniq: uniqueIndex("fact_check_user_stmt").on(t.userId, t.statementId),
}));

// ===== 후보 지지율 투표 =====
export const candidateSupportVotes = pgTable("candidate_support_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  candidateId: varchar("candidate_id").notNull().references(() => electionCandidates.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  districtName: text("district_name").notNull(),  // 중복 방지용 (같은 선거구 내 1표)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniq: uniqueIndex("support_vote_user_district").on(t.userId, t.districtName),
}));

// ===== 선거 이슈 토론 =====
export const electionIssues = pgTable("election_issues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),          // "연금 개혁 어떻게 해야 하나?"
  description: text("description"),
  candidateAId: varchar("candidate_a_id").references(() => electionCandidates.id),
  candidateBId: varchar("candidate_b_id").references(() => electionCandidates.id),
  candidateAStance: text("candidate_a_stance"),  // A후보 입장 요약
  candidateBStance: text("candidate_b_stance"),  // B후보 입장 요약
  regionCode: text("region_code"),
  districtName: text("district_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ===== 통합 반응 (post/comment/poll) =====
export const reactions = pgTable("reactions", {
  id: serial("id").primaryKey(),
  targetType: text("target_type").notNull(),   // 'post' | 'comment' | 'poll'
  targetId: text("target_id").notNull(),
  userId: integer("user_id"),                  // null = 비로그인
  sessionId: text("session_id"),               // 비로그인 중복방지용
  type: text("type").notNull(),                // 'like' | 'dislike' | 'funny' | 'sad' | 'angry'
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userTargetUniq: uniqueIndex("reaction_user_target_uniq").on(table.targetType, table.targetId, table.userId),
  sessionTargetUniq: uniqueIndex("reaction_session_target_uniq").on(table.targetType, table.targetId, table.sessionId),
}));

export type Reaction = typeof reactions.$inferSelect;

// ===== 투표 댓글 =====
export const pollComments = pgTable("poll_comments", {
  id: serial("id").primaryKey(),
  pollId: text("poll_id").notNull(),
  // users.id가 varchar(UUID)이므로 integer가 아니라 varchar여야 한다.
  // 이전 integer 정의 때문에 parseInt(uuid)=NaN → PG insert 실패 = 댓글 500. 반드시 db:push 필요.
  userId: varchar("user_id"),                   // null = 비로그인
  content: text("content").notNull(),
  authorType: text("author_type").default("anonymous").notNull(),
  displayName: text("display_name"),
  isVerified: boolean("is_verified").default(false).notNull(),
  parentId: integer("parent_id"),               // 대댓글 (parent의 serial id 참조)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  pollIdx: index("poll_comments_poll_idx").on(table.pollId, table.createdAt),
  userIdx: index("poll_comments_user_idx").on(table.userId),
}));

export type PollComment = typeof pollComments.$inferSelect;

// ===== 공약 별점 평가 =====
export const pledgeRatings = pgTable("pledge_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  candidateId: varchar("candidate_id").notNull().references(() => electionCandidates.id),
  pledgeId: varchar("pledge_id").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniq: uniqueIndex("pledge_rating_user_uniq").on(t.candidateId, t.pledgeId, t.userId),
}));

export type PledgeRating = typeof pledgeRatings.$inferSelect;

export const candidateRatings = pgTable("candidate_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  candidateId: varchar("candidate_id").notNull(), // Can be from mock or electionCandidates, so we just use varchar
  userId: varchar("user_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniq: uniqueIndex("candidate_rating_user_uniq").on(t.candidateId, t.userId),
}));

export type CandidateRating = typeof candidateRatings.$inferSelect;

// ===== 공약 의견 (댓글) =====
export const pledgeComments = pgTable("pledge_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  candidateId: varchar("candidate_id").notNull().references(() => electionCandidates.id),
  pledgeId: varchar("pledge_id").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  anonNickname: text("anon_nickname").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PledgeComment = typeof pledgeComments.$inferSelect;

export const insertPledgeCommentSchema = createInsertSchema(pledgeComments).pick({
  content: true,
});
export type InsertPledgeComment = z.infer<typeof insertPledgeCommentSchema>;

// ===== 시민 법안 찬반 의견 투표 =====
export const billOpinionVotes = pgTable("bill_opinion_votes", {
  id: serial("id").primaryKey(),
  billId: text("bill_id").notNull(),
  userId: text("user_id"),           // 로그인한 경우 userId
  sessionId: text("session_id"),     // 비로그인 중복방지
  opinion: text("opinion").notNull(), // 'agree' | 'disagree'
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userBillUniq: uniqueIndex("bill_opinion_user_uniq").on(table.billId, table.userId),
  sessionBillUniq: uniqueIndex("bill_opinion_session_uniq").on(table.billId, table.sessionId),
}));

export type BillOpinionVote = typeof billOpinionVotes.$inferSelect;

// ===== 여론조사 결과 (nesdc.go.kr 크롤링) =====
export const pollResults = pgTable("poll_results", {
  id: serial("id").primaryKey(),
  regionCode: text("region_code").notNull(),       // 지역 코드 (서울특별시 등)
  districtName: text("district_name").notNull(),   // 선거구명 (서울시장 등)
  electionType: text("election_type").notNull(),   // 시도지사/구시군의장 등
  surveyOrg: text("survey_org").notNull(),         // 조사기관명
  commissioner: text("commissioner").notNull(),    // 의뢰기관
  surveyDate: text("survey_date").notNull(),       // 조사기간 (예: 2026.04.28~04.29)
  publishedDate: text("published_date").notNull(), // 공표일
  sampleSize: integer("sample_size"),              // 표본 크기
  candidates: jsonb("candidates").notNull(),       // [{name, party, rate}]
  sourceUrl: text("source_url"),                   // 출처 URL
  scrapedAt: timestamp("scraped_at").defaultNow().notNull(),
});

export type PollResult = typeof pollResults.$inferSelect;

// ===== 검색 히스토리 =====
export const searchHistory = pgTable("search_history", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),         // 로그인 사용자 ID (없으면 null)
  sessionId: text("session_id"),   // 비로그인 세션 식별자
  query: text("query").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SearchHistory = typeof searchHistory.$inferSelect;

// ===== 정치인 사진 URL DB 캐시 (서버 재시작 후에도 유지) =====
export const politicianPhotoCache = pgTable("politician_photo_cache", {
  name: text("name").primaryKey(),   // 정치인 이름 (키)
  photoUrl: text("photo_url"),       // null이면 사진 없음 확인된 것
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});

export type PoliticianPhotoCache = typeof politicianPhotoCache.$inferSelect;
