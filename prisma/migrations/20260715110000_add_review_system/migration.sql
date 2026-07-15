CREATE TYPE "ReviewTaskStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED', 'CANCELLED');
CREATE TYPE "ReviewSelfRating" AS ENUM ('AGAIN', 'HARD', 'GOOD', 'EASY');

CREATE TABLE "review_tasks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "cycle" INTEGER NOT NULL,
    "due_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "ReviewTaskStatus" NOT NULL DEFAULT 'PENDING',
    "interval_days" INTEGER NOT NULL DEFAULT 1,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "review_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "review_attempts" (
    "id" UUID NOT NULL,
    "review_task_id" UUID NOT NULL,
    "user_answer" VARCHAR(200),
    "is_correct" BOOLEAN,
    "self_rating" "ReviewSelfRating" NOT NULL,
    "duration_seconds" INTEGER,
    "next_review_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "review_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_mastery" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "knowledge_point_id" UUID NOT NULL,
    "mastery_score" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "correct_review_count" INTEGER NOT NULL DEFAULT 0,
    "incorrect_review_count" INTEGER NOT NULL DEFAULT 0,
    "last_reviewed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "user_mastery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "review_tasks_question_id_cycle_key" ON "review_tasks"("question_id", "cycle");
CREATE INDEX "review_tasks_user_id_status_due_at_idx" ON "review_tasks"("user_id", "status", "due_at");
CREATE INDEX "review_tasks_question_id_status_idx" ON "review_tasks"("question_id", "status");
CREATE UNIQUE INDEX "review_attempts_review_task_id_key" ON "review_attempts"("review_task_id");
CREATE UNIQUE INDEX "user_mastery_user_id_knowledge_point_id_key" ON "user_mastery"("user_id", "knowledge_point_id");
CREATE INDEX "user_mastery_knowledge_point_id_mastery_score_idx" ON "user_mastery"("knowledge_point_id", "mastery_score");

ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "review_attempts" ADD CONSTRAINT "review_attempts_review_task_id_fkey" FOREIGN KEY ("review_task_id") REFERENCES "review_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_mastery" ADD CONSTRAINT "user_mastery_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_mastery" ADD CONSTRAINT "user_mastery_knowledge_point_id_fkey" FOREIGN KEY ("knowledge_point_id") REFERENCES "knowledge_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
