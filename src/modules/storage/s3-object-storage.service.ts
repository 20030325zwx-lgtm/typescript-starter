import { HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ApiException } from '../../common/exceptions/api.exception';
import type {
  ObjectStorageService,
  PutPrivateObjectInput,
} from './object-storage.interface';

interface AwsErrorLike {
  $metadata?: { httpStatusCode?: number };
}

@Injectable()
export class S3ObjectStorageService
  implements ObjectStorageService, OnModuleInit
{
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly presignedUrlTtlSeconds: number;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    this.presignedUrlTtlSeconds = config.get<number>(
      'S3_PRESIGNED_URL_TTL_SECONDS',
      300,
    );
    this.client = new S3Client({
      endpoint: config.getOrThrow<string>('S3_ENDPOINT'),
      region: config.get<string>('S3_REGION', 'us-east-1'),
      forcePathStyle: config.get<boolean>('S3_FORCE_PATH_STYLE', true),
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_KEY'),
      },
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error: unknown) {
      if (this.getHttpStatusCode(error) !== 404) {
        throw this.unavailable();
      }

      try {
        await this.client.send(
          new CreateBucketCommand({ Bucket: this.bucket }),
        );
      } catch {
        throw this.unavailable();
      }
    }
  }

  async putPrivateObject(input: PutPrivateObjectInput): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
          ContentLength: input.contentLength,
          CacheControl: 'private, no-store',
        }),
      );
    } catch {
      throw this.unavailable();
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch {
      throw this.unavailable();
    }
  }

  async createPresignedGetUrl(key: string): Promise<string> {
    try {
      return await getSignedUrl(
        this.client,
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ResponseCacheControl: 'private, no-store',
        }),
        { expiresIn: this.presignedUrlTtlSeconds },
      );
    } catch {
      throw this.unavailable();
    }
  }

  private getHttpStatusCode(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null) {
      return undefined;
    }
    return (error as AwsErrorLike).$metadata?.httpStatusCode;
  }

  private unavailable(): ApiException {
    return new ApiException(
      'STORAGE_UNAVAILABLE',
      '文件存储服务暂时不可用，请稍后重试',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
