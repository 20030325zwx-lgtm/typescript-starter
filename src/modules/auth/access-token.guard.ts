import { HttpStatus, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiException } from '../../common/exceptions/api.exception';

@Injectable()
export class AccessTokenGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(err: unknown, user: TUser | false): TUser {
    if (err) {
      throw err;
    }
    if (!user) {
      throw new ApiException(
        'AUTH_ACCESS_TOKEN_INVALID',
        '登录状态已失效，请重新登录',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return user;
  }
}
