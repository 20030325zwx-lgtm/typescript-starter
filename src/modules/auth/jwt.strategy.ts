import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { UserStatus } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ApiException } from '../../common/exceptions/api.exception';
import type { RequestUser } from '../../common/interfaces/request-user.interface';
import { PrismaService } from '../../database/prisma.service';

interface AccessTokenPayload {
  sub: string;
  typ: 'access';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<RequestUser> {
    if (payload.typ !== 'access' || typeof payload.sub !== 'string') {
      throw this.invalidAccessToken();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, status: true },
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw this.invalidAccessToken();
    }

    return { id: user.id };
  }

  private invalidAccessToken(): ApiException {
    return new ApiException(
      'AUTH_ACCESS_TOKEN_INVALID',
      '登录状态已失效，请重新登录',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
