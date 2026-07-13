import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { open, stat, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { ApiException } from '../../common/exceptions/api.exception';

export interface ProcessedImage {
  path: string;
  extension: 'jpg' | 'png' | 'webp';
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  sizeBytes: number;
  width: number;
  height: number;
}

type AllowedMimeType = ProcessedImage['mimeType'];

const allowedTypes: Record<
  AllowedMimeType,
  { extension: ProcessedImage['extension'] }
> = {
  'image/jpeg': { extension: 'jpg' },
  'image/png': { extension: 'png' },
  'image/webp': { extension: 'webp' },
};

@Injectable()
export class ImageProcessingService {
  private readonly maxFileSizeBytes: number;
  private readonly maxPixels: number;

  constructor(config: ConfigService) {
    this.maxFileSizeBytes = config.get<number>(
      'UPLOAD_MAX_FILE_SIZE_BYTES',
      10485760,
    );
    this.maxPixels = config.get<number>('UPLOAD_MAX_PIXELS', 40000000);
  }

  async process(inputPath: string): Promise<ProcessedImage> {
    const mimeType = await this.detectMimeType(inputPath);
    if (!mimeType) {
      throw new ApiException(
        'UPLOAD_FILE_TYPE_UNSUPPORTED',
        '仅支持 JPEG、PNG 或 WebP 图片',
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }

    const extension = allowedTypes[mimeType].extension;
    const outputPath = join(
      tmpdir(),
      `learn-app-sanitized-${randomUUID()}.${extension}`,
    );

    try {
      const metadata = await sharp(inputPath, {
        failOn: 'error',
        limitInputPixels: false,
      }).metadata();
      if (!metadata.width || !metadata.height) {
        throw this.invalidImage();
      }
      if (metadata.width * metadata.height > this.maxPixels) {
        throw new ApiException(
          'UPLOAD_IMAGE_TOO_LARGE',
          '图片像素过高，请压缩或裁剪后重试',
          HttpStatus.PAYLOAD_TOO_LARGE,
        );
      }

      const pipeline = sharp(inputPath, {
        failOn: 'error',
        limitInputPixels: this.maxPixels,
      }).rotate();
      if (mimeType === 'image/jpeg') {
        await pipeline.jpeg({ quality: 92, mozjpeg: true }).toFile(outputPath);
      } else if (mimeType === 'image/png') {
        await pipeline.png({ compressionLevel: 6 }).toFile(outputPath);
      } else {
        await pipeline.webp({ quality: 92 }).toFile(outputPath);
      }

      const outputMetadata = await sharp(outputPath).metadata();
      const outputStat = await stat(outputPath);
      if (!outputMetadata.width || !outputMetadata.height) {
        throw this.invalidImage();
      }
      if (outputStat.size > this.maxFileSizeBytes) {
        throw new ApiException(
          'UPLOAD_FILE_TOO_LARGE',
          '图片处理后仍超过大小限制，请压缩后重试',
          HttpStatus.PAYLOAD_TOO_LARGE,
        );
      }

      return {
        path: outputPath,
        extension,
        mimeType,
        sizeBytes: outputStat.size,
        width: outputMetadata.width,
        height: outputMetadata.height,
      };
    } catch (error: unknown) {
      await unlink(outputPath).catch(() => undefined);
      if (error instanceof ApiException) {
        throw error;
      }
      throw this.invalidImage();
    }
  }

  private async detectMimeType(
    inputPath: string,
  ): Promise<AllowedMimeType | null> {
    const handle = await open(inputPath, 'r');
    try {
      const header = Buffer.alloc(12);
      const { bytesRead } = await handle.read(header, 0, header.length, 0);
      if (
        bytesRead >= 3 &&
        header[0] === 0xff &&
        header[1] === 0xd8 &&
        header[2] === 0xff
      ) {
        return 'image/jpeg';
      }
      if (
        bytesRead >= 8 &&
        header
          .subarray(0, 8)
          .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      ) {
        return 'image/png';
      }
      if (
        bytesRead >= 12 &&
        header.subarray(0, 4).toString('ascii') === 'RIFF' &&
        header.subarray(8, 12).toString('ascii') === 'WEBP'
      ) {
        return 'image/webp';
      }
      return null;
    } finally {
      await handle.close();
    }
  }

  private invalidImage(): ApiException {
    return new ApiException(
      'UPLOAD_IMAGE_INVALID',
      '图片无法识别或文件已损坏',
      HttpStatus.BAD_REQUEST,
    );
  }
}
