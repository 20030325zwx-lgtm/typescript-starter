import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const FEEDBACK_CATEGORIES = [
  'BUG',
  'SUGGESTION',
  'ANALYSIS',
  'OTHER',
] as const;

export class CreateFeedbackDto {
  @ApiProperty({ enum: FEEDBACK_CATEGORIES })
  @IsIn(FEEDBACK_CATEGORIES)
  category!: (typeof FEEDBACK_CATEGORIES)[number];

  @ApiProperty({ minLength: 5, maxLength: 2000 })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  content!: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  contact?: string;
}

export class FeedbackResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  createdAt!: Date;
}
