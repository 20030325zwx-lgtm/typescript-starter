-- CreateEnum
CREATE TYPE "KnowledgePointStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "AnalysisJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "questions" ADD COLUMN "content_revision" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "knowledge_points" (
    "id" UUID NOT NULL,
    "exam_id" UUID NOT NULL,
    "parent_id" UUID,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "level" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "KnowledgePointStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "knowledge_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "question_revision" INTEGER NOT NULL,
    "workflow_version" VARCHAR(64) NOT NULL,
    "idempotency_key" VARCHAR(64) NOT NULL,
    "status" "AnalysisJobStatus" NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_code" VARCHAR(64),
    "error_message_safe" VARCHAR(500),
    "dify_workflow_run_id" VARCHAR(128),
    "queued_at" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "analysis_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analyses" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "workflow_version" VARCHAR(64) NOT NULL,
    "prompt_version" VARCHAR(64) NOT NULL,
    "model_name" VARCHAR(100) NOT NULL,
    "schema_version" VARCHAR(32) NOT NULL,
    "knowledge_base_version" VARCHAR(64),
    "raw_output_json" JSONB NOT NULL,
    "validated_output_json" JSONB NOT NULL,
    "error_type" VARCHAR(64) NOT NULL,
    "error_reason" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "memory_tip" TEXT,
    "confidence" DECIMAL(5,4) NOT NULL,
    "answer_confidence" DECIMAL(5,4) NOT NULL,
    "needs_manual_review" BOOLEAN NOT NULL DEFAULT false,
    "user_corrected" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_knowledge_points" (
    "question_id" UUID NOT NULL,
    "knowledge_point_id" UUID NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,
    "is_user_confirmed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "question_knowledge_points_pkey" PRIMARY KEY ("question_id", "knowledge_point_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_points_exam_id_code_key" ON "knowledge_points"("exam_id", "code");
CREATE INDEX "knowledge_points_exam_id_status_sort_order_idx" ON "knowledge_points"("exam_id", "status", "sort_order");
CREATE INDEX "knowledge_points_parent_id_sort_order_idx" ON "knowledge_points"("parent_id", "sort_order");
CREATE UNIQUE INDEX "analysis_jobs_idempotency_key_key" ON "analysis_jobs"("idempotency_key");
CREATE INDEX "analysis_jobs_user_id_created_at_idx" ON "analysis_jobs"("user_id", "created_at" DESC);
CREATE INDEX "analysis_jobs_status_queued_at_idx" ON "analysis_jobs"("status", "queued_at");
CREATE INDEX "analysis_jobs_question_id_status_idx" ON "analysis_jobs"("question_id", "status");
CREATE UNIQUE INDEX "analyses_job_id_key" ON "analyses"("job_id");
CREATE INDEX "analyses_question_id_created_at_idx" ON "analyses"("question_id", "created_at" DESC);
CREATE INDEX "question_knowledge_points_knowledge_point_id_idx" ON "question_knowledge_points"("knowledge_point_id");

-- AddForeignKey
ALTER TABLE "knowledge_points" ADD CONSTRAINT "knowledge_points_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_points" ADD CONSTRAINT "knowledge_points_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "knowledge_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "analysis_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_knowledge_points" ADD CONSTRAINT "question_knowledge_points_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_knowledge_points" ADD CONSTRAINT "question_knowledge_points_knowledge_point_id_fkey" FOREIGN KEY ("knowledge_point_id") REFERENCES "knowledge_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the stable judgment-reasoning knowledge-point tree.
INSERT INTO "knowledge_points" ("id", "exam_id", "parent_id", "code", "name", "level", "sort_order", "status", "created_at", "updated_at") VALUES
('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', NULL, 'judgment_reasoning', '判断推理', 1, 30, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'logic_strengthen', '加强论证', 2, 10, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'logic_weaken', '削弱论证', 2, 20, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'logic_assumption', '前提假设', 2, 30, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'logic_conclusion', '结论推导', 2, 40, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'definition_judgment', '定义判断', 2, 50, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('10000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'analogy_reasoning', '类比推理', 2, 60, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('10000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'graphic_reasoning', '图形推理', 2, 70, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('10000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'event_ordering', '事件排序', 2, 80, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
