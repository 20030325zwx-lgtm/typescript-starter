import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminAuthService } from './admin-auth.service';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { AdminLoginDto, AdminLoginResponseDto } from './dto/admin-login.dto';
import { AdminListQueryDto, AdminTrendQueryDto } from './dto/admin-query.dto';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly admin: AdminService,
  ) {}

  @Post('auth/login')
  @ApiOperation({ summary: '管理员登录' })
  @ApiOkResponse({ type: AdminLoginResponseDto })
  login(@Body() dto: AdminLoginDto): Promise<AdminLoginResponseDto> {
    return this.auth.login(dto);
  }

  @Get('overview')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '管理端业务总览与趋势' })
  overview(@Query() query: AdminTrendQueryDto) {
    return this.admin.getOverview(query);
  }

  @Get('users')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '管理端用户列表' })
  users(@Query() query: AdminListQueryDto) {
    return this.admin.listUsers(query);
  }

  @Get('questions')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '管理端错题列表' })
  questions(@Query() query: AdminListQueryDto) {
    return this.admin.listQuestions(query);
  }

  @Get('analysis-jobs')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '管理端 AI 任务列表' })
  analysisJobs(@Query() query: AdminListQueryDto) {
    return this.admin.listAnalysisJobs(query);
  }

  @Get('reviews')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '管理端复习任务列表' })
  reviews(@Query() query: AdminListQueryDto) {
    return this.admin.listReviews(query);
  }

  @Get('feedback')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '管理端用户反馈列表' })
  feedback(@Query() query: AdminListQueryDto) {
    return this.admin.listFeedback(query);
  }
}
