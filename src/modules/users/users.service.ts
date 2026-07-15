import { HttpStatus, Injectable } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { ApiException } from '../../common/exceptions/api.exception';
import { PrismaService } from '../../database/prisma.service';
import type { CurrentUserDto } from './dto/current-user.dto';
import type {
  CreateFeedbackDto,
  FeedbackResponseDto,
} from './dto/feedback.dto';
import type {
  ProfileResponseDto,
  UserDataSummaryDto,
} from './dto/profile-response.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentUser(userId: string): Promise<CurrentUserDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE },
      select: {
        id: true,
        nickname: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new ApiException(
        'USER_NOT_FOUND',
        '用户不存在',
        HttpStatus.NOT_FOUND,
      );
    }

    return user;
  }

  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE },
      select: {
        id: true,
        nickname: true,
        avatarUrl: true,
        examTargetName: true,
        examDate: true,
        reminderEnabled: true,
        reminderTime: true,
        createdAt: true,
      },
    });
    if (!user) throw this.notFound();
    const [totalQuestions, completedReviews, studyDates] = await Promise.all([
      this.prisma.question.count({
        where: { userId, status: { not: 'DELETED' } },
      }),
      this.prisma.reviewTask.count({
        where: { userId, status: 'COMPLETED' },
      }),
      this.getStudyDates(userId),
    ]);
    return {
      ...user,
      stats: {
        totalQuestions,
        completedReviews,
        studyDays: studyDates.length,
        streakDays: this.calculateStreak(studyDates),
      },
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    if (Object.keys(dto).length === 0) {
      throw new ApiException(
        'PROFILE_UPDATE_EMPTY',
        '请至少提供一个需要更新的字段',
        HttpStatus.BAD_REQUEST,
      );
    }
    const updated = await this.prisma.user.updateMany({
      where: { id: userId, status: UserStatus.ACTIVE },
      data: {
        ...(dto.nickname !== undefined
          ? { nickname: this.nullIfEmpty(dto.nickname) }
          : {}),
        ...(dto.avatarUrl !== undefined
          ? { avatarUrl: this.nullIfEmpty(dto.avatarUrl) }
          : {}),
        ...(dto.examTargetName !== undefined
          ? { examTargetName: this.nullIfEmpty(dto.examTargetName) }
          : {}),
        ...(dto.examDate !== undefined ? { examDate: dto.examDate } : {}),
        ...(dto.reminderEnabled !== undefined
          ? { reminderEnabled: dto.reminderEnabled }
          : {}),
        ...(dto.reminderTime !== undefined
          ? { reminderTime: dto.reminderTime }
          : {}),
      },
    });
    if (updated.count !== 1) throw this.notFound();
    return this.getProfile(userId);
  }

  async getDataSummary(userId: string): Promise<UserDataSummaryDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE },
      select: { createdAt: true },
    });
    if (!user) throw this.notFound();
    const [questions, analyses, reviewTasks, reviewAttempts, feedback] =
      await this.prisma.$transaction([
        this.prisma.question.count({ where: { userId } }),
        this.prisma.analysis.count({ where: { question: { userId } } }),
        this.prisma.reviewTask.count({ where: { userId } }),
        this.prisma.reviewAttempt.count({
          where: { reviewTask: { userId } },
        }),
        this.prisma.feedback.count({ where: { userId } }),
      ]);
    return {
      accountCreatedAt: user.createdAt,
      questions,
      analyses,
      reviewTasks,
      reviewAttempts,
      feedback,
    };
  }

  async createFeedback(
    userId: string,
    dto: CreateFeedbackDto,
  ): Promise<FeedbackResponseDto> {
    const content = dto.content.trim();
    if (content.length < 5) {
      throw new ApiException(
        'FEEDBACK_CONTENT_TOO_SHORT',
        '请更具体地描述你的反馈',
        HttpStatus.BAD_REQUEST,
      );
    }
    const feedback = await this.prisma.feedback.create({
      data: {
        userId,
        category: dto.category,
        content,
        contact: dto.contact?.trim() || null,
      },
      select: { id: true, status: true, createdAt: true },
    });
    return feedback;
  }

  async deleteCurrentUser(userId: string): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (transaction) => {
      const deleted = await transaction.user.updateMany({
        where: { id: userId, status: UserStatus.ACTIVE },
        data: { status: UserStatus.DELETED, deletedAt: now },
      });
      if (deleted.count !== 1) {
        throw new ApiException(
          'USER_NOT_FOUND',
          '用户不存在',
          HttpStatus.NOT_FOUND,
        );
      }

      await transaction.refreshSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
    });
  }

  private getStudyDates(userId: string): Promise<Array<{ date: Date }>> {
    return this.prisma.$queryRaw<Array<{ date: Date }>>`
      SELECT DISTINCT date_trunc('day', activity_at AT TIME ZONE 'Asia/Shanghai') AS date
      FROM (
        SELECT created_at AS activity_at FROM questions WHERE user_id = ${userId}::uuid AND deleted_at IS NULL
        UNION ALL
        SELECT completed_at AS activity_at FROM review_tasks WHERE user_id = ${userId}::uuid AND completed_at IS NOT NULL
      ) activity
      ORDER BY date DESC
    `;
  }

  private calculateStreak(
    rows: Array<{ date: Date }>,
    now = new Date(),
  ): number {
    const keys = new Set(rows.map(({ date }) => this.dayKey(date)));
    const today = this.startOfShanghaiDay(now);
    let cursor = today;
    if (!keys.has(this.dayKey(cursor)))
      cursor = new Date(cursor.getTime() - 86400000);
    let streak = 0;
    while (keys.has(this.dayKey(cursor))) {
      streak += 1;
      cursor = new Date(cursor.getTime() - 86400000);
    }
    return streak;
  }

  private startOfShanghaiDay(now: Date): Date {
    const local = new Date(now.getTime() + 8 * 3600000);
    local.setUTCHours(0, 0, 0, 0);
    return new Date(local.getTime() - 8 * 3600000);
  }

  private dayKey(date: Date): string {
    return new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10);
  }

  private nullIfEmpty(value: string): string | null {
    const trimmed = value.trim();
    return trimmed || null;
  }

  private notFound(): ApiException {
    return new ApiException(
      'USER_NOT_FOUND',
      '用户不存在',
      HttpStatus.NOT_FOUND,
    );
  }
}
