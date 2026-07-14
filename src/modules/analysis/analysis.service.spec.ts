import { ConfigService } from '@nestjs/config';
import { AnalysisJobStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { KnowledgePointsService } from '../knowledge-points/knowledge-points.service';
import { AnalysisService } from './analysis.service';
import type { AnalysisQueue } from './queue/analysis-queue.interface';

const now = new Date('2026-07-14T00:00:00.000Z');
const sampleJob = {
  id: '10000000-0000-4000-8000-000000000001',
  userId: '20000000-0000-4000-8000-000000000001',
  questionId: '30000000-0000-4000-8000-000000000001',
  questionRevision: 1,
  workflowVersion: 'analysis-v1',
  idempotencyKey: 'key',
  status: AnalysisJobStatus.PENDING,
  retryCount: 0,
  errorCode: null,
  errorMessageSafe: null,
  difyWorkflowRunId: null,
  queuedAt: null,
  startedAt: null,
  finishedAt: null,
  createdAt: now,
  updatedAt: now,
};

describe('AnalysisService', () => {
  const question = { findFirst: jest.fn() };
  const analysisJob = {
    findUnique: jest.fn(),
    update: jest.fn(),
  };
  const prisma = {
    question,
    analysisJob,
  } as unknown as PrismaService;
  const config = {
    getOrThrow: jest.fn((key: string) =>
      key === 'DIFY_ANALYSIS_WORKFLOW_VERSION'
        ? 'analysis-v1'
        : 'independent-secret-at-least-32-characters',
    ),
  } as unknown as ConfigService;
  const knowledgePoints = {} as KnowledgePointsService;
  const enqueue = jest.fn();
  const queue = { enqueue } as AnalysisQueue;
  let service: AnalysisService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AnalysisService(prisma, config, knowledgePoints, queue);
    question.findFirst.mockResolvedValue({
      id: sampleJob.questionId,
      contentRevision: 1,
    });
  });

  it('reuses and enqueues an existing pending unqueued job', async () => {
    analysisJob.findUnique.mockResolvedValue(sampleJob);
    enqueue.mockResolvedValue(undefined);
    analysisJob.update.mockResolvedValue({ ...sampleJob, queuedAt: now });

    const result = await service.createJob(
      sampleJob.userId,
      sampleJob.questionId,
    );

    expect(enqueue).toHaveBeenCalledWith(sampleJob.id);
    expect(result).toMatchObject({
      jobId: sampleJob.id,
      status: AnalysisJobStatus.PENDING,
    });
  });

  it('does not enqueue an already successful idempotent job', async () => {
    analysisJob.findUnique.mockResolvedValue({
      ...sampleJob,
      status: AnalysisJobStatus.SUCCEEDED,
      queuedAt: now,
    });

    const result = await service.createJob(
      sampleJob.userId,
      sampleJob.questionId,
    );

    expect(enqueue).not.toHaveBeenCalled();
    expect(result.status).toBe(AnalysisJobStatus.SUCCEEDED);
  });

  it('does not reveal another users question', async () => {
    question.findFirst.mockResolvedValue(null);

    await expect(
      service.createJob(sampleJob.userId, sampleJob.questionId),
    ).rejects.toMatchObject({ code: 'QUESTION_NOT_FOUND' });
    expect(analysisJob.findUnique).not.toHaveBeenCalled();
  });
});
