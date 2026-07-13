import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lastValueFrom, of, throwError } from 'rxjs';
import { UploadedFileCleanupInterceptor } from './uploaded-file-cleanup.interceptor';

describe('UploadedFileCleanupInterceptor', () => {
  let directory: string;
  let filePath: string;
  const interceptor = new UploadedFileCleanupInterceptor();

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'learn-app-cleanup-test-'));
    filePath = join(directory, 'upload.tmp');
    await writeFile(filePath, 'temporary upload');
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  function createContext(): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ file: { path: filePath } }),
      }),
    } as unknown as ExecutionContext;
  }

  async function expectFileRemoved(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
    await expect(access(filePath)).rejects.toMatchObject({ code: 'ENOENT' });
  }

  it('removes the temporary file after a successful request', async () => {
    const next = { handle: () => of('ok') } as CallHandler;

    await expect(
      lastValueFrom(interceptor.intercept(createContext(), next)),
    ).resolves.toBe('ok');
    await expectFileRemoved();
  });

  it('removes the temporary file after a failed request', async () => {
    const next = {
      handle: () => throwError(() => new Error('validation failed')),
    } as CallHandler;

    await expect(
      lastValueFrom(interceptor.intercept(createContext(), next)),
    ).rejects.toThrow('validation failed');
    await expectFileRemoved();
  });
});
