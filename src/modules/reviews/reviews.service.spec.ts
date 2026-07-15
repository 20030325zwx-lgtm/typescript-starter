import {
  QuestionStatus,
  ReviewSelfRating,
  ReviewTaskStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { ObjectStorageService } from '../storage/object-storage.interface';
import { ReviewSchedulerService } from './review-scheduler.service';
import { ReviewsService } from './reviews.service';

const now = new Date('2026-07-15T00:00:00.000Z');
const task = {
  id: '10000000-0000-4000-8000-000000000001',
  userId: '20000000-0000-4000-8000-000000000001',
  questionId: '30000000-0000-4000-8000-000000000001',
  cycle: 1,
  dueAt: now,
  status: ReviewTaskStatus.PENDING,
  intervalDays: 2,
  completedAt: null,
  createdAt: now,
  updatedAt: now,
  question: {
    id: '30000000-0000-4000-8000-000000000001',
    imageObjectKey: 'users/test/question.png',
    questionType: 'single_choice',
    questionText: '题干',
    optionsJson: [{ label: 'A', text: '选项 A' }],
    userAnswer: null,
    correctAnswer: 'A',
    status: QuestionStatus.CONFIRMED,
    deletedAt: null,
    knowledgePoints: [],
  },
};

describe('ReviewsService', () => {
  const reviewTask = {
    upsert: jest.fn<Promise<unknown>, [unknown]>(),
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn<Promise<unknown>, [unknown]>(),
  };
  const reviewAttempt = {
    create: jest.fn<Promise<unknown>, [unknown]>(),
  };
  const userMastery = { findUnique: jest.fn(), upsert: jest.fn() };
  const prisma = {
    reviewTask,
    reviewAttempt,
    userMastery,
    $transaction: jest.fn(),
  } as unknown as PrismaService;
  const objectStorage = {
    createPresignedGetUrl: jest
      .fn()
      .mockResolvedValue('https://storage.example/question'),
  } as unknown as ObjectStorageService;
  const scheduler = new ReviewSchedulerService();
  let service: ReviewsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReviewsService(prisma, scheduler, objectStorage);
  });

  it('creates the first review at the next Shanghai day boundary', async () => {
    reviewTask.upsert.mockResolvedValue({ id: 'created' });

    await service.scheduleInitial(
      prisma,
      task.userId,
      task.questionId,
      new Date('2026-07-15T10:00:00.000Z'),
    );

    const upsertInput = reviewTask.upsert.mock.calls[0]?.[0] as {
      create: { cycle: number; dueAt: Date };
    };
    expect(upsertInput.create).toMatchObject({
      cycle: 1,
      dueAt: new Date('2026-07-15T16:00:00.000Z'),
    });
  });

  it('downgrades a wrong GOOD answer and creates the next task atomically', async () => {
    reviewTask.findFirst.mockResolvedValue(task);
    reviewTask.updateMany.mockResolvedValue({ count: 1 });
    reviewTask.create.mockResolvedValue({ id: 'next-task' });
    reviewAttempt.create.mockResolvedValue({ id: 'attempt' });
    (prisma.$transaction as jest.Mock).mockImplementation(
      (callback: (tx: unknown) => unknown) => callback(prisma),
    );

    const result = await service.submit(task.userId, task.id, {
      userAnswer: 'B',
      selfRating: ReviewSelfRating.GOOD,
      durationSeconds: 30,
    });

    expect(result).toMatchObject({
      isCorrect: false,
      effectiveRating: ReviewSelfRating.AGAIN,
      masteryDelta: -12,
      nextTaskId: 'next-task',
    });
    const attemptInput = reviewAttempt.create.mock.calls[0]?.[0] as {
      data: { selfRating: ReviewSelfRating; isCorrect: boolean | null };
    };
    expect(attemptInput.data).toMatchObject({
      selfRating: ReviewSelfRating.AGAIN,
      isCorrect: false,
    });
  });

  it('does not expose another users review task', async () => {
    reviewTask.findFirst.mockResolvedValue(null);

    await expect(service.getById(task.userId, task.id)).rejects.toMatchObject({
      code: 'REVIEW_TASK_NOT_FOUND',
    });
  });
});
