import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { timingSafeEqual } from 'node:crypto';
import { ApiException } from '../../common/exceptions/api.exception';
import type {
  AdminLoginDto,
  AdminLoginResponseDto,
} from './dto/admin-login.dto';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: AdminLoginDto): Promise<AdminLoginResponseDto> {
    if (!this.config.get<boolean>('ADMIN_ENABLED', false)) {
      throw new ApiException(
        'ADMIN_DISABLED',
        '管理端尚未启用',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const username = this.config.getOrThrow<string>('ADMIN_USERNAME');
    const password = this.config.getOrThrow<string>('ADMIN_PASSWORD');
    if (
      !this.safeEqual(dto.username, username) ||
      !this.safeEqual(dto.password, password)
    ) {
      throw new ApiException(
        'ADMIN_CREDENTIALS_INVALID',
        '管理员账号或密码不正确',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const expiresIn = this.config.get<number>('ADMIN_JWT_TTL_SECONDS', 28800);
    const accessToken = await this.jwt.signAsync(
      { sub: username, typ: 'admin' },
      {
        secret: this.config.getOrThrow<string>('ADMIN_JWT_SECRET'),
        expiresIn,
      },
    );
    return { accessToken, expiresIn, username };
  }

  private safeEqual(actual: string, expected: string): boolean {
    const actualBuffer = Buffer.from(actual);
    const expectedBuffer = Buffer.from(expected);
    return (
      actualBuffer.length === expectedBuffer.length &&
      timingSafeEqual(actualBuffer, expectedBuffer)
    );
  }
}
