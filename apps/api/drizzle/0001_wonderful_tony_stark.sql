ALTER TABLE "subscribers" ADD COLUMN "previous_secret_encrypted" text;--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "previous_secret_expires_at" timestamp with time zone;