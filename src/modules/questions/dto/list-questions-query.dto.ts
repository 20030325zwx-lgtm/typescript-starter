import { ApiPropertyOptional } from '@nestjs/swagger';
import { QuestionStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const visibleStatuses = [
  QuestionStatus.DRAFT,
  QuestionStatus.ANALYSIS_PENDING,
  QuestionStatus.ANALYZING,
  QuestionStatus.ANALYSIS_FAILED,
  QuestionStatus.ANALYSIS_SUCCEEDED,
  QuestionStatus.CONFIRMED,
] as const;

export class ListQuestionsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  questionType?: string;

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  knowledgePointCode?: string;

  @ApiPropertyOptional({ enum: visibleStatuses })
  @IsOptional()
  @IsIn(visibleStatuses)
  status?: (typeof visibleStatuses)[number];
}
