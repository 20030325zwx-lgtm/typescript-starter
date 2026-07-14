import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalysisJobStatus, Prisma, QuestionStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { KnowledgePointsService } from '../knowledge-points/knowledge-points.service';
import {
  OBJECT_STORAGE,
  type ObjectStorageService,
} from '../storage/object-storage.interface';
import { AnalysisExecutionError } from './analysis-execution.error';
import { AnalysisResultValidatorService } from './analysis-result-validator.service';
import {
  DIFY_ANALYSIS_CLIENT,
  type DifyAnalysisClient,
} from './dify/dify-analysis-client.interface';

@Injectable()
export class AnalysisJobRunnerService {
  private readonly workflowVersion: string;
  private readonly promptVersion: string;
  private readonly modelName: string;
  private readonly schemaVersion: string;
  private readonly knowledgeBaseVersion: string | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly knowledgePoints: KnowledgePointsService,
    private readonly validator: AnalysisResultValidatorService,
    @Inject(OBJECT_STORAGE)
    private readonly objectStorage: ObjectStorageService,
    @Inject(DIFY_ANALYSIS_CLIENT)
    private readonly difyClient: DifyAnalysisClient,
  ) {
    this.workflowVersion = config.getOrThrow<string>(
      'DIFY_ANALYSIS_WORKFLOW_VERSION',
    );
    this.promptVersion = config.getOrThrow<string>(
      'DIFY_ANALYSIS_PROMPT_VERSION',
    );
    this.modelName = config.getOrThrow<string>('DIFY_ANALYSIS_MODEL_NAME');
    this.schemaVersion = config.get<string>(
      'DIFY_ANALYSIS_SCHEMA_VERSION',
      '1.0',
    );
    this.knowledgeBaseVersion =
      config.get<string>('DIFY_KNOWLEDGE_BASE_VERSION', '') || null;
  }

  async execute(
    analysisJobId: string,
    attemptNumber: number,
    maxAttempts: number,
  ): Promise<void> {
    const existing = await this.prisma.analysisJob.findUnique({
      where: { id: analysisJobId },
      select: { status: true },
    });
    if (
      !existing ||
      existing.status === AnalysisJobStatus.SUCCEEDED ||
      existing.status === AnalysisJobStatus.CANCELLED
    ) {
      return;
    }

    const claimed = await this.prisma.analysisJob.updateMany({
      where: { id: analysisJobId, status: AnalysisJobStatus.PENDING },
      data: {
        status: AnalysisJobStatus.RUNNING,
        retryCount: attemptNumber,
        startedAt: new Date(),
        finishedAt: null,
        errorCode: null,
        errorMessageSafe: null,
      },
    });
    if (claimed.count !== 1) return;

    try {
      await this.runClaimed(analysisJobId);
    } catch (error: unknown) {
      const failure = this.normalizeError(error);
      if (
        failure.code === 'QUESTION_DELETED' ||
        failure.code === 'QUESTION_REVISION_CHANGED'
      ) {
        await this.markCancelled(analysisJobId, failure);
        return;
      }
      const willRetry = failure.retryable && attemptNumber < maxAttempts;
      await this.markFailedAttempt(
        analysisJobId,
        failure,
        willRetry,
        attemptNumber,
      );
      if (willRetry) throw failure;
    }
  }

  private async runClaimed(analysisJobId: string): Promise<void> {
    const job = await this.prisma.analysisJob.findUnique({
      where: { id: analysisJobId },
      include: { question: true },
    });
    if (!job) return;
    if (
      job.question.status === QuestionStatus.DELETED ||
      job.question.deletedAt
    ) {
      throw this.cancelled('QUESTION_DELETED', '错题已删除，分析任务已取消');
    }
    if (job.question.contentRevision !== job.questionRevision) {
      throw this.cancelled(
        'QUESTION_REVISION_CHANGED',
        '错题内容已更新，旧分析任务已取消',
      );
    }

    const candidates = await this.knowledgePoints.listActiveCandidates(
      job.question.examId,
    );
    if (candidates.length === 0) {
      throw new AnalysisExecutionError(
        'KNOWLEDGE_POINTS_UNAVAILABLE',
        '知识点配置暂不可用',
        false,
      );
    }

    let imageUrl: string;
    try {
      imageUrl = await this.objectStorage.createPresignedGetUrl(
        job.question.imageObjectKey,
      );
    } catch (error: unknown) {
      throw new AnalysisExecutionError(
        'STORAGE_URL_UNAVAILABLE',
        '题目图片暂时无法读取',
        true,
        { cause: error },
      );
    }

    const result = await this.difyClient.run({
      userId: job.userId,
      imageUrl,
      userAnswer: job.question.userAnswer,
      correctAnswer: job.question.correctAnswer,
      source: job.question.source,
      note: job.question.note,
      knowledgePointCandidates: candidates.map(
        ({ code, name, parentCode }) => ({ code, name, parentCode }),
      ),
      schemaVersion: this.schemaVersion,
    });
    const output = this.validator.validate(result.output, {
      schemaVersion: this.schemaVersion,
      userAnswer: job.question.userAnswer,
      candidateCodes: new Set(candidates.map(({ code }) => code)),
    });
    const candidateByCode = new Map(
      candidates.map((candidate) => [candidate.code, candidate]),
    );

    await this.prisma.$transaction(async (tx) => {
      const currentQuestion = await tx.question.findUnique({
        where: { id: job.questionId },
        select: { contentRevision: true, status: true, deletedAt: true },
      });
      if (!currentQuestion || currentQuestion.deletedAt) {
        throw this.cancelled('QUESTION_DELETED', '错题已删除，分析任务已取消');
      }
      if (currentQuestion.contentRevision !== job.questionRevision) {
        throw this.cancelled(
          'QUESTION_REVISION_CHANGED',
          '错题内容已更新，旧分析任务已取消',
        );
      }

      await tx.analysis.upsert({
        where: { jobId: job.id },
        create: {
          jobId: job.id,
          questionId: job.questionId,
          workflowVersion: job.workflowVersion,
          promptVersion: this.promptVersion,
          modelName: this.modelName,
          schemaVersion: output.schema_version,
          knowledgeBaseVersion: this.knowledgeBaseVersion,
          rawOutputJson: result.rawOutputs as Prisma.InputJsonValue,
          validatedOutputJson: output as unknown as Prisma.InputJsonValue,
          errorType: output.diagnosis.error_type,
          errorReason: output.diagnosis.reason,
          explanation: [output.solution.summary, ...output.solution.steps].join(
            '\n\n',
          ),
          memoryTip: output.solution.memory_tip || null,
          confidence: output.diagnosis.confidence,
          answerConfidence: output.safety.answer_confidence,
          needsManualReview: output.safety.needs_manual_review,
        },
        update: {},
      });
      await tx.questionKnowledgePoint.deleteMany({
        where: { questionId: job.questionId },
      });
      await tx.questionKnowledgePoint.createMany({
        data: output.knowledge_points.map((point) => ({
          questionId: job.questionId,
          knowledgePointId: candidateByCode.get(point.code).id,
          confidence: point.confidence,
        })),
      });
      await tx.question.update({
        where: { id: job.questionId },
        data: {
          questionType: output.question.type_code,
          questionText: output.question.text,
          optionsJson: output.question
            .options as unknown as Prisma.InputJsonValue,
          correctAnswer: output.question.correct_answer || null,
          status: QuestionStatus.ANALYSIS_SUCCEEDED,
        },
      });
      await tx.analysisJob.update({
        where: { id: job.id },
        data: {
          status: AnalysisJobStatus.SUCCEEDED,
          difyWorkflowRunId: result.runId,
          finishedAt: new Date(),
          errorCode: null,
          errorMessageSafe: null,
        },
      });
    });
  }

  private async markFailedAttempt(
    jobId: string,
    error: AnalysisExecutionError,
    willRetry: boolean,
    attemptNumber: number,
  ): Promise<void> {
    const status = willRetry
      ? AnalysisJobStatus.PENDING
      : AnalysisJobStatus.FAILED;
    const questionStatus = willRetry
      ? QuestionStatus.ANALYSIS_PENDING
      : QuestionStatus.ANALYSIS_FAILED;
    await this.prisma.$transaction([
      this.prisma.analysisJob.updateMany({
        where: { id: jobId, status: AnalysisJobStatus.RUNNING },
        data: {
          status,
          retryCount: attemptNumber,
          errorCode: error.code,
          errorMessageSafe: error.safeMessage,
          finishedAt: willRetry ? null : new Date(),
        },
      }),
      this.prisma.question.updateMany({
        where: {
          analysisJobs: { some: { id: jobId } },
          status: { not: QuestionStatus.DELETED },
        },
        data: { status: questionStatus },
      }),
    ]);
  }

  private async markCancelled(
    jobId: string,
    error: AnalysisExecutionError,
  ): Promise<void> {
    await this.prisma.analysisJob.updateMany({
      where: { id: jobId, status: AnalysisJobStatus.RUNNING },
      data: {
        status: AnalysisJobStatus.CANCELLED,
        errorCode: error.code,
        errorMessageSafe: error.safeMessage,
        finishedAt: new Date(),
      },
    });
  }

  private normalizeError(error: unknown): AnalysisExecutionError {
    if (error instanceof AnalysisExecutionError) return error;
    return new AnalysisExecutionError(
      'ANALYSIS_INTERNAL_ERROR',
      '分析任务暂时失败，请稍后重试',
      true,
      { cause: error },
    );
  }

  private cancelled(code: string, message: string): AnalysisExecutionError {
    return new AnalysisExecutionError(code, message, false);
  }
}
