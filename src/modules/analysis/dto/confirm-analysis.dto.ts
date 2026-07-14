import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ANALYSIS_ERROR_TYPES } from '../analysis-output.types';

export class ConfirmedQuestionOptionDto {
  @ApiPropertyOptional({ maxLength: 20 })
  @IsString()
  @MaxLength(20)
  label!: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  text!: string;
}

export class ConfirmAnalysisDto {
  @ApiPropertyOptional({ maxLength: 20000 })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  questionText?: string;

  @ApiPropertyOptional({ type: [ConfirmedQuestionOptionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ConfirmedQuestionOptionDto)
  options?: ConfirmedQuestionOptionDto[];

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  questionType?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  correctAnswer?: string;

  @ApiPropertyOptional({ enum: ANALYSIS_ERROR_TYPES })
  @IsOptional()
  @IsIn(ANALYSIS_ERROR_TYPES)
  errorType?: string;

  @ApiPropertyOptional({ maxLength: 10000 })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  errorReason?: string;

  @ApiPropertyOptional({ type: [String], maxItems: 10 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  knowledgePointCodes?: string[];
}
