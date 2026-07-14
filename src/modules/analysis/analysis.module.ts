import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { KnowledgePointsModule } from '../knowledge-points/knowledge-points.module';
import { StorageModule } from '../storage/storage.module';
import { AnalysisController } from './analysis.controller';
import { AnalysisJobRunnerService } from './analysis-job-runner.service';
import { AnalysisResultValidatorService } from './analysis-result-validator.service';
import { AnalysisService } from './analysis.service';
import { DIFY_ANALYSIS_CLIENT } from './dify/dify-analysis-client.interface';
import { HttpDifyAnalysisClient } from './dify/http-dify-analysis.client';
import { ANALYSIS_QUEUE } from './queue/analysis-queue.interface';
import { AnalysisQueueReconcilerService } from './queue/analysis-queue-reconciler.service';
import { AnalysisWorker } from './queue/analysis.worker';
import { BullmqAnalysisQueueService } from './queue/bullmq-analysis-queue.service';

@Module({
  imports: [AuthModule, StorageModule, KnowledgePointsModule],
  controllers: [AnalysisController],
  providers: [
    AnalysisService,
    AnalysisJobRunnerService,
    AnalysisResultValidatorService,
    HttpDifyAnalysisClient,
    BullmqAnalysisQueueService,
    AnalysisQueueReconcilerService,
    AnalysisWorker,
    { provide: DIFY_ANALYSIS_CLIENT, useExisting: HttpDifyAnalysisClient },
    { provide: ANALYSIS_QUEUE, useExisting: BullmqAnalysisQueueService },
  ],
})
export class AnalysisModule {}
