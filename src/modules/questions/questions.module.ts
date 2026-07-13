import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { diskStorage } from 'multer';
import { AuthModule } from '../auth/auth.module';
import { ExamsModule } from '../exams/exams.module';
import { StorageModule } from '../storage/storage.module';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';
import { UploadedFileCleanupInterceptor } from './uploaded-file-cleanup.interceptor';

@Module({
  imports: [
    AuthModule,
    ExamsModule,
    StorageModule,
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        storage: diskStorage({
          destination: tmpdir(),
          filename: (_request, _file, callback) =>
            callback(null, `learn-app-upload-${randomUUID()}`),
        }),
        limits: {
          files: 1,
          fileSize: config.get<number>('UPLOAD_MAX_FILE_SIZE_BYTES', 10485760),
        },
      }),
    }),
  ],
  controllers: [QuestionsController],
  providers: [QuestionsService, UploadedFileCleanupInterceptor],
})
export class QuestionsModule {}
