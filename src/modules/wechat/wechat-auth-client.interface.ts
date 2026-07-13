export const WECHAT_AUTH_CLIENT = Symbol('WECHAT_AUTH_CLIENT');

export interface WechatIdentity {
  openid: string;
  unionid?: string;
}

export interface WechatAuthClient {
  exchangeCode(code: string): Promise<WechatIdentity>;
}
