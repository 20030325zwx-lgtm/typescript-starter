import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/interfaces/request-user.interface';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { AnalysisService } from './analysis.service';
import { ConfirmAnalysisDto } from './dto/confirm-analysis.dto';
import {
  AnalysisJobResponseDto,
  AnalysisResponseDto,
  CreateAnalysisJobResponseDto,
} from './dto/analysis-response.dto';

@ApiTags('analysis')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller()
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Post('questions/:id/analysis-jobs')
  @ApiOperation({ summary: '创建或返回幂等的异步分析任务' })
  @ApiCreatedResponse({ type: CreateAnalysisJobResponseDto })
  createJob(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) questionId: string,
  ): Promise<CreateAnalysisJobResponseDto> {
    return this.analysisService.createJob(user.id, questionId);
  }

  @Get('analysis-jobs/:jobId')
  @ApiOperation({ summary: '查询分析任务状态' })
  @ApiOkResponse({ type: AnalysisJobResponseDto })
  getJob(
    @CurrentUser() user: RequestUser,
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
  ): Promise<AnalysisJobResponseDto> {
    return this.analysisService.getJob(user.id, jobId);
  }

  @Get('questions/:id/analysis')
  @ApiOperation({ summary: '查询当前错题最近一次有效分析' })
  @ApiOkResponse({ type: AnalysisResponseDto })
  getAnalysis(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) questionId: string,
  ): Promise<AnalysisResponseDto> {
    return this.analysisService.getAnalysis(user.id, questionId);
  }

  @Patch('questions/:id/analysis-confirmation')
  @ApiOperation({ summary: '确认或纠正 AI 分析结果' })
  @ApiOkResponse({ type: AnalysisResponseDto })
  confirm(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) questionId: string,
    @Body() body: ConfirmAnalysisDto,
  ): Promise<AnalysisResponseDto> {
    return this.analysisService.confirm(user.id, questionId, body);
  }
}
