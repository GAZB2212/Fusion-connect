CREATE TABLE "blocked_users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocker_id" varchar NOT NULL,
	"blocked_id" varchar NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "call_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"call_id" varchar(50) NOT NULL,
	"channel_name" varchar(100) NOT NULL,
	"caller_user_id" varchar NOT NULL,
	"callee_user_id" varchar NOT NULL,
	"call_type" varchar(10) NOT NULL,
	"status" varchar(20) DEFAULT 'ringing' NOT NULL,
	"started_at" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "call_sessions_call_id_unique" UNIQUE("call_id")
);
--> statement-breakpoint
CREATE TABLE "chaperones" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"chaperone_name" varchar(100) NOT NULL,
	"chaperone_email" varchar(255) NOT NULL,
	"relationship_type" varchar(50),
	"access_type" varchar(20) DEFAULT 'live',
	"sendbird_user_id" varchar(255),
	"access_token" varchar(255),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "early_signups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"first_name" varchar,
	"promo_code" varchar NOT NULL,
	"position" integer NOT NULL,
	"used" boolean DEFAULT false,
	"used_by" varchar,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "early_signups_email_unique" UNIQUE("email"),
	CONSTRAINT "early_signups_promo_code_unique" UNIQUE("promo_code")
);
--> statement-breakpoint
CREATE TABLE "for_you_matches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"matched_user_id" varchar NOT NULL,
	"compatibility_score" integer NOT NULL,
	"match_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"shown_at" timestamp DEFAULT now(),
	"user_action" varchar(20),
	"action_at" timestamp,
	"for_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user1_id" varchar NOT NULL,
	"user2_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"receiver_id" varchar NOT NULL,
	"content" text NOT NULL,
	"message_type" varchar(20) DEFAULT 'text',
	"call_duration" integer,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "onboarding_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"conversation_log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"extracted_data" jsonb DEFAULT '{}'::jsonb,
	"current_question" integer DEFAULT 1,
	"language" varchar(5) DEFAULT 'en',
	"completed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"age" integer NOT NULL,
	"gender" varchar(20) NOT NULL,
	"location" varchar(200) NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"bio" text,
	"height" integer,
	"height_unit" varchar(10) DEFAULT 'cm',
	"photos" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"main_photo_index" integer DEFAULT 0,
	"photo_visibility" varchar(20) DEFAULT 'visible',
	"photo_verified" boolean DEFAULT false,
	"intro_video_url" varchar(500),
	"born_muslim" boolean,
	"sect" varchar(50),
	"prayer_frequency" varchar(30),
	"halal_importance" varchar(30),
	"religiosity" varchar(30),
	"religious_practice" varchar(50),
	"looking_for" varchar(50) NOT NULL,
	"marital_status" varchar(30),
	"has_children" boolean DEFAULT false,
	"wants_children" varchar(30),
	"education" varchar(100),
	"occupation" varchar(100),
	"profession" varchar(100),
	"languages" text[] DEFAULT ARRAY[]::text[],
	"interests" text[] DEFAULT ARRAY[]::text[],
	"personality_traits" text[] DEFAULT ARRAY[]::text[],
	"ethnicities" text[] DEFAULT ARRAY[]::text[],
	"partner_preferences" jsonb,
	"is_verified" boolean DEFAULT false,
	"verification_photo" varchar,
	"use_nickname" boolean DEFAULT false,
	"phone_number" varchar,
	"phone_verified" boolean DEFAULT false,
	"face_verified" boolean DEFAULT false,
	"is_complete" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"last_active" timestamp DEFAULT now(),
	"onboarding_method" varchar(20),
	"marriage_intent" varchar(30),
	"marriage_timeframe" varchar(50),
	"religiosity_raw" text,
	"wali_involvement" varchar(30),
	"deal_breakers" text,
	"communication_style" varchar(100),
	"profile_prompts" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"endpoint" text NOT NULL,
	"auth" text NOT NULL,
	"p256dh" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar(10) NOT NULL,
	"token" text NOT NULL,
	"endpoint" text,
	"auth" text,
	"p256dh" text,
	"device_id" varchar(100),
	"platform" varchar(10),
	"environment" varchar(20) DEFAULT 'production',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "swipes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"swiper_id" varchar NOT NULL,
	"swiped_id" varchar NOT NULL,
	"direction" varchar(10) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_feedback" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"category" varchar(50) NOT NULL,
	"rating" integer,
	"message" text NOT NULL,
	"status" varchar(20) DEFAULT 'new',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_match_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"preference_weights" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"liked_traits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"passed_traits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_match_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" varchar NOT NULL,
	"reported_id" varchar NOT NULL,
	"reason" varchar(50) NOT NULL,
	"details" text,
	"status" varchar(20) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"password" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"stripe_customer_id" varchar,
	"stripe_subscription_id" varchar,
	"subscription_status" varchar,
	"subscription_ends_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "video_calls" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" varchar NOT NULL,
	"caller_id" varchar NOT NULL,
	"receiver_id" varchar NOT NULL,
	"channel_name" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'initiated' NOT NULL,
	"started_at" timestamp,
	"ended_at" timestamp,
	"duration" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_caller_user_id_users_id_fk" FOREIGN KEY ("caller_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_callee_user_id_users_id_fk" FOREIGN KEY ("callee_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chaperones" ADD CONSTRAINT "chaperones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "early_signups" ADD CONSTRAINT "early_signups_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "for_you_matches" ADD CONSTRAINT "for_you_matches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "for_you_matches" ADD CONSTRAINT "for_you_matches_matched_user_id_users_id_fk" FOREIGN KEY ("matched_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_user1_id_users_id_fk" FOREIGN KEY ("user1_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_user2_id_users_id_fk" FOREIGN KEY ("user2_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_conversations" ADD CONSTRAINT "onboarding_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipes" ADD CONSTRAINT "swipes_swiper_id_users_id_fk" FOREIGN KEY ("swiper_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipes" ADD CONSTRAINT "swipes_swiped_id_users_id_fk" FOREIGN KEY ("swiped_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_match_preferences" ADD CONSTRAINT "user_match_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reported_id_users_id_fk" FOREIGN KEY ("reported_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_calls" ADD CONSTRAINT "video_calls_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_calls" ADD CONSTRAINT "video_calls_caller_id_users_id_fk" FOREIGN KEY ("caller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_calls" ADD CONSTRAINT "video_calls_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blocker_idx" ON "blocked_users" USING btree ("blocker_id");--> statement-breakpoint
CREATE INDEX "blocked_idx" ON "blocked_users" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX "call_caller_idx" ON "call_sessions" USING btree ("caller_user_id");--> statement-breakpoint
CREATE INDEX "call_callee_idx" ON "call_sessions" USING btree ("callee_user_id");--> statement-breakpoint
CREATE INDEX "call_id_idx" ON "call_sessions" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "call_status_idx" ON "call_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_chaperone_idx" ON "chaperones" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chaperone_access_token_idx" ON "chaperones" USING btree ("access_token");--> statement-breakpoint
CREATE INDEX "fym_user_idx" ON "for_you_matches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fym_matched_user_idx" ON "for_you_matches" USING btree ("matched_user_id");--> statement-breakpoint
CREATE INDEX "fym_for_date_idx" ON "for_you_matches" USING btree ("for_date");--> statement-breakpoint
CREATE INDEX "user1_idx" ON "matches" USING btree ("user1_id");--> statement-breakpoint
CREATE INDEX "user2_idx" ON "matches" USING btree ("user2_id");--> statement-breakpoint
CREATE INDEX "match_idx" ON "messages" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "sender_idx" ON "messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "user_onboarding_idx" ON "onboarding_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "token_idx" ON "password_reset_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "user_reset_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_push_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_push_token_idx" ON "push_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "token_type_idx" ON "push_tokens" USING btree ("type");--> statement-breakpoint
CREATE INDEX "token_unique_idx" ON "push_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "swiper_idx" ON "swipes" USING btree ("swiper_id");--> statement-breakpoint
CREATE INDEX "swiped_idx" ON "swipes" USING btree ("swiped_id");--> statement-breakpoint
CREATE INDEX "ump_user_idx" ON "user_match_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reporter_idx" ON "user_reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "reported_idx" ON "user_reports" USING btree ("reported_id");--> statement-breakpoint
CREATE INDEX "status_idx" ON "user_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "match_call_idx" ON "video_calls" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "caller_call_idx" ON "video_calls" USING btree ("caller_id");--> statement-breakpoint
CREATE INDEX "receiver_call_idx" ON "video_calls" USING btree ("receiver_id");