import { Injectable } from '@nestjs/common';
import {
  QuestionStatus,
  ReviewSelfRating,
  ReviewTaskStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

const RATING_DELTA: Record<ReviewSelfRating, number> = {
  AGAIN: -12,
  HARD: 2,
  GOOD: 8,
  EASY: 12,
};

const ERROR_TYPE_NAMES: Record<string, string> = {
  MISREAD_CONDITION: '遗漏或误读条件',
  KNOWLEDGE_GAP: '知识点缺口',
  REASONING_ERROR: '推理过程错误',
  CARELESSNESS: '粗心失误',
  OTHER: '其他错误',
};

interface MasteryRow {
  masteryScore: { toNumber(): number };
  knowledgePoint: { code: string; name: string };
}

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getHome(userId: string) {
    const now = new Date();
    const todayStart = this.startOfShanghaiDay(now);
    const todayEnd = new Date(todayStart.getTime() + 86400000 - 1);
    const weekStart = new Date(todayStart.getTime() - 6 * 86400000);
    const previousWeekStart = new Date(weekStart.getTime() - 7 * 86400000);
    const [
      user,
      pendingReviews,
      completedToday,
      weekQuestions,
      weekReviewTasks,
      masteryRows,
      knowledgeLinks,
      studyDates,
      weekAttempts,
      previousAttempts,
    ] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          nickname: true,
          examTargetName: true,
          examDate: true,
        },
      }),
      this.prisma.reviewTask.count({
        where: {
          userId,
          status: ReviewTaskStatus.PENDING,
          dueAt: { lte: todayEnd },
          question: { status: QuestionStatus.CONFIRMED, deletedAt: null },
        },
      }),
      this.prisma.reviewTask.count({
        where: {
          userId,
          status: ReviewTaskStatus.COMPLETED,
          completedAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      this.prisma.question.count({
        where: {
          userId,
          status: { not: QuestionStatus.DELETED },
          createdAt: { gte: weekStart, lte: todayEnd },
        },
      }),
      this.prisma.reviewTask.findMany({
        where: {
          userId,
          dueAt: { gte: weekStart, lte: todayEnd },
          status: { not: ReviewTaskStatus.CANCELLED },
        },
        select: { status: true },
      }),
      this.getMasteryRows(userId),
      this.prisma.questionKnowledgePoint.findMany({
        where: {
          question: {
            userId,
            status: QuestionStatus.CONFIRMED,
            deletedAt: null,
          },
        },
        select: {
          knowledgePointId: true,
          knowledgePoint: { select: { code: true, name: true } },
        },
      }),
      this.getStudyDates(userId),
      this.prisma.reviewAttempt.findMany({
        where: {
          reviewTask: { userId },
          createdAt: { gte: weekStart, lte: todayEnd },
        },
        select: { selfRating: true },
      }),
      this.prisma.reviewAttempt.findMany({
        where: {
          reviewTask: { userId },
          createdAt: { gte: previousWeekStart, lt: weekStart },
        },
        select: { selfRating: true },
      }),
    ]);

    const masteryScore = this.averageMastery(masteryRows);
    const completionCount = weekReviewTasks.filter(
      ({ status }) => status === ReviewTaskStatus.COMPLETED,
    ).length;
    const mistakeCounts = this.countBy(
      knowledgeLinks.map(({ knowledgePointId }) => knowledgePointId),
    );
    const masteryByCode = new Map(
      masteryRows.map((row) => [
        row.knowledgePoint.code,
        row.masteryScore.toNumber(),
      ]),
    );
    const uniquePoints = new Map(
      knowledgeLinks.map(({ knowledgePointId, knowledgePoint }) => [
        knowledgePointId,
        knowledgePoint,
      ]),
    );
    const weakPoints = [...uniquePoints.entries()]
      .map(([id, point]) => ({
        code: point.code,
        name: point.name,
        category: this.categoryName(point.code),
        mastery: Math.round(masteryByCode.get(point.code) ?? 0),
        mistakes: mistakeCounts.get(id) ?? 0,
      }))
      .sort((a, b) => a.mastery - b.mastery || b.mistakes - a.mistakes)
      .slice(0, 3);
    const weakest = weakPoints[0];

    return {
      user: {
        nickname: user.nickname,
        examTargetName: user.examTargetName,
        examDate: user.examDate,
        daysUntilExam: user.examDate
          ? Math.max(
              0,
              Math.ceil(
                (user.examDate.getTime() - todayStart.getTime()) / 86400000,
              ),
            )
          : null,
        streakDays: this.calculateStreak(studyDates),
      },
      today: {
        pendingReviews,
        completedReviews: completedToday,
        estimatedMinutes: Math.ceil(pendingReviews * 1.5),
      },
      week: {
        newQuestions: weekQuestions,
        completedReviews: completionCount,
        reviewCompletionRate:
          weekReviewTasks.length === 0
            ? 0
            : Math.round((completionCount / weekReviewTasks.length) * 100),
        masteryScore,
        masteryChange: this.estimatedMasteryChange(
          weekAttempts,
          previousAttempts,
          Math.max(1, masteryRows.length),
        ),
      },
      weakPoints,
      suggestion: weakest
        ? `${weakest.name}当前掌握度为 ${weakest.mastery}%，建议优先复习相关错题，并在作答后记录真正的失分原因。`
        : '完成第一道错题分析和复习后，这里会生成针对你的今日复盘建议。',
    };
  }

  async getLearningReport(userId: string, period: 'week' | 'month') {
    const now = new Date();
    const todayStart = this.startOfShanghaiDay(now);
    const todayEnd = new Date(todayStart.getTime() + 86400000 - 1);
    const days = period === 'week' ? 7 : 30;
    const start = new Date(todayStart.getTime() - (days - 1) * 86400000);
    const previousStart = new Date(start.getTime() - days * 86400000);
    const [
      questions,
      previousQuestions,
      reviewTasks,
      previousReviewTasks,
      attempts,
      previousAttempts,
      masteryRows,
      errorRows,
    ] = await Promise.all([
      this.prisma.question.count({
        where: {
          userId,
          status: { not: QuestionStatus.DELETED },
          createdAt: { gte: start, lte: todayEnd },
        },
      }),
      this.prisma.question.count({
        where: {
          userId,
          status: { not: QuestionStatus.DELETED },
          createdAt: { gte: previousStart, lt: start },
        },
      }),
      this.prisma.reviewTask.findMany({
        where: {
          userId,
          dueAt: { gte: start, lte: todayEnd },
          status: { not: ReviewTaskStatus.CANCELLED },
        },
        select: { dueAt: true, status: true, completedAt: true },
      }),
      this.prisma.reviewTask.findMany({
        where: {
          userId,
          dueAt: { gte: previousStart, lt: start },
          status: { not: ReviewTaskStatus.CANCELLED },
        },
        select: { status: true },
      }),
      this.prisma.reviewAttempt.findMany({
        where: {
          reviewTask: { userId },
          createdAt: { gte: start, lte: todayEnd },
        },
        select: {
          selfRating: true,
          durationSeconds: true,
          isCorrect: true,
        },
      }),
      this.prisma.reviewAttempt.findMany({
        where: {
          reviewTask: { userId },
          createdAt: { gte: previousStart, lt: start },
        },
        select: { selfRating: true },
      }),
      this.getMasteryRows(userId),
      this.prisma.analysis.findMany({
        where: {
          question: { userId },
          createdAt: { gte: start, lte: todayEnd },
        },
        select: { errorType: true },
      }),
    ]);

    const completed = reviewTasks.filter(
      ({ status }) => status === ReviewTaskStatus.COMPLETED,
    ).length;
    const previousCompleted = previousReviewTasks.filter(
      ({ status }) => status === ReviewTaskStatus.COMPLETED,
    ).length;
    const completionRate = this.percentage(completed, reviewTasks.length);
    const previousCompletionRate = this.percentage(
      previousCompleted,
      previousReviewTasks.length,
    );
    const masteryScore = this.averageMastery(masteryRows);
    const masteryChange = this.periodMasteryDelta(
      attempts,
      Math.max(1, masteryRows.length),
    );
    const trend = Array.from({ length: days }, (_, index) => {
      const date = new Date(start.getTime() + index * 86400000);
      const key = this.dayKey(date);
      const tasks = reviewTasks.filter(
        ({ dueAt }) => this.dayKey(dueAt) === key,
      );
      return {
        date: key,
        label:
          period === 'week'
            ? ['日', '一', '二', '三', '四', '五', '六'][
                new Date(date.getTime() + 8 * 3600000).getUTCDay()
              ]
            : `${Number(key.slice(8))}日`,
        value: this.percentage(
          tasks.filter(({ status }) => status === ReviewTaskStatus.COMPLETED)
            .length,
          tasks.length,
        ),
      };
    });
    const abilities = this.buildAbilities(masteryRows);
    const errorCounts = this.countBy(
      errorRows.map(({ errorType }) => errorType),
    );
    const errorTypes = [...errorCounts.entries()]
      .map(([code, count]) => ({
        code,
        name: ERROR_TYPE_NAMES[code] || code,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    const weakest = abilities.slice().sort((a, b) => a.value - b.value)[0];

    return {
      period,
      range: { start, end: todayEnd },
      score: {
        current: masteryScore,
        change: masteryChange,
        label:
          masteryScore >= 80
            ? '优秀'
            : masteryScore >= 60
              ? '良好'
              : masteryScore > 0
                ? '待加强'
                : '待开始',
      },
      metrics: {
        newQuestions: questions,
        questionsChange: questions - previousQuestions,
        reviewCompletionRate: completionRate,
        completionRateChange: completionRate - previousCompletionRate,
        reviewDurationMinutes: Math.round(
          attempts.reduce(
            (sum, attempt) => sum + (attempt.durationSeconds ?? 0),
            0,
          ) / 60,
        ),
        correctRate: this.percentage(
          attempts.filter(({ isCorrect }) => isCorrect === true).length,
          attempts.filter(({ isCorrect }) => isCorrect !== null).length,
        ),
      },
      trend,
      abilities,
      errorTypes,
      insight: weakest
        ? {
            text: `${weakest.name}是当前四类能力中掌握度最低的模块。下个周期建议减少无关新题，优先完成该模块的到期复习并核对错误原因。`,
            focus: weakest.name,
            dailyMinutes: period === 'week' ? 15 : 20,
            sampleQuestions: questions,
          }
        : {
            text: '当前还没有足够的掌握度数据。先确认错题分析并完成一次复习，系统会生成个性化建议。',
            focus: '完成首次复习',
            dailyMinutes: 10,
            sampleQuestions: questions,
          },
      comparison: {
        previousAttempts: previousAttempts.length,
      },
    };
  }

  private getMasteryRows(userId: string): Promise<MasteryRow[]> {
    return this.prisma.userMastery.findMany({
      where: { userId },
      select: {
        masteryScore: true,
        knowledgePoint: { select: { code: true, name: true } },
      },
    });
  }

  private getStudyDates(userId: string): Promise<Array<{ date: Date }>> {
    return this.prisma.$queryRaw<Array<{ date: Date }>>`
      SELECT DISTINCT date_trunc('day', activity_at AT TIME ZONE 'Asia/Shanghai') AS date
      FROM (
        SELECT created_at AS activity_at FROM questions WHERE user_id = ${userId}::uuid AND deleted_at IS NULL
        UNION ALL
        SELECT completed_at AS activity_at FROM review_tasks WHERE user_id = ${userId}::uuid AND completed_at IS NOT NULL
      ) activity
      ORDER BY date DESC
    `;
  }

  private buildAbilities(rows: MasteryRow[]) {
    const definitions = [
      { code: 'logic', name: '逻辑判断', color: '#329FC6' },
      { code: 'graphic', name: '图形推理', color: '#37BFA2' },
      { code: 'definition', name: '定义判断', color: '#62AFCA' },
      { code: 'analogy', name: '类比推理', color: '#59B99D' },
    ];
    return definitions.map((definition) => {
      const values = rows
        .filter(
          (row) =>
            this.abilityCode(row.knowledgePoint.code) === definition.code,
        )
        .map((row) => row.masteryScore.toNumber());
      return {
        ...definition,
        value:
          values.length === 0
            ? 0
            : Math.round(
                values.reduce((sum, value) => sum + value, 0) / values.length,
              ),
      };
    });
  }

  private abilityCode(code: string): string | null {
    if (code.startsWith('logic_') || code === 'event_ordering') return 'logic';
    if (code === 'graphic_reasoning') return 'graphic';
    if (code === 'definition_judgment') return 'definition';
    if (code === 'analogy_reasoning') return 'analogy';
    return null;
  }

  private categoryName(code: string): string {
    const ability = this.abilityCode(code);
    return (
      {
        logic: '逻辑判断',
        graphic: '图形推理',
        definition: '定义判断',
        analogy: '类比推理',
      }[ability || ''] || '判断推理'
    );
  }

  private averageMastery(rows: MasteryRow[]): number {
    if (rows.length === 0) return 0;
    return Math.round(
      rows.reduce((sum, row) => sum + row.masteryScore.toNumber(), 0) /
        rows.length,
    );
  }

  private periodMasteryDelta(
    attempts: Array<{ selfRating: ReviewSelfRating }>,
    masteryCount: number,
  ): number {
    return Math.round(
      attempts.reduce((sum, item) => sum + RATING_DELTA[item.selfRating], 0) /
        masteryCount,
    );
  }

  private estimatedMasteryChange(
    current: Array<{ selfRating: ReviewSelfRating }>,
    previous: Array<{ selfRating: ReviewSelfRating }>,
    masteryCount: number,
  ): number {
    return (
      this.periodMasteryDelta(current, masteryCount) -
      this.periodMasteryDelta(previous, masteryCount)
    );
  }

  private percentage(numerator: number, denominator: number): number {
    return denominator === 0 ? 0 : Math.round((numerator / denominator) * 100);
  }

  private countBy(values: string[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    return counts;
  }

  private calculateStreak(
    rows: Array<{ date: Date }>,
    now = new Date(),
  ): number {
    const keys = new Set(rows.map(({ date }) => this.dayKey(date)));
    let cursor = this.startOfShanghaiDay(now);
    if (!keys.has(this.dayKey(cursor)))
      cursor = new Date(cursor.getTime() - 86400000);
    let streak = 0;
    while (keys.has(this.dayKey(cursor))) {
      streak += 1;
      cursor = new Date(cursor.getTime() - 86400000);
    }
    return streak;
  }

  private startOfShanghaiDay(now: Date): Date {
    const local = new Date(now.getTime() + 8 * 3600000);
    local.setUTCHours(0, 0, 0, 0);
    return new Date(local.getTime() - 8 * 3600000);
  }

  private dayKey(date: Date): string {
    return new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10);
  }
}
