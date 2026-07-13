import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { unlink } from 'node:fs/promises';
import type { Observable } from 'rxjs';
import { finalize } from 'rxjs';

interface FileUploadRequest extends Request {
  file?: Express.Multer.File;
}

@Injectable()
export class UploadedFileCleanupInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FileUploadRequest>();

    return next.handle().pipe(
      finalize(() => {
        if (request.file?.path) {
          void unlink(request.file.path).catch(() => undefined);
        }
      }),
    );
  }
}
