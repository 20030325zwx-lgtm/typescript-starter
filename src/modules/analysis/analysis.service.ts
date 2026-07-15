import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalysisJobStatus, Prisma, QuestionStatus } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { ApiException } from '../../common/exceptions/api.exception';
import { PrismaService } from '../../database/prisma.service';
import { KnowledgePointsService } from '../knowledge-points/knowledge-points.service';
import { ReviewsService } from '../reviews/reviews.service';
import type { AnalysisOutput } from './analysis-output.types';
import type { ConfirmAnalysisDto } from './dto/confirm-analysis.dto';
import type {
  AnalysisJobResponseDto,
  AnalysisResponseDto,
  CreateAnalysisJobResponseDto,
} from './dto/analysis-response.dto';
import {
  ANALYSIS_QUEUE,
  type AnalysisQueue,
} from './queue/analysis-queue.interface';

@Injectable()
export class AnalysisService {
  private readonly workflowVersion: string;
  private readonly idempotencySecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly knowledgePoints: KnowledgePointsService,
    @Inject(ANALYSIS_QUEUE) private readonly queue: AnalysisQueue,
    private readonly reviews: ReviewsService,
  ) {
    this.workflowVersion = config.getOrThrow<string>(
      'DIFY_ANALYSIS_WORKFLOW_VERSION',
    );
    this.idempotencySecret = config.getOrThrow<string>(
      'ANALYSIS_IDEMPOTENCY_SECRET',
    );
  }

  async createJob(
    userId: string,
    questionId: string,
  ): Promise<CreateAnalysisJobResponseDto> {
    const question = await this.prisma.question.findFirst({
      where: {
        id: questionId,
        userId,
        status: { not: QuestionStatus.DELETED },
      },
      select: { id: true, contentRevision: true },
    });
    if (!question) throw this.questionNotFound();

    const idempotencyKey = createHmac('sha256', this.idempotencySecret)
      .update(
        `${userId}:${question.id}:${question.contentRevision}:${this.workflowVersion}`,
      )
      .digest('hex');
    let job = await this.prisma.analysisJob.findUnique({
      where: { idempotencyKey },
    });
    if (!job) {
      try {
        job = await this.prisma.$transaction(async (tx) => {
          const created = await tx.analysisJob.create({
            data: {
              userId,
              questionId,
              questionRevision: question.contentRevision,
              workflowVersion: this.workflowVersion,
              idempotencyKey,
            },
          });
          const updated = await tx.question.updateMany({
            where: {
              id: questionId,
              userId,
              contentRevision: question.contentRevision,
              status: { not: QuestionStatus.DELETED },
            },
            data: { status: QuestionStatus.ANALYSIS_PENDING },
          });
          if (updated.count !== 1) throw this.questionNotFound();
          return created;
        });
      } catch (error: unknown) {
        if (!this.isUniqueConstraintError(error)) throw error;
        job = await this.prisma.analysisJob.findUnique({
          where: { idempotencyKey },
        });
        if (!job) throw error;
      }
    }

    if (job.status === AnalysisJobStatus.PENDING && !job.queuedAt) {
      try {
        await this.queue.enqueue(job.id);
        job = await this.prisma.analysisJob.update({
          where: { id: job.id },
          data: { queuedAt: new Date() },
        });
      } catch {
        throw new ApiException(
          'QUEUE_DELIVERY_FAILED',
          '分析任务已保存，正在等待系统恢复后处理',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    }
    return { jobId: job.id, status: job.status, pollAfterMs: 1500 };
  }

  async getJob(userId: string, jobId: string): Promise<AnalysisJobResponseDto> {
    const job = await this.prisma.analysisJob.findFirst({
      where: { id: jobId, userId },
    });
    if (!job) {
      throw new ApiException(
        'ANALYSIS_JOB_NOT_FOUND',
        '分析任务不存在',
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      id: job.id,
      questionId: job.questionId,
      status: job.status,
      retryCount: job.retryCount,
      errorCode: job.errorCode,
      errorMessage: job.errorMessageSafe,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      createdAt: job.createdAt,
    };
  }

  async getAnalysis(
    userId: string,
    questionId: string,
  ): Promise<AnalysisResponseDto> {
    const question = await this.prisma.question.findFirst({
      where: {
        id: questionId,
        userId,
        status: { not: QuestionStatus.DELETED },
      },
      include: {
        analyses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { job: { select: { questionRevision: true } } },
        },
        knowledgePoints: {
          include: { knowledgePoint: true },
          orderBy: { confidence: 'desc' },
        },
      },
    });
    if (!question) throw this.questionNotFound();
    const analysis = question.analyses[0];
    if (
      !analysis ||
      analysis.job.questionRevision !== question.contentRevision
    ) {
      throw new ApiException(
        'ANALYSIS_NOT_FOUND',
        '该错题尚无可用分析结果',
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      id: analysis.id,
      questionId,
      workflowVersion: analysis.workflowVersion,
      schemaVersion: analysis.schemaVersion,
      errorType: analysis.errorType,
      errorReason: analysis.errorReason,
      explanation: analysis.explanation,
      memoryTip: analysis.memoryTip,
      confidence: analysis.confidence.toNumber(),
      answerConfidence: analysis.answerConfidence.toNumber(),
      needsManualReview: analysis.needsManualReview,
      userCorrected: analysis.userCorrected,
      confirmedAt: analysis.confirmedAt,
      result: analysis.validatedOutputJson as Record<string, unknown>,
      knowledgePoints: question.knowledgePoints.map((item) => ({
        code: item.knowledgePoint.code,
        name: item.knowledgePoint.name,
        confidence: item.confidence.toNumber(),
        isUserConfirmed: item.isUserConfirmed,
      })),
    };
  }

  async confirm(
    userId: string,
    questionId: string,
    dto: ConfirmAnalysisDto,
  ): Promise<AnalysisResponseDto> {
    const question = await this.prisma.question.findFirst({
      where: {
        id: questionId,
        userId,
        status: { not: QuestionStatus.DELETED },
      },
      include: {
        analyses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { job: { select: { questionRevision: true } } },
        },
        knowledgePoints: { include: { knowledgePoint: true } },
      },
    });
    if (!question) throw this.questionNotFound();
    const analysis = question.analyses[0];
    if (
      !analysis ||
      analysis.job.questionRevision !== question.contentRevision
    ) {
      throw new ApiException(
        'ANALYSIS_NOT_FOUND',
        '该错题尚无可确认的分析结果',
        HttpStatus.NOT_FOUND,
      );
    }

    const knowledgeCodes = dto.knowledgePointCodes
      ? [...new Set(dto.knowledgePointCodes)]
      : undefined;
    const points = knowledgeCodes
      ? await this.knowledgePoints.requireActiveCodes(
          question.examId,
          knowledgeCodes,
        )
      : undefined;
    if (knowledgeCodes && !points) {
      throw new ApiException(
        'KNOWLEDGE_POINT_INVALID',
        '包含无效或已停用的知识点',
        HttpStatus.BAD_REQUEST,
      );
    }

    const existingCodes = question.knowledgePoints
      .map(({ knowledgePoint }) => knowledgePoint.code)
      .sort();
    const corrected =
      (dto.questionText !== undefined &&
        dto.questionText !== question.questionText) ||
      (dto.options !== undefined &&
        JSON.stringify(dto.options) !== JSON.stringify(question.optionsJson)) ||
      (dto.questionType !== undefined &&
        dto.questionType !== question.questionType) ||
      (dto.correctAnswer !== undefined &&
        dto.correctAnswer !== question.correctAnswer) ||
      (dto.errorType !== undefined && dto.errorType !== analysis.errorType) ||
      (dto.errorReason !== undefined &&
        dto.errorReason !== analysis.errorReason) ||
      (knowledgeCodes !== undefined &&
        JSON.stringify([...knowledgeCodes].sort()) !==
          JSON.stringify(existingCodes));
    const correctedOutput = structuredClone(
      analysis.validatedOutputJson,
    ) as unknown as AnalysisOutput;
    if (dto.questionText !== undefined) {
      correctedOutput.question.text = dto.questionText;
    }
    if (dto.options !== undefined) {
      correctedOutput.question.options = dto.options;
    }
    if (dto.questionType !== undefined) {
      correctedOutput.question.type_code = dto.questionType;
    }
    if (dto.correctAnswer !== undefined) {
      correctedOutput.question.correct_answer = dto.correctAnswer;
    }
    if (dto.errorType !== undefined) {
      correctedOutput.diagnosis.error_type =
        dto.errorType as AnalysisOutput['diagnosis']['error_type'];
    }
    if (dto.errorReason !== undefined) {
      correctedOutput.diagnosis.reason = dto.errorReason;
    }
    if (knowledgeCodes !== undefined) {
      correctedOutput.knowledge_points = knowledgeCodes.map((code) => ({
        code,
        confidence: 1,
      }));
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.question.update({
        where: { id: questionId },
        data: {
          ...(dto.questionText !== undefined
            ? { questionText: dto.questionText }
            : {}),
          ...(dto.options !== undefined
            ? {
                optionsJson: dto.options as unknown as Prisma.InputJsonValue,
              }
            : {}),
          ...(dto.questionType !== undefined
            ? { questionType: dto.questionType }
            : {}),
          ...(dto.correctAnswer !== undefined
            ? { correctAnswer: dto.correctAnswer }
            : {}),
          status: QuestionStatus.CONFIRMED,
        },
      });
      await tx.analysis.update({
        where: { id: analysis.id },
        data: {
          ...(dto.errorType !== undefined ? { errorType: dto.errorType } : {}),
          ...(dto.errorReason !== undefined
            ? { errorReason: dto.errorReason }
            : {}),
          validatedOutputJson:
            correctedOutput as unknown as Prisma.InputJsonValue,
          userCorrected: analysis.userCorrected || corrected,
          confirmedAt: new Date(),
        },
      });
      if (knowledgeCodes && points) {
        await tx.questionKnowledgePoint.deleteMany({ where: { questionId } });
        await tx.questionKnowledgePoint.createMany({
          data: points.map((point) => ({
            questionId,
            knowledgePointId: point.id,
            confidence: 1,
            isUserConfirmed: true,
          })),
        });
      } else {
        await tx.questionKnowledgePoint.updateMany({
          where: { questionId },
          data: { isUserConfirmed: true },
        });
      }
      await this.reviews.scheduleInitial(tx, userId, questionId);
    });

    return this.getAnalysis(userId, questionId);
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private questionNotFound(): ApiException {
    return new ApiException(
      'QUESTION_NOT_FOUND',
      '错题不存在',
      HttpStatus.NOT_FOUND,
    );
  }
}
