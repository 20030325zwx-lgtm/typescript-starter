import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class WechatLoginDto {
  @ApiProperty({ description: 'wx.login 返回的一次性 code' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  code!: string;
}
