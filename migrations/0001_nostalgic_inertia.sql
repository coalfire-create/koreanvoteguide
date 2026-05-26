CREATE TABLE "ai_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"cache_key" text NOT NULL,
	"feature" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "ai_cache_cache_key_unique" UNIQUE("cache_key")
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_opinion_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_id" text NOT NULL,
	"user_id" text,
	"session_id" text,
	"opinion" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_ratings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"rating" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_poll_votes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"option_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_polls" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "daily_polls_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "election_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"event_date" timestamp NOT NULL,
	"description" text,
	"region" text DEFAULT '전국' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pledge_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" varchar NOT NULL,
	"pledge_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"content" text NOT NULL,
	"anon_nickname" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pledge_ratings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" varchar NOT NULL,
	"pledge_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"rating" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "politician_photo_cache" (
	"name" text PRIMARY KEY NOT NULL,
	"photo_url" text,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll_id" text NOT NULL,
	"user_id" varchar,
	"content" text NOT NULL,
	"author_type" text DEFAULT 'anonymous' NOT NULL,
	"display_name" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"parent_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"region_code" text NOT NULL,
	"district_name" text NOT NULL,
	"election_type" text NOT NULL,
	"survey_org" text NOT NULL,
	"commissioner" text NOT NULL,
	"survey_date" text NOT NULL,
	"published_date" text NOT NULL,
	"sample_size" integer,
	"candidates" jsonb NOT NULL,
	"source_url" text,
	"scraped_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"user_id" integer,
	"session_id" text,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"session_id" text,
	"query" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_follows" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"politician_id" text NOT NULL,
	"politician_type" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assembly_bills" ADD COLUMN "view_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "assembly_bills" ADD COLUMN "vote_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "assembly_bills" ADD COLUMN "news_mention_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "assembly_bills" ADD COLUMN "co_proposer_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "assembly_bills" ADD COLUMN "media_mention_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "assembly_bills" ADD COLUMN "category" text DEFAULT '일반' NOT NULL;--> statement-breakpoint
ALTER TABLE "assembly_bills" ADD COLUMN "passed_date" text;--> statement-breakpoint
ALTER TABLE "assembly_bills" ADD COLUMN "effective_date" text;--> statement-breakpoint
ALTER TABLE "assembly_bills" ADD COLUMN "ai_description" text;--> statement-breakpoint
ALTER TABLE "community_comments" ADD COLUMN "parent_id" varchar;--> statement-breakpoint
ALTER TABLE "community_comments" ADD COLUMN "hidden_at" timestamp;--> statement-breakpoint
ALTER TABLE "community_comments" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "community_posts" ADD COLUMN "content_type" text DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE "community_posts" ADD COLUMN "attachments" jsonb;--> statement-breakpoint
ALTER TABLE "community_posts" ADD COLUMN "thumbnail_url" text;--> statement-breakpoint
ALTER TABLE "community_posts" ADD COLUMN "tag_type" text;--> statement-breakpoint
ALTER TABLE "community_posts" ADD COLUMN "tag_id" text;--> statement-breakpoint
ALTER TABLE "community_posts" ADD COLUMN "tag_name" text;--> statement-breakpoint
ALTER TABLE "community_posts" ADD COLUMN "has_poll" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "community_posts" ADD COLUMN "hidden_at" timestamp;--> statement-breakpoint
ALTER TABLE "community_posts" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "election_candidates" ADD COLUMN "hanja_name" text;--> statement-breakpoint
ALTER TABLE "election_candidates" ADD COLUMN "career1" text;--> statement-breakpoint
ALTER TABLE "election_candidates" ADD COLUMN "career2" text;--> statement-breakpoint
ALTER TABLE "election_candidates" ADD COLUMN "edu" text;--> statement-breakpoint
ALTER TABLE "election_candidates" ADD COLUMN "criminal" text;--> statement-breakpoint
ALTER TABLE "election_candidates" ADD COLUMN "criminal_records" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "election_candidates" ADD COLUMN "property_amount" text;--> statement-breakpoint
ALTER TABLE "election_candidates" ADD COLUMN "military_service" text;--> statement-breakpoint
ALTER TABLE "election_candidates" ADD COLUMN "tax_paid" text;--> statement-breakpoint
ALTER TABLE "election_candidates" ADD COLUMN "tax_arrears" text;--> statement-breakpoint
ALTER TABLE "election_candidates" ADD COLUMN "candidacy_history" text;--> statement-breakpoint
ALTER TABLE "election_candidates" ADD COLUMN "verification_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "election_candidates" ADD COLUMN "status" text DEFAULT '예비후보' NOT NULL;--> statement-breakpoint
ALTER TABLE "election_candidates" ADD COLUMN "candidate_status" text;--> statement-breakpoint
ALTER TABLE "election_candidates" ADD COLUMN "birthday" text;--> statement-breakpoint
ALTER TABLE "election_candidates" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "election_candidates" ADD COLUMN "sd_name" text;--> statement-breakpoint
ALTER TABLE "election_candidates" ADD COLUMN "sgg_name" text;--> statement-breakpoint
ALTER TABLE "election_candidates" ADD COLUMN "wiw_name" text;--> statement-breakpoint
ALTER TABLE "election_candidates" ADD COLUMN "match_key" text;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "property_amount" text;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "education" text;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "criminal_record" text;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "criminal_count" integer;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "career" text;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "nec_detail_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "tel_no" text;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "homepage" text;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "twitter" text;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "facebook" text;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "youtube" text;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "blog" text;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "instagram" text;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "birth_date" text;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "reelection_gbn" text;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "committees" text;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "mem_title" text;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "assembly_addr" text;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "property_land" integer;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "property_building" integer;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "property_deposit" integer;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "property_stock" integer;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "property_debt" integer;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "property_detail_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "follower_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "profile_view_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "legislators" ADD COLUMN "recent_news_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "real_name_provider" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "birth_year" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "birth_date" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "age_group" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ci" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kakao_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "apple_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_image_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tos_accepted_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "privacy_accepted_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "exp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "attendance_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_attendance_date" text;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_ratings" ADD CONSTRAINT "candidate_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_poll_votes" ADD CONSTRAINT "daily_poll_votes_poll_id_daily_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."daily_polls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_poll_votes" ADD CONSTRAINT "daily_poll_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pledge_comments" ADD CONSTRAINT "pledge_comments_candidate_id_election_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."election_candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pledge_ratings" ADD CONSTRAINT "pledge_ratings_candidate_id_election_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."election_candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pledge_ratings" ADD CONSTRAINT "pledge_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_cache_key_uniq" ON "ai_cache" USING btree ("cache_key");--> statement-breakpoint
CREATE INDEX "ai_cache_expires_idx" ON "ai_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "announcements_active_idx" ON "announcements" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "announcements_created_at_idx" ON "announcements" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bill_opinion_user_uniq" ON "bill_opinion_votes" USING btree ("bill_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bill_opinion_session_uniq" ON "bill_opinion_votes" USING btree ("bill_id","session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_rating_user_uniq" ON "candidate_ratings" USING btree ("candidate_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_poll_user_uniq" ON "daily_poll_votes" USING btree ("user_id","poll_id");--> statement-breakpoint
CREATE INDEX "schedules_region_date_idx" ON "election_schedules" USING btree ("region","event_date");--> statement-breakpoint
CREATE UNIQUE INDEX "pledge_rating_user_uniq" ON "pledge_ratings" USING btree ("candidate_id","pledge_id","user_id");--> statement-breakpoint
CREATE INDEX "poll_comments_poll_idx" ON "poll_comments" USING btree ("poll_id","created_at");--> statement-breakpoint
CREATE INDEX "poll_comments_user_idx" ON "poll_comments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reaction_user_target_uniq" ON "reactions" USING btree ("target_type","target_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reaction_session_target_uniq" ON "reactions" USING btree ("target_type","target_id","session_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "session" USING btree ("expire");--> statement-breakpoint
CREATE UNIQUE INDEX "user_follows_user_politician_uniq" ON "user_follows" USING btree ("user_id","politician_id");--> statement-breakpoint
CREATE INDEX "user_follows_user_idx" ON "user_follows" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_follows_politician_idx" ON "user_follows" USING btree ("politician_id");--> statement-breakpoint
CREATE INDEX "bills_propose_date_idx" ON "assembly_bills" USING btree ("propose_date");--> statement-breakpoint
CREATE INDEX "bills_result_idx" ON "assembly_bills" USING btree ("result");--> statement-breakpoint
CREATE INDEX "votes_legislator_idx" ON "assembly_votes" USING btree ("legislator_id");--> statement-breakpoint
CREATE INDEX "votes_bill_idx" ON "assembly_votes" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "votes_synced_idx" ON "assembly_votes" USING btree ("synced_at");--> statement-breakpoint
CREATE INDEX "comments_post_idx" ON "community_comments" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_user_idx" ON "community_comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "posts_board_created_idx" ON "community_posts" USING btree ("board_type","created_at");--> statement-breakpoint
CREATE INDEX "posts_tag_idx" ON "community_posts" USING btree ("tag_type","tag_id");--> statement-breakpoint
CREATE INDEX "posts_user_idx" ON "community_posts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "posts_created_idx" ON "community_posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cand_region_type_idx" ON "election_candidates" USING btree ("region_code","election_type");--> statement-breakpoint
CREATE INDEX "cand_sdname_idx" ON "election_candidates" USING btree ("sd_name");--> statement-breakpoint
CREATE INDEX "cand_name_idx" ON "election_candidates" USING btree ("name");--> statement-breakpoint
CREATE INDEX "cand_district_idx" ON "election_candidates" USING btree ("region_code","district_name");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_hash_uniq" ON "users" USING btree ("phone_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "users_ci_uniq" ON "users" USING btree ("ci");--> statement-breakpoint
CREATE UNIQUE INDEX "users_kakao_id_uniq" ON "users" USING btree ("kakao_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_google_id_uniq" ON "users" USING btree ("google_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_apple_id_uniq" ON "users" USING btree ("apple_id");--> statement-breakpoint
CREATE INDEX "users_age_group_idx" ON "users" USING btree ("age_group");