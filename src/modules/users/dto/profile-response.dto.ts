import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProfileStatsDto {
  @ApiProperty()
  totalQuestions!: number;

  @ApiProperty()
  completedReviews!: number;

  @ApiProperty()
  studyDays!: number;

  @ApiProperty()
  streakDays!: number;
}

export class ProfileResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  nickname!: string | null;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  examTargetName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  examDate!: Date | null;

  @ApiProperty()
  reminderEnabled!: boolean;

  @ApiPropertyOptional({ nullable: true })
  reminderTime!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ type: ProfileStatsDto })
  stats!: ProfileStatsDto;
}

export class UserDataSummaryDto {
  @ApiProperty()
  accountCreatedAt!: Date;

  @ApiProperty()
  questions!: number;

  @ApiProperty()
  analyses!: number;

  @ApiProperty()
  reviewTasks!: number;

  @ApiProperty()
  reviewAttempts!: number;

  @ApiProperty()
  feedback!: number;
}
