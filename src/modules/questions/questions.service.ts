import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, QuestionStatus } from '@prisma/client';
import { createReadStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { ApiException } from '../../common/exceptions/api.exception';
import { PrismaService } from '../../database/prisma.service';
import { ExamsService } from '../exams/exams.service';
import { ImageProcessingService } from '../storage/image-processing.service';
import {
  OBJECT_STORAGE,
  type ObjectStorageService,
} from '../storage/object-storage.interface';
import type { CreateQuestionDto } from './dto/create-question.dto';
import type { ListQuestionsQueryDto } from './dto/list-questions-query.dto';
import type {
  QuestionListResponseDto,
  QuestionResponseDto,
} from './dto/question-response.dto';
import type {
  QuestionOptionDto,
  UpdateQuestionDto,
} from './dto/update-question.dto';

interface UploadedFile {
  path: string;
}

type QuestionWithExam = Prisma.QuestionGetPayload<{
  include: { exam: { select: { code: true } } };
}>;

@Injectable()
export class QuestionsService {
  private readonly logger = new Logger(QuestionsService.name);
  private readonly dailyUploadLimit: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly examsService: ExamsService,
    private readonly imageProcessing: ImageProcessingService,
    private readonly config: ConfigService,
    @Inject(OBJECT_STORAGE)
    private readonly objectStorage: ObjectStorageService,
  ) {
    this.dailyUploadLimit = config.get<number>('UPLOAD_DAILY_LIMIT', 30);
  }

  async create(
    userId: string,
    file: UploadedFile,
    dto: CreateQuestionDto,
  ): Promise<QuestionResponseDto> {
    const existing = await this.findByClientRequestId(
      userId,
      dto.clientRequestId,
    );
    if (existing) {
      if (existing.status === QuestionStatus.DELETED) {
        throw new ApiException(
          'QUESTION_IDEMPOTENCY_KEY_REUSED',
          '本次录题标识已被使用，请重新提交',
          HttpStatus.CONFLICT,
        );
      }
      return this.toResponse(existing);
    }

    await this.ensureDailyLimit(userId);
    const exam = await this.examsService.getDefaultExam();
    const questionId = randomUUID();
    const processed = await this.imageProcessing.process(file.path);
    const objectKey = `users/${userId}/questions/${questionId}.${processed.extension}`;
    let objectUploaded = false;
    let createdQuestion: QuestionWithExam | null = null;

    try {
      await this.objectStorage.putPrivateObject({
        key: objectKey,
        body: createReadStream(processed.path),
        contentType: processed.mimeType,
        contentLength: processed.sizeBytes,
      });
      objectUploaded = true;

      createdQuestion = await this.prisma.question.create({
        data: {
          id: questionId,
          userId,
          examId: exam.id,
          clientRequestId: dto.clientRequestId,
          imageObjectKey: objectKey,
          imageMimeType: processed.mimeType,
          imageSizeBytes: processed.sizeBytes,
          imageWidth: processed.width,
          imageHeight: processed.height,
          source: dto.source,
          note: dto.note,
          userAnswer: dto.userAnswer,
          correctAnswer: dto.correctAnswer,
        },
        include: { exam: { select: { code: true } } },
      });
    } catch (error: unknown) {
      if (objectUploaded) {
        await this.deleteObjectBestEffort(objectKey, questionId);
      }

      if (this.isUniqueConstraintError(error)) {
        const concurrentExisting = await this.findByClientRequestId(
          userId,
          dto.clientRequestId,
        );
        if (
          concurrentExisting &&
          concurrentExisting.status !== QuestionStatus.DELETED
        ) {
          return this.toResponse(concurrentExisting);
        }
      }

      if (error instanceof ApiException) {
        throw error;
      }
      throw new ApiException(
        'QUESTION_CREATE_FAILED',
        '错题保存失败，请稍后重试',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      await unlink(processed.path).catch(() => undefined);
    }

    return this.toResponse(createdQuestion);
  }

  async list(
    userId: string,
    query: ListQuestionsQueryDto,
  ): Promise<QuestionListResponseDto> {
    const where: Prisma.QuestionWhereInput = {
      userId,
      status: query.status ?? { not: QuestionStatus.DELETED },
      ...(query.questionType ? { questionType: query.questionType } : {}),
      ...(query.search
        ? {
            OR: [
              {
                questionText: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                source: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                note: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        include: { exam: { select: { code: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.question.count({ where }),
    ]);

    return {
      items: await Promise.all(items.map((item) => this.toResponse(item))),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async getById(
    userId: string,
    questionId: string,
  ): Promise<QuestionResponseDto> {
    const question = await this.prisma.question.findFirst({
      where: {
        id: questionId,
        userId,
        status: { not: QuestionStatus.DELETED },
      },
      include: { exam: { select: { code: true } } },
    });
    if (!question) {
      throw this.notFound();
    }
    return this.toResponse(question);
  }

  async update(
    userId: string,
    questionId: string,
    dto: UpdateQuestionDto,
  ): Promise<QuestionResponseDto> {
    const data: Prisma.QuestionUpdateManyMutationInput = {};
    if (dto.questionText !== undefined) {
      data.questionText = this.nullIfEmpty(dto.questionText);
    }
    if (dto.options !== undefined) {
      data.optionsJson = dto.options.map(({ label, text }) => ({
        label,
        text,
      }));
    }
    if (dto.userAnswer !== undefined) {
      data.userAnswer = this.nullIfEmpty(dto.userAnswer);
    }
    if (dto.correctAnswer !== undefined) {
      data.correctAnswer = this.nullIfEmpty(dto.correctAnswer);
    }
    if (dto.source !== undefined) {
      data.source = this.nullIfEmpty(dto.source);
    }
    if (dto.note !== undefined) {
      data.note = this.nullIfEmpty(dto.note);
    }
    if (Object.keys(data).length === 0) {
      throw new ApiException(
        'QUESTION_UPDATE_EMPTY',
        '请至少提供一个需要修改的字段',
        HttpStatus.BAD_REQUEST,
      );
    }

    const updated = await this.prisma.question.updateMany({
      where: {
        id: questionId,
        userId,
        status: { not: QuestionStatus.DELETED },
      },
      data,
    });
    if (updated.count !== 1) {
      throw this.notFound();
    }
    return this.getById(userId, questionId);
  }

  async delete(userId: string, questionId: string): Promise<void> {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      select: {
        userId: true,
        status: true,
        imageObjectKey: true,
      },
    });
    if (!question || question.userId !== userId) {
      throw this.notFound();
    }
    if (question.status === QuestionStatus.DELETED) {
      return;
    }

    const now = new Date();
    const deleted = await this.prisma.question.updateMany({
      where: {
        id: questionId,
        userId,
        status: { not: QuestionStatus.DELETED },
      },
      data: {
        status: QuestionStatus.DELETED,
        deletedAt: now,
        imageDeletionPending: true,
      },
    });
    if (deleted.count !== 1) {
      return;
    }

    try {
      await this.objectStorage.deleteObject(question.imageObjectKey);
      await this.prisma.question.update({
        where: { id: questionId },
        data: { imageDeletionPending: false },
      });
    } catch (error: unknown) {
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Question image deletion pending for question ${questionId}`,
        stack,
      );
    }
  }

  private async ensureDailyLimit(userId: string): Promise<void> {
    const count = await this.prisma.question.count({
      where: {
        userId,
        createdAt: { gte: this.getStartOfShanghaiDay() },
      },
    });
    if (count >= this.dailyUploadLimit) {
      throw new ApiException(
        'UPLOAD_DAILY_LIMIT_EXCEEDED',
        '今日录题数量已达上限，请明天再试',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private getStartOfShanghaiDay(now = new Date()): Date {
    const shanghaiOffsetMs = 8 * 60 * 60 * 1000;
    const shanghaiTime = new Date(now.getTime() + shanghaiOffsetMs);
    shanghaiTime.setUTCHours(0, 0, 0, 0);
    return new Date(shanghaiTime.getTime() - shanghaiOffsetMs);
  }

  private findByClientRequestId(
    userId: string,
    clientRequestId: string,
  ): Promise<QuestionWithExam | null> {
    return this.prisma.question.findUnique({
      where: { userId_clientRequestId: { userId, clientRequestId } },
      include: { exam: { select: { code: true } } },
    });
  }

  private async toResponse(
    question: QuestionWithExam,
  ): Promise<QuestionResponseDto> {
    return {
      id: question.id,
      examCode: question.exam.code,
      clientRequestId: question.clientRequestId,
      imageUrl: await this.objectStorage.createPresignedGetUrl(
        question.imageObjectKey,
      ),
      imageMimeType: question.imageMimeType,
      imageSizeBytes: question.imageSizeBytes,
      imageWidth: question.imageWidth,
      imageHeight: question.imageHeight,
      source: question.source,
      note: question.note,
      questionType: question.questionType,
      questionText: question.questionText,
      options: this.parseOptions(question.optionsJson),
      userAnswer: question.userAnswer,
      correctAnswer: question.correctAnswer,
      status: question.status,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    };
  }

  private parseOptions(
    value: Prisma.JsonValue | null,
  ): QuestionOptionDto[] | null {
    if (!Array.isArray(value)) {
      return null;
    }
    const options = value.flatMap((item) => {
      if (
        typeof item !== 'object' ||
        item === null ||
        Array.isArray(item) ||
        typeof item.label !== 'string' ||
        typeof item.text !== 'string'
      ) {
        return [];
      }
      return [{ label: item.label, text: item.text }];
    });
    return options;
  }

  private async deleteObjectBestEffort(
    objectKey: string,
    questionId: string,
  ): Promise<void> {
    try {
      await this.objectStorage.deleteObject(objectKey);
    } catch (error: unknown) {
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to compensate object upload for question ${questionId}`,
        stack,
      );
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private nullIfEmpty(value: string): string | null {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private notFound(): ApiException {
    return new ApiException(
      'QUESTION_NOT_FOUND',
      '错题不存在',
      HttpStatus.NOT_FOUND,
    );
  }
}
