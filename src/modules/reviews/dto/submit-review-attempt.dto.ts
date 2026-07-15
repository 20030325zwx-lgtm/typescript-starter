import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReviewSelfRating } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

function emptyToUndefined({ value }: { value: unknown }): unknown {
  return value === '' ? undefined : value;
}

export class SubmitReviewAttemptDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  userAnswer?: string;

  @ApiProperty({ enum: ReviewSelfRating })
  @IsEnum(ReviewSelfRating)
  selfRating!: ReviewSelfRating;

  @ApiPropertyOptional({ minimum: 1, maximum: 3600 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3600)
  durationSeconds?: number;
}
