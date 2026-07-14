import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { AnalysisJobRunnerService } from '../analysis-job-runner.service';
import type { AnalysisQueueJobData } from './bullmq-analysis-queue.service';

@Injectable()
export class AnalysisWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AnalysisWorker.name);
  private worker?: Worker<AnalysisQueueJobData>;
  private connection?: IORedis;

  constructor(
    private readonly config: ConfigService,
    private readonly runner: AnalysisJobRunnerService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.get<boolean>('ANALYSIS_WORKER_ENABLED', false)) return;
    const attempts = this.config.get<number>('ANALYSIS_QUEUE_ATTEMPTS', 3);
    this.connection = new IORedis(this.config.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: null,
    });
    this.worker = new Worker<AnalysisQueueJobData>(
      this.config.get<string>('ANALYSIS_QUEUE_NAME', 'analysis'),
      async (job) => {
        await this.runner.execute(
          job.data.analysisJobId,
          job.attemptsMade + 1,
          attempts,
        );
      },
      {
        connection: this.connection,
        concurrency: this.config.get<number>('ANALYSIS_QUEUE_CONCURRENCY', 1),
      },
    );
    this.worker.on('error', (error) => {
      this.logger.error('Analysis worker error', error.stack);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.connection?.quit();
  }
}
