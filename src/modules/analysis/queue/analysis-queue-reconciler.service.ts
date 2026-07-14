import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalysisJobStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { ANALYSIS_QUEUE, type AnalysisQueue } from './analysis-queue.interface';

@Injectable()
export class AnalysisQueueReconcilerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(AnalysisQueueReconcilerService.name);
  private readonly intervalMs: number;
  private readonly staleRunningMs: number;
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(ANALYSIS_QUEUE) private readonly queue: AnalysisQueue,
  ) {
    this.intervalMs = config.get<number>(
      'ANALYSIS_RECONCILE_INTERVAL_MS',
      30000,
    );
    this.staleRunningMs =
      config.get<number>('DIFY_ANALYSIS_TIMEOUT_MS', 90000) * 2;
  }

  onApplicationBootstrap(): void {
    void this.reconcile();
    this.timer = setInterval(() => void this.reconcile(), this.intervalMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async reconcile(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const staleBefore = new Date(Date.now() - this.staleRunningMs);
      await this.prisma.analysisJob.updateMany({
        where: {
          status: AnalysisJobStatus.RUNNING,
          startedAt: { lt: staleBefore },
        },
        data: {
          status: AnalysisJobStatus.PENDING,
          queuedAt: null,
          errorCode: 'WORKER_INTERRUPTED',
          errorMessageSafe: '分析任务已恢复，正在重新处理',
        },
      });
      const pending = await this.prisma.analysisJob.findMany({
        where: { status: AnalysisJobStatus.PENDING, queuedAt: null },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });
      for (const job of pending) {
        try {
          await this.queue.enqueue(job.id);
          await this.prisma.analysisJob.updateMany({
            where: {
              id: job.id,
              status: AnalysisJobStatus.PENDING,
              queuedAt: null,
            },
            data: { queuedAt: new Date() },
          });
        } catch (error: unknown) {
          const stack = error instanceof Error ? error.stack : undefined;
          this.logger.warn(`Failed to reconcile analysis job ${job.id}`, stack);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
