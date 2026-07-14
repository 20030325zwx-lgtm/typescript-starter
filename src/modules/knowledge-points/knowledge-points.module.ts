import { Module } from '@nestjs/common';
import { KnowledgePointsService } from './knowledge-points.service';

@Module({
  providers: [KnowledgePointsService],
  exports: [KnowledgePointsService],
})
export class KnowledgePointsModule {}
