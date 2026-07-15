import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WrongbookKnowledgePointDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;
}

export class WrongbookQuestionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  imageUrl!: string;

  @ApiPropertyOptional({ nullable: true })
  questionType!: string | null;

  @ApiPropertyOptional({ nullable: true })
  questionText!: string | null;

  @ApiPropertyOptional({ nullable: true })
  userAnswer!: string | null;

  @ApiPropertyOptional({ nullable: true })
  correctAnswer!: string | null;

  @ApiPropertyOptional({ nullable: true })
  errorType!: string | null;

  @ApiProperty({ type: [WrongbookKnowledgePointDto] })
  knowledgePoints!: WrongbookKnowledgePointDto[];

  @ApiProperty({ minimum: 0, maximum: 100 })
  mastery!: number;

  @ApiPropertyOptional({ nullable: true })
  nextReviewAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}

export class WrongbookSummaryDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  dueToday!: number;

  @ApiProperty()
  mastered!: number;

  @ApiProperty()
  addedThisWeek!: number;
}

export class WrongbookListResponseDto {
  @ApiProperty({ type: WrongbookSummaryDto })
  summary!: WrongbookSummaryDto;

  @ApiProperty({ type: [WrongbookQuestionDto] })
  items!: WrongbookQuestionDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;
}
