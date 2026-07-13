import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { ImageProcessingService } from './image-processing.service';

describe('ImageProcessingService', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'learn-app-image-test-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  function createService(maxPixels = 40000000): ImageProcessingService {
    const values: Record<string, number> = {
      UPLOAD_MAX_FILE_SIZE_BYTES: 10485760,
      UPLOAD_MAX_PIXELS: maxPixels,
    };
    const config = {
      get: jest.fn((key: string, fallback?: number) => values[key] ?? fallback),
    } as unknown as ConfigService;
    return new ImageProcessingService(config);
  }

  it('normalizes a JPEG and removes source metadata', async () => {
    const inputPath = join(directory, 'input.jpg');
    await sharp({
      create: {
        width: 120,
        height: 80,
        channels: 3,
        background: '#ffffff',
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toFile(inputPath);

    const processed = await createService().process(inputPath);
    const metadata = await sharp(await readFile(processed.path)).metadata();

    expect(processed.mimeType).toBe('image/jpeg');
    expect(processed.width).toBe(80);
    expect(processed.height).toBe(120);
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.exif).toBeUndefined();

    await rm(processed.path, { force: true });
  });

  it('rejects a non-image file even when it has an image extension', async () => {
    const inputPath = join(directory, 'fake.jpg');
    await writeFile(inputPath, 'not an image', 'utf8');

    await expect(createService().process(inputPath)).rejects.toMatchObject({
      code: 'UPLOAD_FILE_TYPE_UNSUPPORTED',
    });
  });

  it('rejects an image above the configured pixel limit', async () => {
    const inputPath = join(directory, 'large.png');
    await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 3,
        background: '#ffffff',
      },
    })
      .png()
      .toFile(inputPath);

    await expect(createService(10000).process(inputPath)).rejects.toMatchObject(
      {
        code: 'UPLOAD_IMAGE_TOO_LARGE',
      },
    );
  });
});
