import { HttpStatus, Injectable } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { ApiException } from '../../common/exceptions/api.exception';
import { PrismaService } from '../../database/prisma.service';
import type { CurrentUserDto } from './dto/current-user.dto';

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
}
