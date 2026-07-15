import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Body,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/interfaces/request-user.interface';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUserDto } from './dto/current-user.dto';
import { CreateFeedbackDto, FeedbackResponseDto } from './dto/feedback.dto';
import {
  ProfileResponseDto,
  UserDataSummaryDto,
} from './dto/profile-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: '查询当前登录用户' })
  @ApiOkResponse({ type: CurrentUserDto })
  getMe(@CurrentUser() user: RequestUser): Promise<CurrentUserDto> {
    return this.usersService.getCurrentUser(user.id);
  }

  @Get('me/profile')
  @ApiOperation({ summary: '查询当前用户资料、目标、提醒和学习统计' })
  @ApiOkResponse({ type: ProfileResponseDto })
  getProfile(@CurrentUser() user: RequestUser): Promise<ProfileResponseDto> {
    return this.usersService.getProfile(user.id);
  }

  @Patch('me/profile')
  @ApiOperation({ summary: '更新当前用户资料、考试目标和提醒设置' })
  @ApiOkResponse({ type: ProfileResponseDto })
  updateProfile(
    @CurrentUser() user: RequestUser,
    @Body() body: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    return this.usersService.updateProfile(user.id, body);
  }

  @Get('me/data-summary')
  @ApiOperation({ summary: '查询当前账号保存的数据摘要' })
  @ApiOkResponse({ type: UserDataSummaryDto })
  getDataSummary(
    @CurrentUser() user: RequestUser,
  ): Promise<UserDataSummaryDto> {
    return this.usersService.getDataSummary(user.id);
  }

  @Post('me/feedback')
  @ApiOperation({ summary: '提交意见反馈' })
  @ApiOkResponse({ type: FeedbackResponseDto })
  createFeedback(
    @CurrentUser() user: RequestUser,
    @Body() body: CreateFeedbackDto,
  ): Promise<FeedbackResponseDto> {
    return this.usersService.createFeedback(user.id, body);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '注销当前账号并撤销全部会话' })
  @ApiNoContentResponse()
  async deleteMe(@CurrentUser() user: RequestUser): Promise<void> {
    await this.usersService.deleteCurrentUser(user.id);
  }
}
