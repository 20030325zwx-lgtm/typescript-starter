import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { MulterError } from 'multer';
import { ApiException } from '../exceptions/api.exception';
import type { ErrorResponse } from '../interfaces/error-response.interface';

interface HttpExceptionBody {
  code?: string;
  message?: string | string[];
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    const status =
      exception instanceof MulterError
        ? exception.code === 'LIMIT_FILE_SIZE'
          ? HttpStatus.PAYLOAD_TOO_LARGE
          : HttpStatus.BAD_REQUEST
        : exception instanceof HttpException
          ? exception.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = this.getExceptionBody(exception);
    const validationDetails = Array.isArray(body.message)
      ? body.message
      : undefined;
    const headerRequestId = request.headers['x-request-id'];
    const requestId =
      typeof request.id === 'string'
        ? request.id
        : typeof headerRequestId === 'string'
          ? headerRequestId
          : '';

    const payload: ErrorResponse = {
      statusCode: status,
      code: this.getErrorCode(exception, body),
      message: this.getSafeMessage(exception, body),
      requestId,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
      ...(validationDetails ? { details: validationDetails } : {}),
    };

    response.status(status).json(payload);
  }

  private getExceptionBody(exception: unknown): HttpExceptionBody {
    if (!(exception instanceof HttpException)) {
      return {};
    }

    const response = exception.getResponse();
    if (typeof response === 'string') {
      return { message: response };
    }

    return response as HttpExceptionBody;
  }

  private getErrorCode(exception: unknown, body: HttpExceptionBody): string {
    if (exception instanceof ApiException) {
      return exception.code;
    }

    if (exception instanceof MulterError) {
      return exception.code === 'LIMIT_FILE_SIZE'
        ? 'UPLOAD_FILE_TOO_LARGE'
        : 'VALIDATION_FAILED';
    }

    if (exception instanceof BadRequestException) {
      return 'VALIDATION_FAILED';
    }

    return body.code ?? 'INTERNAL_ERROR';
  }

  private getSafeMessage(exception: unknown, body: HttpExceptionBody): string {
    if (!(exception instanceof HttpException)) {
      if (exception instanceof MulterError) {
        return exception.code === 'LIMIT_FILE_SIZE'
          ? '图片大小超过上传限制'
          : '上传请求不正确';
      }
      return '服务暂时不可用，请稍后重试';
    }

    if (Array.isArray(body.message)) {
      return '请求参数不正确';
    }

    return body.message ?? exception.message;
  }
}
