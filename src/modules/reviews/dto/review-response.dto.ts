import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReviewSelfRating, ReviewTaskStatus } from '@prisma/client';

export class ReviewQuestionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  imageUrl!: string;

  @ApiPropertyOptional({ nullable: true })
  questionType!: string | null;

  @ApiPropertyOptional({ nullable: true })
  questionText!: string | null;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  options!: Array<{ label: string; text: string }>;

  @ApiPropertyOptional({ nullable: true })
  userAnswer!: string | null;

  @ApiPropertyOptional({ nullable: true })
  correctAnswer!: string | null;

  @ApiProperty({ type: [String] })
  knowledgePoints!: string[];
}

export class ReviewTaskResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  cycle!: number;

  @ApiProperty()
  dueAt!: Date;

  @ApiProperty({ enum: ReviewTaskStatus })
  status!: ReviewTaskStatus;

  @ApiProperty()
  intervalDays!: number;

  @ApiProperty({ type: ReviewQuestionDto })
  question!: ReviewQuestionDto;
}

export class TodayReviewSummaryDto {
  @ApiProperty()
  pending!: number;

  @ApiProperty()
  completedToday!: number;

  @ApiProperty()
  estimatedMinutes!: number;
}

export class TodayReviewsResponseDto {
  @ApiProperty({ type: TodayReviewSummaryDto })
  summary!: TodayReviewSummaryDto;

  @ApiProperty({ type: [ReviewTaskResponseDto] })
  items!: ReviewTaskResponseDto[];
}

export class ReviewAttemptResponseDto {
  @ApiProperty()
  taskId!: string;

  @ApiPropertyOptional({ nullable: true })
  isCorrect!: boolean | null;

  @ApiProperty({ enum: ReviewSelfRating })
  effectiveRating!: ReviewSelfRating;

  @ApiProperty()
  masteryDelta!: number;

  @ApiProperty()
  nextReviewAt!: Date;

  @ApiProperty()
  nextTaskId!: string;
}
