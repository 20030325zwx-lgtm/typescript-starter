import { Module } from '@nestjs/common';
import { ImageProcessingService } from './image-processing.service';
import { OBJECT_STORAGE } from './object-storage.interface';
import { S3ObjectStorageService } from './s3-object-storage.service';

@Module({
  providers: [
    ImageProcessingService,
    S3ObjectStorageService,
    {
      provide: OBJECT_STORAGE,
      useExisting: S3ObjectStorageService,
    },
  ],
  exports: [ImageProcessingService, OBJECT_STORAGE],
})
export class StorageModule {}
