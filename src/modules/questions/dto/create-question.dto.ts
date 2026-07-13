import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

function emptyToUndefined({ value }: { value: unknown }): unknown {
  return value === '' ? undefined : value;
}

export class CreateQuestionDto {
  @ApiProperty({ description: '客户端为本次录题生成的幂等 UUID' })
  @IsUUID()
  clientRequestId!: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  userAnswer?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  correctAnswer?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  source?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
