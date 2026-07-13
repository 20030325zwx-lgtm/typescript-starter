import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ApiException } from '../../common/exceptions/api.exception';
import { createHmacHex, safeEqualHex } from '../../common/utils/security.util';
import { PrismaService } from '../../database/prisma.service';
import type { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto';
import { TokenService } from './token.service';
import {
  WECHAT_AUTH_CLIENT,
  type WechatAuthClient,
} from '../wechat/wechat-auth-client.interface';

export interface SessionMetadata {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly openidHashSecret: string;
  private readonly tokenHashSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly config: ConfigService,
    @Inject(WECHAT_AUTH_CLIENT)
    private readonly wechatAuthClient: WechatAuthClient,
  ) {
    this.openidHashSecret = config.getOrThrow<string>(
      'WECHAT_OPENID_HASH_SECRET',
    );
    this.tokenHashSecret = config.getOrThrow<string>('TOKEN_HASH_SECRET');
  }

  async loginWithWechat(
    code: string,
    metadata: SessionMetadata,
  ): Promise<AuthResponseDto> {
    const identity = await this.wechatAuthClient.exchangeCode(code);
    const wechatOpenidHash = createHmacHex(
      identity.openid,
      this.openidHashSecret,
    );
    const user = await this.prisma.user.upsert({
      where: { wechatOpenidHash },
      update: {},
      create: { wechatOpenidHash },
    });

    this.ensureUserActive(user.status);
    return this.createSession(this.toAuthUser(user), metadata);
  }

  async refresh(
    refreshToken: string,
    metadata: SessionMetadata,
  ): Promise<AuthResponseDto> {
    const payload = await this.tokenService.verifyRefreshToken(refreshToken);
    const currentSession = await this.prisma.refreshSession.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });
    const now = new Date();
    const submittedHash = this.hashToken(refreshToken);

    if (
      !currentSession ||
      currentSession.userId !== payload.sub ||
      currentSession.revokedAt ||
      currentSession.expiresAt <= now ||
      !safeEqualHex(currentSession.tokenHash, submittedHash)
    ) {
      throw this.invalidRefreshToken();
    }
    this.ensureUserActive(currentSession.user.status);

    const newSessionId = randomUUID();
    const tokens = await this.tokenService.issuePair(
      currentSession.userId,
      newSessionId,
    );
    const newTokenHash = this.hashToken(tokens.refreshToken);

    await this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.refreshSession.updateMany({
        where: {
          id: currentSession.id,
          tokenHash: submittedHash,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now, lastUsedAt: now },
      });
      if (revoked.count !== 1) {
        throw this.invalidRefreshToken();
      }

      await transaction.refreshSession.create({
        data: {
          id: newSessionId,
          userId: currentSession.userId,
          tokenHash: newTokenHash,
          expiresAt: this.tokenService.getRefreshExpirationDate(now),
          ...this.normalizeMetadata(metadata),
        },
      });
    });

    return {
      ...tokens,
      user: this.toAuthUser(currentSession.user),
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const payload = await this.tokenService.tryVerifyRefreshToken(refreshToken);
    if (!payload) {
      return;
    }

    await this.prisma.refreshSession.updateMany({
      where: {
        id: payload.sid,
        userId: payload.sub,
        tokenHash: this.hashToken(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  private async createSession(
    user: AuthUserDto,
    metadata: SessionMetadata,
  ): Promise<AuthResponseDto> {
    const sessionId = randomUUID();
    const tokens = await this.tokenService.issuePair(user.id, sessionId);
    await this.prisma.refreshSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        tokenHash: this.hashToken(tokens.refreshToken),
        expiresAt: this.tokenService.getRefreshExpirationDate(),
        ...this.normalizeMetadata(metadata),
      },
    });

    return { ...tokens, user };
  }

  private normalizeMetadata(metadata: SessionMetadata): SessionMetadata {
    return {
      ...(metadata.ipAddress
        ? { ipAddress: metadata.ipAddress.slice(0, 64) }
        : {}),
      ...(metadata.userAgent
        ? { userAgent: metadata.userAgent.slice(0, 512) }
        : {}),
    };
  }

  private hashToken(token: string): string {
    return createHmacHex(token, this.tokenHashSecret);
  }

  private ensureUserActive(status: UserStatus): void {
    if (status !== UserStatus.ACTIVE) {
      throw new ApiException(
        'AUTH_USER_DISABLED',
        '账号当前不可用',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private invalidRefreshToken(): ApiException {
    return new ApiException(
      'AUTH_REFRESH_TOKEN_INVALID',
      '登录状态已失效，请重新登录',
      HttpStatus.UNAUTHORIZED,
    );
  }

  private toAuthUser(user: {
    id: string;
    nickname: string | null;
    avatarUrl: string | null;
  }): AuthUserDto {
    return {
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
    };
  }
}
