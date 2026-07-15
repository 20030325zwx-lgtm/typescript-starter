import { StatisticsService } from './statistics.service';

function decimal(value: number) {
  return { toNumber: () => value };
}

describe('StatisticsService', () => {
  const prisma = {
    user: { findUniqueOrThrow: jest.fn() },
    reviewTask: { count: jest.fn(), findMany: jest.fn() },
    question: { count: jest.fn() },
    userMastery: { findMany: jest.fn() },
    questionKnowledgePoint: { findMany: jest.fn() },
    reviewAttempt: { findMany: jest.fn() },
    analysis: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  };
  const service = new StatisticsService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      nickname: '备考用户',
      examTargetName: null,
      examDate: null,
    });
    prisma.reviewTask.count.mockResolvedValue(0);
    prisma.reviewTask.findMany.mockResolvedValue([]);
    prisma.question.count.mockResolvedValue(0);
    prisma.userMastery.findMany.mockResolvedValue([]);
    prisma.questionKnowledgePoint.findMany.mockResolvedValue([]);
    prisma.reviewAttempt.findMany.mockResolvedValue([]);
    prisma.analysis.findMany.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([]);
  });

  it('returns a useful empty home state for a new user', async () => {
    await expect(
      service.getHome('00000000-0000-4000-8000-000000000001'),
    ).resolves.toMatchObject({
      user: { nickname: '备考用户', streakDays: 0 },
      today: { pendingReviews: 0, completedReviews: 0 },
      week: { newQuestions: 0, reviewCompletionRate: 0, masteryScore: 0 },
      weakPoints: [],
    });
  });

  it('aggregates mastery and error data into a learning report', async () => {
    prisma.question.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    prisma.reviewTask.findMany
      .mockResolvedValueOnce([
        { dueAt: new Date(), status: 'COMPLETED', completedAt: new Date() },
      ])
      .mockResolvedValueOnce([]);
    prisma.reviewAttempt.findMany
      .mockResolvedValueOnce([
        { selfRating: 'GOOD', durationSeconds: 120, isCorrect: true },
      ])
      .mockResolvedValueOnce([]);
    prisma.userMastery.findMany.mockResolvedValue([
      {
        masteryScore: decimal(72),
        knowledgePoint: { code: 'logic_strengthen', name: '加强论证' },
      },
    ]);
    prisma.analysis.findMany.mockResolvedValue([
      { errorType: 'MISREAD_CONDITION' },
    ]);

    const report = await service.getLearningReport(
      '00000000-0000-4000-8000-000000000001',
      'week',
    );

    expect(report.score.current).toBe(72);
    expect(report.metrics).toMatchObject({
      newQuestions: 3,
      reviewCompletionRate: 100,
      reviewDurationMinutes: 2,
      correctRate: 100,
    });
    expect(report.errorTypes[0]).toMatchObject({
      name: '遗漏或误读条件',
      count: 1,
    });
    expect(report.abilities[0]).toMatchObject({
      name: '逻辑判断',
      value: 72,
    });
  });
});
