import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { ReviewSchedulerService } from './review-scheduler.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewSchedulerService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
