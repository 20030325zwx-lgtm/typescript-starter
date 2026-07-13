import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuestionStatus } from '@prisma/client';
import { QuestionOptionDto } from './update-question.dto';

export class QuestionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  examCode!: string;

  @ApiProperty()
  clientRequestId!: string;

  @ApiProperty()
  imageUrl!: string;

  @ApiProperty()
  imageMimeType!: string;

  @ApiProperty()
  imageSizeBytes!: number;

  @ApiProperty()
  imageWidth!: number;

  @ApiProperty()
  imageHeight!: number;

  @ApiPropertyOptional({ nullable: true })
  source!: string | null;

  @ApiPropertyOptional({ nullable: true })
  note!: string | null;

  @ApiPropertyOptional({ nullable: true })
  questionType!: string | null;

  @ApiPropertyOptional({ nullable: true })
  questionText!: string | null;

  @ApiPropertyOptional({ type: [QuestionOptionDto], nullable: true })
  options!: QuestionOptionDto[] | null;

  @ApiPropertyOptional({ nullable: true })
  userAnswer!: string | null;

  @ApiPropertyOptional({ nullable: true })
  correctAnswer!: string | null;

  @ApiProperty({ enum: QuestionStatus })
  status!: QuestionStatus;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class QuestionListResponseDto {
  @ApiProperty({ type: [QuestionResponseDto] })
  items!: QuestionResponseDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;
}
