import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import {
  ReviewAttemptResponseDto,
  ReviewTaskResponseDto,
  TodayReviewsResponseDto,
} from './dto/review-response.dto';
import { SubmitReviewAttemptDto } from './dto/submit-review-attempt.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('today')
  @ApiOperation({ summary: '查询今日到期和逾期复习任务' })
  @ApiOkResponse({ type: TodayReviewsResponseDto })
  today(@CurrentUser() user: RequestUser): Promise<TodayReviewsResponseDto> {
    return this.reviewsService.getToday(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: '查询单个复习任务' })
  @ApiOkResponse({ type: ReviewTaskResponseDto })
  getById(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ReviewTaskResponseDto> {
    return this.reviewsService.getById(user.id, id);
  }

  @Post(':id/attempts')
  @ApiOperation({ summary: '提交复习结果并安排下一次复习' })
  @ApiCreatedResponse({ type: ReviewAttemptResponseDto })
  submit(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: SubmitReviewAttemptDto,
  ): Promise<ReviewAttemptResponseDto> {
    return this.reviewsService.submit(user.id, id, body);
  }

  @Post(':id/skip')
  @ApiOperation({ summary: '跳过任务并顺延一天' })
  @ApiCreatedResponse({ type: ReviewAttemptResponseDto })
  skip(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ReviewAttemptResponseDto> {
    return this.reviewsService.skip(user.id, id);
  }
}
