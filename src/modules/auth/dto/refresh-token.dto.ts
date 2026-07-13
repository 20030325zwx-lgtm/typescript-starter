import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: '登录或上次刷新返回的 Refresh Token' })
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  refreshToken!: string;
}
