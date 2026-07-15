import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService, type SessionMetadata } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { WechatLoginDto } from './dto/wechat-login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('wechat-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '使用 wx.login code 登录或注册' })
  @ApiOkResponse({ type: AuthResponseDto })
  login(
    @Body() body: WechatLoginDto,
    @Req() request: Request,
  ): Promise<AuthResponseDto> {
    return this.authService.loginWithWechat(
      body.code,
      this.getMetadata(request),
    );
  }

  @Post('dev-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '仅本地 H5 联调使用的开发登录' })
  @ApiOkResponse({ type: AuthResponseDto })
  devLogin(@Req() request: Request): Promise<AuthResponseDto> {
    if (
      this.config.get<string>('NODE_ENV') === 'production' ||
      !this.config.get<boolean>('DEV_AUTH_ENABLED', false)
    ) {
      throw new ForbiddenException('开发登录未启用');
    }
    return this.authService.loginForDevelopment(this.getMetadata(request));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '轮换 Refresh Token' })
  @ApiOkResponse({ type: AuthResponseDto })
  refresh(
    @Body() body: RefreshTokenDto,
    @Req() request: Request,
  ): Promise<AuthResponseDto> {
    return this.authService.refresh(
      body.refreshToken,
      this.getMetadata(request),
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '撤销当前 Refresh Token 会话' })
  @ApiNoContentResponse()
  async logout(@Body() body: RefreshTokenDto): Promise<void> {
    await this.authService.logout(body.refreshToken);
  }

  private getMetadata(request: Request): SessionMetadata {
    const forwardedFor = request.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(',')[0]?.trim();

    return {
      ...(forwardedIp || request.ip
        ? { ipAddress: forwardedIp ?? request.ip }
        : {}),
      ...(request.headers['user-agent']
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    };
  }
}
