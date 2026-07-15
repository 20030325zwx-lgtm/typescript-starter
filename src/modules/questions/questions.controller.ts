import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiException } from '../../common/exceptions/api.exception';
import type { RequestUser } from '../../common/interfaces/request-user.interface';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CreateQuestionDto } from './dto/create-question.dto';
import { ListQuestionsQueryDto } from './dto/list-questions-query.dto';
import {
  QuestionListResponseDto,
  QuestionResponseDto,
} from './dto/question-response.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { WrongbookListResponseDto } from './dto/wrongbook-response.dto';
import { QuestionsService } from './questions.service';
import { UploadedFileCleanupInterceptor } from './uploaded-file-cleanup.interceptor';

@ApiTags('questions')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'), UploadedFileCleanupInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传图片并创建错题草稿' })
  @ApiCreatedResponse({ type: QuestionResponseDto })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'clientRequestId'],
      properties: {
        file: { type: 'string', format: 'binary' },
        clientRequestId: { type: 'string', format: 'uuid' },
        userAnswer: { type: 'string', maxLength: 20 },
        correctAnswer: { type: 'string', maxLength: 20 },
        source: { type: 'string', maxLength: 200 },
        note: { type: 'string', maxLength: 200 },
      },
    },
  })
  async create(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: CreateQuestionDto,
  ): Promise<QuestionResponseDto> {
    if (!file) {
      throw new ApiException(
        'UPLOAD_FILE_REQUIRED',
        '请选择需要上传的题目图片',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.questionsService.create(user.id, file, body);
  }

  @Get()
  @ApiOperation({ summary: '分页查询当前用户错题' })
  @ApiOkResponse({ type: QuestionListResponseDto })
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: ListQuestionsQueryDto,
  ): Promise<QuestionListResponseDto> {
    return this.questionsService.list(user.id, query);
  }

  @Get('wrongbook')
  @ApiOperation({ summary: '查询当前用户已确认错题本聚合数据' })
  @ApiOkResponse({ type: WrongbookListResponseDto })
  listWrongbook(
    @CurrentUser() user: RequestUser,
    @Query() query: ListQuestionsQueryDto,
  ): Promise<WrongbookListResponseDto> {
    return this.questionsService.listWrongbook(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: '查询错题详情' })
  @ApiOkResponse({ type: QuestionResponseDto })
  getById(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<QuestionResponseDto> {
    return this.questionsService.getById(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '编辑错题可修正字段' })
  @ApiOkResponse({ type: QuestionResponseDto })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateQuestionDto,
  ): Promise<QuestionResponseDto> {
    return this.questionsService.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '软删除错题并清理私有图片' })
  @ApiNoContentResponse()
  async delete(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.questionsService.delete(user.id, id);
  }
}
