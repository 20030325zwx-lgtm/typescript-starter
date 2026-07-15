import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  Prisma,
  QuestionStatus,
  ReviewSelfRating,
  ReviewTaskStatus,
} from '@prisma/client';
import { ApiException } from '../../common/exceptions/api.exception';
import { PrismaService } from '../../database/prisma.service';
import {
  OBJECT_STORAGE,
  type ObjectStorageService,
} from '../storage/object-storage.interface';
import type {
  ReviewAttemptResponseDto,
  ReviewTaskResponseDto,
  TodayReviewsResponseDto,
} from './dto/review-response.dto';
import type { SubmitReviewAttemptDto } from './dto/submit-review-attempt.dto';
import { ReviewSchedulerService } from './review-scheduler.service';

const taskInclude = {
  question: {
    include: {
      knowledgePoints: {
        include: { knowledgePoint: true },
        orderBy: { confidence: 'desc' as const },
      },
    },
  },
} satisfies Prisma.ReviewTaskInclude;

type ReviewTaskWithQuestion = Prisma.ReviewTaskGetPayload<{
  include: typeof taskInclude;
}>;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: ReviewSchedulerService,
    @Inject(OBJECT_STORAGE)
    private readonly objectStorage: ObjectStorageService,
  ) {}

  scheduleInitial(
    transaction: Prisma.TransactionClient,
    userId: string,
    questionId: string,
    now = new Date(),
  ): Promise<unknown> {
    return transaction.reviewTask.upsert({
      where: { questionId_cycle: { questionId, cycle: 1 } },
      update: {},
      create: {
        userId,
        questionId,
        cycle: 1,
        dueAt: this.nextShanghaiDayStart(now),
        intervalDays: 1,
      },
    });
  }

  async getToday(userId: string): Promise<TodayReviewsResponseDto> {
    const now = new Date();
    const { start, end } = this.shanghaiDayRange(now);
    const [tasks, completedToday] = await this.prisma.$transaction([
      this.prisma.reviewTask.findMany({
        where: {
          userId,
          status: ReviewTaskStatus.PENDING,
          dueAt: { lte: end },
          question: {
            status: QuestionStatus.CONFIRMED,
            deletedAt: null,
          },
        },
        include: taskInclude,
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.reviewTask.count({
        where: {
          userId,
          status: {
            in: [ReviewTaskStatus.COMPLETED, ReviewTaskStatus.SKIPPED],
          },
          completedAt: { gte: start, lte: end },
        },
      }),
    ]);

    return {
      summary: {
        pending: tasks.length,
        completedToday,
        estimatedMinutes: Math.ceil(tasks.length * 1.5),
      },
      items: await Promise.all(tasks.map((task) => this.toResponse(task))),
    };
  }

  async getById(
    userId: string,
    taskId: string,
  ): Promise<ReviewTaskResponseDto> {
    const task = await this.prisma.reviewTask.findFirst({
      where: {
        id: taskId,
        userId,
        question: { status: { not: QuestionStatus.DELETED } },
      },
      include: taskInclude,
    });
    if (!task) throw this.notFound();
    return this.toResponse(task);
  }

  async submit(
    userId: string,
    taskId: string,
    dto: SubmitReviewAttemptDto,
  ): Promise<ReviewAttemptResponseDto> {
    const task = await this.findPendingTask(userId, taskId);
    const userAnswer = dto.userAnswer?.trim() || null;
    const isCorrect = this.compareAnswer(
      userAnswer,
      task.question.correctAnswer,
    );
    const schedule = this.scheduler.calculate(
      task.intervalDays,
      dto.selfRating,
      isCorrect,
    );
    const now = new Date();
    const nextReviewAt = this.addDays(now, schedule.intervalDays);

    const nextTask = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.reviewTask.updateMany({
        where: {
          id: taskId,
          userId,
          status: ReviewTaskStatus.PENDING,
        },
        data: {
          status: ReviewTaskStatus.COMPLETED,
          completedAt: now,
        },
      });
      if (claimed.count !== 1) throw this.alreadyHandled();

      await tx.reviewAttempt.create({
        data: {
          reviewTaskId: taskId,
          userAnswer,
          isCorrect,
          selfRating: schedule.effectiveRating,
          durationSeconds: dto.durationSeconds,
          nextReviewAt,
        },
      });
      const created = await tx.reviewTask.create({
        data: {
          userId,
          questionId: task.questionId,
          cycle: task.cycle + 1,
          dueAt: nextReviewAt,
          intervalDays: schedule.intervalDays,
        },
      });
      await this.updateMastery(
        tx,
        userId,
        task.question.knowledgePoints.map(
          ({ knowledgePointId }) => knowledgePointId,
        ),
        schedule.masteryDelta,
        isCorrect,
        now,
      );
      return created;
    });

    return {
      taskId,
      isCorrect,
      effectiveRating: schedule.effectiveRating,
      masteryDelta: schedule.masteryDelta,
      nextReviewAt,
      nextTaskId: nextTask.id,
    };
  }

  async skip(
    userId: string,
    taskId: string,
  ): Promise<ReviewAttemptResponseDto> {
    const task = await this.findPendingTask(userId, taskId);
    const now = new Date();
    const nextReviewAt = this.addDays(now, 1);
    const nextTask = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.reviewTask.updateMany({
        where: {
          id: taskId,
          userId,
          status: ReviewTaskStatus.PENDING,
        },
        data: {
          status: ReviewTaskStatus.SKIPPED,
          completedAt: now,
        },
      });
      if (claimed.count !== 1) throw this.alreadyHandled();

      return tx.reviewTask.create({
        data: {
          userId,
          questionId: task.questionId,
          cycle: task.cycle + 1,
          dueAt: nextReviewAt,
          intervalDays: 1,
        },
      });
    });

    return {
      taskId,
      isCorrect: null,
      effectiveRating: ReviewSelfRating.AGAIN,
      masteryDelta: 0,
      nextReviewAt,
      nextTaskId: nextTask.id,
    };
  }

  private findPendingTask(
    userId: string,
    taskId: string,
  ): Promise<ReviewTaskWithQuestion> {
    return this.prisma.reviewTask
      .findFirst({
        where: {
          id: taskId,
          userId,
          status: ReviewTaskStatus.PENDING,
          question: {
            status: QuestionStatus.CONFIRMED,
            deletedAt: null,
          },
        },
        include: taskInclude,
      })
      .then((task) => {
        if (!task) throw this.notFound();
        return task;
      });
  }

  private async updateMastery(
    tx: Prisma.TransactionClient,
    userId: string,
    knowledgePointIds: string[],
    delta: number,
    isCorrect: boolean | null,
    now: Date,
  ): Promise<void> {
    for (const knowledgePointId of knowledgePointIds) {
      const current = await tx.userMastery.findUnique({
        where: { userId_knowledgePointId: { userId, knowledgePointId } },
      });
      const score = Math.min(
        100,
        Math.max(0, (current?.masteryScore.toNumber() ?? 0) + delta),
      );
      await tx.userMastery.upsert({
        where: { userId_knowledgePointId: { userId, knowledgePointId } },
        update: {
          masteryScore: score,
          reviewCount: { increment: 1 },
          ...(isCorrect === true
            ? { correctReviewCount: { increment: 1 } }
            : isCorrect === false
              ? { incorrectReviewCount: { increment: 1 } }
              : {}),
          lastReviewedAt: now,
        },
        create: {
          userId,
          knowledgePointId,
          masteryScore: score,
          reviewCount: 1,
          correctReviewCount: isCorrect === true ? 1 : 0,
          incorrectReviewCount: isCorrect === false ? 1 : 0,
          lastReviewedAt: now,
        },
      });
    }
  }

  private async toResponse(
    task: ReviewTaskWithQuestion,
  ): Promise<ReviewTaskResponseDto> {
    return {
      id: task.id,
      cycle: task.cycle,
      dueAt: task.dueAt,
      status: task.status,
      intervalDays: task.intervalDays,
      question: {
        id: task.question.id,
        imageUrl: await this.objectStorage.createPresignedGetUrl(
          task.question.imageObjectKey,
        ),
        questionType: task.question.questionType,
        questionText: task.question.questionText,
        options: this.parseOptions(task.question.optionsJson),
        userAnswer: task.question.userAnswer,
        correctAnswer: task.question.correctAnswer,
        knowledgePoints: task.question.knowledgePoints.map(
          ({ knowledgePoint }) => knowledgePoint.name,
        ),
      },
    };
  }

  private parseOptions(
    value: Prisma.JsonValue | null,
  ): Array<{ label: string; text: string }> {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      if (
        typeof item !== 'object' ||
        item === null ||
        Array.isArray(item) ||
        typeof item.label !== 'string' ||
        typeof item.text !== 'string'
      ) {
        return [];
      }
      return [{ label: item.label, text: item.text }];
    });
  }

  private compareAnswer(
    userAnswer: string | null,
    correctAnswer: string | null,
  ): boolean | null {
    if (!userAnswer || !correctAnswer) return null;
    return (
      this.normalizeAnswer(userAnswer) === this.normalizeAnswer(correctAnswer)
    );
  }

  private normalizeAnswer(value: string): string {
    return value.trim().replace(/\s+/g, '').toUpperCase();
  }

  private shanghaiDayRange(now: Date): { start: Date; end: Date } {
    const offset = 8 * 60 * 60 * 1000;
    const local = new Date(now.getTime() + offset);
    local.setUTCHours(0, 0, 0, 0);
    const start = new Date(local.getTime() - offset);
    return { start, end: new Date(start.getTime() + 86400000 - 1) };
  }

  private nextShanghaiDayStart(now: Date): Date {
    const { start } = this.shanghaiDayRange(now);
    return this.addDays(start, 1);
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 86400000);
  }

  private notFound(): ApiException {
    return new ApiException(
      'REVIEW_TASK_NOT_FOUND',
      '复习任务不存在或不可操作',
      HttpStatus.NOT_FOUND,
    );
  }

  private alreadyHandled(): ApiException {
    return new ApiException(
      'REVIEW_TASK_ALREADY_HANDLED',
      '该复习任务已经处理',
      HttpStatus.CONFLICT,
    );
  }
}
