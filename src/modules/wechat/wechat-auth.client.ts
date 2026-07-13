import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '../../common/exceptions/api.exception';
import type {
  WechatAuthClient,
  WechatIdentity,
} from './wechat-auth-client.interface';

interface WechatCodeSessionResponse {
  openid?: unknown;
  unionid?: unknown;
  errcode?: unknown;
}

@Injectable()
export class HttpWechatAuthClient implements WechatAuthClient {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.appId = config.getOrThrow<string>('WECHAT_APP_ID');
    this.appSecret = config.getOrThrow<string>('WECHAT_APP_SECRET');
    this.timeoutMs = config.get<number>('WECHAT_API_TIMEOUT_MS', 5000);
  }

  async exchangeCode(code: string): Promise<WechatIdentity> {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.timeoutMs);

    try {
      const search = new URLSearchParams({
        appid: this.appId,
        secret: this.appSecret,
        js_code: code,
        grant_type: 'authorization_code',
      });
      const response = await fetch(
        `https://api.weixin.qq.com/sns/jscode2session?${search.toString()}`,
        { signal: abortController.signal },
      );

      if (!response.ok) {
        throw this.unavailable();
      }

      const payload = (await response.json()) as WechatCodeSessionResponse;
      if (typeof payload.errcode === 'number' && payload.errcode !== 0) {
        if (payload.errcode === 40029 || payload.errcode === 40163) {
          throw new ApiException(
            'AUTH_WECHAT_CODE_INVALID',
            '微信登录凭证已失效，请重试',
            HttpStatus.UNAUTHORIZED,
          );
        }
        throw this.unavailable();
      }

      if (typeof payload.openid !== 'string' || payload.openid.length === 0) {
        throw this.unavailable();
      }

      return {
        openid: payload.openid,
        ...(typeof payload.unionid === 'string'
          ? { unionid: payload.unionid }
          : {}),
      };
    } catch (error: unknown) {
      if (error instanceof ApiException) {
        throw error;
      }
      throw this.unavailable();
    } finally {
      clearTimeout(timeout);
    }
  }

  private unavailable(): ApiException {
    return new ApiException(
      'AUTH_WECHAT_UNAVAILABLE',
      '微信登录服务暂时不可用，请稍后重试',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
