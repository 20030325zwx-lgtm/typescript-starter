import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { ExamsService } from '../exams/exams.service';
import { ImageProcessingService } from '../storage/image-processing.service';
import type { ObjectStorageService } from '../storage/object-storage.interface';
import { QuestionStatus } from '@prisma/client';
import { QuestionsService } from './questions.service';

const now = new Date('2026-07-13T00:00:00.000Z');
const sampleQuestion = {
  id: '10000000-0000-4000-8000-000000000001',
  userId: '20000000-0000-4000-8000-000000000001',
  examId: '00000000-0000-4000-8000-000000000001',
  clientRequestId: '30000000-0000-4000-8000-000000000001',
  imageObjectKey:
    'users/20000000-0000-4000-8000-000000000001/questions/test.jpg',
  imageMimeType: 'image/jpeg',
  imageSizeBytes: 1024,
  imageWidth: 120,
  imageHeight: 80,
  source: null,
  note: null,
  questionType: null,
  questionText: null,
  optionsJson: null,
  userAnswer: 'C',
  correctAnswer: null,
  status: QuestionStatus.DRAFT,
  imageDeletionPending: false,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  exam: { code: 'exam_civil_service' },
};

describe('QuestionsService', () => {
  const questionUpdateManyMock = jest.fn<
    Promise<{ count: number }>,
    [{ where: unknown; data: { imageDeletionPending?: boolean } }]
  >();
  const question = {
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    updateMany: questionUpdateManyMock,
    update: jest.fn(),
  };
  const prisma = {
    question,
    $transaction: jest.fn(),
  } as unknown as PrismaService;
  const examsService = {
    getDefaultExam: jest.fn(),
  } as unknown as ExamsService;
  const imageProcessMock = jest.fn();
  const imageProcessing = {
    process: imageProcessMock,
  } as unknown as ImageProcessingService;
  const putPrivateObjectMock = jest.fn();
  const deleteObjectMock = jest.fn();
  const createPresignedGetUrlMock = jest.fn();
  const objectStorage: ObjectStorageService = {
    putPrivateObject: putPrivateObjectMock,
    deleteObject: deleteObjectMock,
    createPresignedGetUrl: createPresignedGetUrlMock,
  };
  const config = {
    get: jest.fn((_key: string, fallback: number) => fallback),
  } as unknown as ConfigService;
  let service: QuestionsService;
  let loggerErrorSpy: jest.SpyInstance;

  beforeAll(() => {
    loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterAll(() => {
    loggerErrorSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new QuestionsService(
      prisma,
      examsService,
      imageProcessing,
      config,
      objectStorage,
    );
  });

  it('returns the existing question for an idempotent retry', async () => {
    question.findUnique.mockResolvedValue(sampleQuestion);
    createPresignedGetUrlMock.mockResolvedValue(
      'https://storage.example/signed',
    );

    const result = await service.create(
      sampleQuestion.userId,
      { path: 'unused' },
      { clientRequestId: sampleQuestion.clientRequestId },
    );

    expect(result.id).toBe(sampleQuestion.id);
    expect(imageProcessMock).not.toHaveBeenCalled();
    expect(putPrivateObjectMock).not.toHaveBeenCalled();
  });

  it('rejects an idempotency key that belongs to a deleted question', async () => {
    question.findUnique.mockResolvedValue({
      ...sampleQuestion,
      status: QuestionStatus.DELETED,
    });

    await expect(
      service.create(
        sampleQuestion.userId,
        { path: 'unused' },
        { clientRequestId: sampleQuestion.clientRequestId },
      ),
    ).rejects.toMatchObject({ code: 'QUESTION_IDEMPOTENCY_KEY_REUSED' });
  });

  it('keeps deletion pending when object storage is unavailable', async () => {
    question.findUnique.mockResolvedValue({
      userId: sampleQuestion.userId,
      status: QuestionStatus.DRAFT,
      imageObjectKey: sampleQuestion.imageObjectKey,
    });
    questionUpdateManyMock.mockResolvedValue({ count: 1 });
    deleteObjectMock.mockRejectedValue(new Error('storage unavailable'));

    await expect(
      service.delete(sampleQuestion.userId, sampleQuestion.id),
    ).resolves.toBeUndefined();

    expect(questionUpdateManyMock).toHaveBeenCalledTimes(1);
    expect(
      questionUpdateManyMock.mock.calls[0]?.[0].data.imageDeletionPending,
    ).toBe(true);
    expect(question.update).not.toHaveBeenCalled();
  });

  it('does not reveal another users question during delete', async () => {
    question.findUnique.mockResolvedValue({
      userId: 'another-user',
      status: QuestionStatus.DRAFT,
      imageObjectKey: sampleQuestion.imageObjectKey,
    });

    await expect(
      service.delete(sampleQuestion.userId, sampleQuestion.id),
    ).rejects.toMatchObject({ code: 'QUESTION_NOT_FOUND' });
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });
});
