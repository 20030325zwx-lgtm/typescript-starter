import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import type { AnalysisQueue } from './analysis-queue.interface';

export interface AnalysisQueueJobData {
  analysisJobId: string;
}

@Injectable()
export class BullmqAnalysisQueueService
  implements AnalysisQueue, OnModuleInit, OnModuleDestroy
{
  private readonly connection: IORedis;
  private readonly queue: Queue;
  private readonly attempts: number;

  constructor(config: ConfigService) {
    this.connection = new IORedis(config.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: null,
    });
    this.attempts = config.get<number>('ANALYSIS_QUEUE_ATTEMPTS', 3);
    this.queue = new Queue<AnalysisQueueJobData>(
      config.get<string>('ANALYSIS_QUEUE_NAME', 'analysis'),
      { connection: this.connection },
    );
  }

  async onModuleInit(): Promise<void> {
    await this.queue.waitUntilReady();
  }

  async enqueue(analysisJobId: string): Promise<void> {
    const existing = await this.queue.getJob(analysisJobId);
    if (existing) {
      const state = await existing.getState();
      if (state !== 'failed') return;
      await existing.remove();
    }
    await this.queue.add(
      'analyze-question',
      { analysisJobId },
      {
        jobId: analysisJobId,
        attempts: this.attempts,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.connection.quit();
  }
}
