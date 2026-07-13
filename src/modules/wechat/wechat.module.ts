import { Module } from '@nestjs/common';
import { HttpWechatAuthClient } from './wechat-auth.client';
import { WECHAT_AUTH_CLIENT } from './wechat-auth-client.interface';

@Module({
  providers: [
    HttpWechatAuthClient,
    {
      provide: WECHAT_AUTH_CLIENT,
      useExisting: HttpWechatAuthClient,
    },
  ],
  exports: [WECHAT_AUTH_CLIENT],
})
export class WechatModule {}
