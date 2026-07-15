import { Injectable } from '@nestjs/common';
import {
  AnalysisJobStatus,
  FeedbackStatus,
  Prisma,
  QuestionStatus,
  ReviewTaskStatus,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type {
  AdminListQueryDto,
  AdminTrendQueryDto,
} from './dto/admin-query.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(query: AdminTrendQueryDto) {
    const now = new Date();
    const todayStart = this.startOfShanghaiDay(now);
    const trendStart = new Date(
      todayStart.getTime() - (query.days - 1) * 86400000,
    );
    const [
      usersTotal,
      newUsersToday,
      confirmedQuestions,
      questionsToday,
      analysisTotal,
      analysisSucceeded,
      failedJobs,
      pendingReviews,
      completedReviewsToday,
      usersTrend,
      questionsTrend,
      analysesTrend,
      reviewsTrend,
      questionTypeRows,
      errorTypeRows,
      jobStatusRows,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.question.count({
        where: { status: QuestionStatus.CONFIRMED, deletedAt: null },
      }),
      this.prisma.question.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.analysisJob.count(),
      this.prisma.analysisJob.count({
        where: { status: AnalysisJobStatus.SUCCEEDED },
      }),
      this.prisma.analysisJob.count({
        where: { status: AnalysisJobStatus.FAILED },
      }),
      this.prisma.reviewTask.count({
        where: { status: ReviewTaskStatus.PENDING },
      }),
      this.prisma.reviewTask.count({
        where: {
          status: ReviewTaskStatus.COMPLETED,
          completedAt: { gte: todayStart },
        },
      }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: trendStart } },
        select: { createdAt: true },
      }),
      this.prisma.question.findMany({
        where: { createdAt: { gte: trendStart } },
        select: { createdAt: true },
      }),
      this.prisma.analysisJob.findMany({
        where: { createdAt: { gte: trendStart } },
        select: { createdAt: true },
      }),
      this.prisma.reviewTask.findMany({
        where: {
          completedAt: { gte: trendStart },
          status: ReviewTaskStatus.COMPLETED,
        },
        select: { completedAt: true },
      }),
      this.prisma.question.findMany({
        where: { status: QuestionStatus.CONFIRMED, deletedAt: null },
        select: { questionType: true },
      }),
      this.prisma.analysis.findMany({
        select: { errorType: true },
      }),
      this.prisma.analysisJob.findMany({
        select: { status: true },
      }),
    ]);

    const trend = Array.from({ length: query.days }, (_, index) => {
      const date = new Date(trendStart.getTime() + index * 86400000);
      const key = this.shanghaiDateKey(date);
      return {
        date: key,
        users: this.countDate(usersTrend, 'createdAt', key),
        questions: this.countDate(questionsTrend, 'createdAt', key),
        analyses: this.countDate(analysesTrend, 'createdAt', key),
        reviews: this.countDate(reviewsTrend, 'completedAt', key),
      };
    });

    return {
      metrics: {
        usersTotal,
        newUsersToday,
        confirmedQuestions,
        questionsToday,
        analysisSuccessRate:
          analysisTotal === 0
            ? 0
            : Math.round((analysisSucceeded / analysisTotal) * 1000) / 10,
        failedJobs,
        pendingReviews,
        completedReviewsToday,
      },
      trend,
      questionTypes: this.aggregateNames(
        questionTypeRows.map((item) => item.questionType || '未分类'),
      ).slice(0, 8),
      errorTypes: this.aggregateNames(
        errorTypeRows.map((item) => item.errorType),
      ).slice(0, 8),
      jobStatuses: this.aggregateNames(
        jobStatusRows.map((item) => item.status),
      ).map(({ name, count }) => ({ status: name, count })),
      updatedAt: now,
    };
  }

  async listUsers(query: AdminListQueryDto) {
    const status = this.enumValue(UserStatus, query.status);
    const where: Prisma.UserWhereInput = {
      ...(status ? { status } : {}),
      ...(query.search
        ? {
            OR: [
              { nickname: { contains: query.search, mode: 'insensitive' } },
              ...(this.isUuid(query.search) ? [{ id: query.search }] : []),
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          nickname: true,
          avatarUrl: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { questions: true, reviewTasks: true, analysisJobs: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async listQuestions(query: AdminListQueryDto) {
    const status = this.enumValue(QuestionStatus, query.status);
    const where: Prisma.QuestionWhereInput = {
      ...(status ? { status } : { status: { not: QuestionStatus.DELETED } }),
      ...(query.search
        ? {
            OR: [
              {
                questionText: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              { source: { contains: query.search, mode: 'insensitive' } },
              {
                user: {
                  nickname: { contains: query.search, mode: 'insensitive' },
                },
              },
              ...(this.isUuid(query.search) ? [{ id: query.search }] : []),
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        select: {
          id: true,
          questionType: true,
          questionText: true,
          userAnswer: true,
          correctAnswer: true,
          status: true,
          source: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, nickname: true } },
          analyses: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              errorType: true,
              confidence: true,
              needsManualReview: true,
            },
          },
          knowledgePoints: {
            select: { knowledgePoint: { select: { code: true, name: true } } },
          },
          reviewTasks: {
            where: { status: ReviewTaskStatus.PENDING },
            orderBy: { dueAt: 'asc' },
            take: 1,
            select: { dueAt: true, cycle: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.question.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        analyses: item.analyses.map((analysis) => ({
          ...analysis,
          confidence: analysis.confidence.toNumber(),
        })),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async listAnalysisJobs(query: AdminListQueryDto) {
    const status = this.enumValue(AnalysisJobStatus, query.status);
    const where: Prisma.AnalysisJobWhereInput = {
      ...(status ? { status } : {}),
      ...(query.search
        ? {
            OR: [
              { errorCode: { contains: query.search, mode: 'insensitive' } },
              ...(this.isUuid(query.search)
                ? [{ id: query.search }, { questionId: query.search }]
                : []),
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.analysisJob.findMany({
        where,
        select: {
          id: true,
          questionId: true,
          status: true,
          retryCount: true,
          errorCode: true,
          errorMessageSafe: true,
          workflowVersion: true,
          queuedAt: true,
          startedAt: true,
          finishedAt: true,
          createdAt: true,
          user: { select: { id: true, nickname: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.analysisJob.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async listReviews(query: AdminListQueryDto) {
    const status = this.enumValue(ReviewTaskStatus, query.status);
    const where: Prisma.ReviewTaskWhereInput = {
      ...(status ? { status } : {}),
      ...(query.search
        ? {
            OR: [
              {
                user: {
                  nickname: { contains: query.search, mode: 'insensitive' },
                },
              },
              ...(this.isUuid(query.search)
                ? [{ id: query.search }, { questionId: query.search }]
                : []),
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.reviewTask.findMany({
        where,
        select: {
          id: true,
          cycle: true,
          dueAt: true,
          status: true,
          intervalDays: true,
          completedAt: true,
          createdAt: true,
          user: { select: { id: true, nickname: true } },
          question: {
            select: { id: true, questionType: true, questionText: true },
          },
          attempt: {
            select: {
              userAnswer: true,
              isCorrect: true,
              selfRating: true,
              durationSeconds: true,
            },
          },
        },
        orderBy: [{ dueAt: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.reviewTask.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async listFeedback(query: AdminListQueryDto) {
    const status = this.enumValue(FeedbackStatus, query.status);
    const where: Prisma.FeedbackWhereInput = {
      ...(status ? { status } : {}),
      ...(query.search
        ? {
            OR: [
              { content: { contains: query.search, mode: 'insensitive' } },
              { contact: { contains: query.search, mode: 'insensitive' } },
              { category: { contains: query.search, mode: 'insensitive' } },
              {
                user: {
                  nickname: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.feedback.findMany({
        where,
        select: {
          id: true,
          category: true,
          content: true,
          contact: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, nickname: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.feedback.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  private enumValue<T extends Record<string, string>>(
    values: T,
    value?: string,
  ): T[keyof T] | undefined {
    return value && Object.values(values).includes(value)
      ? (value as T[keyof T])
      : undefined;
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private aggregateNames(
    values: string[],
  ): Array<{ name: string; count: number }> {
    const counts = new Map<string, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  private startOfShanghaiDay(now: Date): Date {
    const offset = 8 * 3600000;
    const local = new Date(now.getTime() + offset);
    local.setUTCHours(0, 0, 0, 0);
    return new Date(local.getTime() - offset);
  }

  private shanghaiDateKey(date: Date): string {
    return new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10);
  }

  private countDate<T extends Record<string, Date | null>>(
    rows: T[],
    field: keyof T,
    key: string,
  ): number {
    return rows.filter((row) => {
      const value = row[field];
      return value instanceof Date && this.shanghaiDateKey(value) === key;
    }).length;
  }
}
