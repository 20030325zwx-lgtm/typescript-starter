import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/interfaces/request-user.interface';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { LearningReportQueryDto } from './dto/learning-report-query.dto';
import { StatisticsService } from './statistics.service';

@ApiTags('statistics')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller()
export class StatisticsController {
  constructor(private readonly statistics: StatisticsService) {}

  @Get('statistics/home')
  @ApiOperation({ summary: '查询首页学习聚合数据' })
  getHome(@CurrentUser() user: RequestUser) {
    return this.statistics.getHome(user.id);
  }

  @Get('reports/learning')
  @ApiOperation({ summary: '查询周期学习报告' })
  getLearningReport(
    @CurrentUser() user: RequestUser,
    @Query() query: LearningReportQueryDto,
  ) {
    return this.statistics.getLearningReport(user.id, query.period);
  }
}
