import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ApiException } from '../../common/exceptions/api.exception';

interface AdminTokenPayload {
  sub: string;
  typ: 'admin';
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.config.get<boolean>('ADMIN_ENABLED', false)) {
      throw new ApiException(
        'ADMIN_DISABLED',
        '管理端尚未启用',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization || '';
    const token = authorization.startsWith('Bearer ')
      ? authorization.slice(7)
      : '';
    try {
      const payload = await this.jwt.verifyAsync<AdminTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('ADMIN_JWT_SECRET'),
      });
      if (payload.typ !== 'admin' || !payload.sub) throw new Error('invalid');
      return true;
    } catch {
      throw new ApiException(
        'ADMIN_TOKEN_INVALID',
        '管理端登录状态已失效',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }
}
