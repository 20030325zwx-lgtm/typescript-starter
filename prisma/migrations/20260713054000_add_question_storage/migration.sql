-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM (
    'DRAFT',
    'ANALYSIS_PENDING',
    'ANALYZING',
    'ANALYSIS_FAILED',
    'ANALYSIS_SUCCEEDED',
    'CONFIRMED',
    'DELETED'
);

-- CreateTable
CREATE TABLE "exams" (
    "id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "status" "ExamStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "exam_id" UUID NOT NULL,
    "client_request_id" UUID NOT NULL,
    "image_object_key" VARCHAR(512) NOT NULL,
    "image_mime_type" VARCHAR(64) NOT NULL,
    "image_size_bytes" INTEGER NOT NULL,
    "image_width" INTEGER NOT NULL,
    "image_height" INTEGER NOT NULL,
    "source" VARCHAR(200),
    "note" VARCHAR(200),
    "question_type" VARCHAR(64),
    "question_text" TEXT,
    "options_json" JSONB,
    "user_answer" VARCHAR(20),
    "correct_answer" VARCHAR(20),
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "image_deletion_pending" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- SeedData
INSERT INTO "exams" (
    "id",
    "code",
    "name",
    "status",
    "created_at",
    "updated_at"
) VALUES (
    '00000000-0000-4000-8000-000000000001',
    'exam_civil_service',
    '公务员行测',
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "exams_code_key" ON "exams"("code");

-- CreateIndex
CREATE UNIQUE INDEX "questions_image_object_key_key" ON "questions"("image_object_key");

-- CreateIndex
CREATE UNIQUE INDEX "questions_user_id_client_request_id_key" ON "questions"("user_id", "client_request_id");

-- CreateIndex
CREATE INDEX "questions_user_id_status_created_at_idx" ON "questions"("user_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "questions_exam_id_question_type_idx" ON "questions"("exam_id", "question_type");

-- CreateIndex
CREATE INDEX "questions_image_deletion_pending_deleted_at_idx" ON "questions"("image_deletion_pending", "deleted_at");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
