import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { WechatModule } from '../wechat/wechat.module';
import { AccessTokenGuard } from './access-token.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { TokenService } from './token.service';

@Module({
  imports: [JwtModule.register({}), PassportModule, WechatModule],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtStrategy, AccessTokenGuard],
  exports: [AccessTokenGuard],
})
export class AuthModule {}
