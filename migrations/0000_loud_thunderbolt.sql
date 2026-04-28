CREATE TABLE "assembly_bills" (
	"bill_id" text PRIMARY KEY NOT NULL,
	"bill_no" text DEFAULT '' NOT NULL,
	"bill_name" text NOT NULL,
	"proposer" text DEFAULT '' NOT NULL,
	"propose_date" text DEFAULT '' NOT NULL,
	"result" text DEFAULT '' NOT NULL,
	"committee" text DEFAULT '' NOT NULL,
	"yes_count" integer DEFAULT 0 NOT NULL,
	"no_count" integer DEFAULT 0 NOT NULL,
	"abstain_count" integer DEFAULT 0 NOT NULL,
	"econ_score" real,
	"social_score" real,
	"env_score" real,
	"welfare_score" real,
	"justice_score" real,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assembly_data_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assembly_votes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" text NOT NULL,
	"legislator_id" text NOT NULL,
	"legislator_name" text NOT NULL,
	"party" text DEFAULT '' NOT NULL,
	"vote_result" text NOT NULL,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_statements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" varchar NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"source" text,
	"occurred_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_support_votes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"district_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_bookmarks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"content" text NOT NULL,
	"anon_nickname" text NOT NULL,
	"author_type" text DEFAULT 'anonymous' NOT NULL,
	"display_name" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_posts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"legislator_id" varchar,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"anon_nickname" text NOT NULL,
	"board_type" text DEFAULT 'open' NOT NULL,
	"category" text DEFAULT '자유' NOT NULL,
	"show_real_name" boolean DEFAULT false NOT NULL,
	"author_type" text DEFAULT 'anonymous' NOT NULL,
	"display_name" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"report_count" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"dislikes" integer DEFAULT 0 NOT NULL,
	"agree_count" integer DEFAULT 0 NOT NULL,
	"disagree_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_reactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"dimension" text DEFAULT 'sentiment' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" varchar,
	"comment_id" varchar,
	"user_id" varchar NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "election_candidates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"election_type" text NOT NULL,
	"region_code" text NOT NULL,
	"district_name" text NOT NULL,
	"name" text NOT NULL,
	"party" text NOT NULL,
	"photo" text,
	"age" integer,
	"job" text,
	"career" text,
	"pledges" jsonb DEFAULT '[]'::jsonb,
	"source_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "election_issues" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"candidate_a_id" varchar,
	"candidate_b_id" varchar,
	"candidate_a_stance" text,
	"candidate_b_stance" text,
	"region_code" text,
	"district_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legislators" (
	"mona_cd" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"party" text NOT NULL,
	"district" text NOT NULL,
	"photo_url" text DEFAULT '' NOT NULL,
	"committee" text DEFAULT '' NOT NULL,
	"elected_term" integer DEFAULT 22 NOT NULL,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduler_status" (
	"id" varchar PRIMARY KEY DEFAULT 'main' NOT NULL,
	"last_run" timestamp,
	"success" boolean,
	"error_message" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statement_fact_checks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"statement_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"verdict" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"vote_verified" boolean DEFAULT false NOT NULL,
	"real_name_verified" boolean DEFAULT false NOT NULL,
	"real_name" text,
	"nickname" text,
	"nickname_updated_at" timestamp,
	"badges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"post_count" integer DEFAULT 0 NOT NULL,
	"favorites" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"favorite_regions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verification_codes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "candidate_statements" ADD CONSTRAINT "candidate_statements_candidate_id_election_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."election_candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_support_votes" ADD CONSTRAINT "candidate_support_votes_candidate_id_election_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."election_candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_support_votes" ADD CONSTRAINT "candidate_support_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_issues" ADD CONSTRAINT "election_issues_candidate_a_id_election_candidates_id_fk" FOREIGN KEY ("candidate_a_id") REFERENCES "public"."election_candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_issues" ADD CONSTRAINT "election_issues_candidate_b_id_election_candidates_id_fk" FOREIGN KEY ("candidate_b_id") REFERENCES "public"."election_candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_fact_checks" ADD CONSTRAINT "statement_fact_checks_statement_id_candidate_statements_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."candidate_statements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_fact_checks" ADD CONSTRAINT "statement_fact_checks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bill_legislator_uniq" ON "assembly_votes" USING btree ("bill_id","legislator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "support_vote_user_district" ON "candidate_support_votes" USING btree ("user_id","district_name");--> statement-breakpoint
CREATE UNIQUE INDEX "bookmark_user_post_uniq" ON "community_bookmarks" USING btree ("user_id","post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fact_check_user_stmt" ON "statement_fact_checks" USING btree ("user_id","statement_id");