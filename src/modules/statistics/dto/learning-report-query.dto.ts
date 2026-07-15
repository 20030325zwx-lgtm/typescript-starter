import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class LearningReportQueryDto {
  @ApiPropertyOptional({ enum: ['week', 'month'], default: 'week' })
  @IsOptional()
  @IsIn(['week', 'month'])
  period: 'week' | 'month' = 'week';
}
