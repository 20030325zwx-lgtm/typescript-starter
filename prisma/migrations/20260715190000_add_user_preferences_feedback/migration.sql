-- User profile, exam goal and review reminder preferences.
ALTER TABLE "users"
ADD COLUMN "exam_target_name" VARCHAR(100),
ADD COLUMN "exam_date" TIMESTAMPTZ(3),
ADD COLUMN "reminder_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reminder_time" VARCHAR(5);

CREATE TYPE "FeedbackStatus" AS ENUM ('PENDING', 'RESOLVED');

CREATE TABLE "feedback" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category" VARCHAR(32) NOT NULL,
    "content" TEXT NOT NULL,
    "contact" VARCHAR(100),
    "status" "FeedbackStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "feedback_status_created_at_idx" ON "feedback"("status", "created_at" DESC);
CREATE INDEX "feedback_user_id_created_at_idx" ON "feedback"("user_id", "created_at" DESC);

ALTER TABLE "feedback"
ADD CONSTRAINT "feedback_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
