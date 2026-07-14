import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnalysisJobStatus } from '@prisma/client';

export class CreateAnalysisJobResponseDto {
  @ApiProperty({ format: 'uuid' })
  jobId!: string;

  @ApiProperty({ enum: AnalysisJobStatus })
  status!: AnalysisJobStatus;

  @ApiProperty({ example: 1500 })
  pollAfterMs!: number;
}

export class AnalysisJobResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  questionId!: string;

  @ApiProperty({ enum: AnalysisJobStatus })
  status!: AnalysisJobStatus;

  @ApiProperty()
  retryCount!: number;

  @ApiPropertyOptional({ nullable: true })
  errorCode!: string | null;

  @ApiPropertyOptional({ nullable: true })
  errorMessage!: string | null;

  @ApiPropertyOptional({ nullable: true })
  startedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  finishedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}

export class AnalysisResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  questionId!: string;

  @ApiProperty()
  workflowVersion!: string;

  @ApiProperty()
  schemaVersion!: string;

  @ApiProperty()
  errorType!: string;

  @ApiProperty()
  errorReason!: string;

  @ApiProperty()
  explanation!: string;

  @ApiPropertyOptional({ nullable: true })
  memoryTip!: string | null;

  @ApiProperty()
  confidence!: number;

  @ApiProperty()
  answerConfidence!: number;

  @ApiProperty()
  needsManualReview!: boolean;

  @ApiProperty()
  userCorrected!: boolean;

  @ApiPropertyOptional({ nullable: true })
  confirmedAt!: Date | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  result!: Record<string, unknown>;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  knowledgePoints!: Array<{
    code: string;
    name: string;
    confidence: number;
    isUserConfirmed: boolean;
  }>;
}
