import { HttpStatus, Injectable } from '@nestjs/common';
import { ExamStatus } from '@prisma/client';
import { ApiException } from '../../common/exceptions/api.exception';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ExamsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDefaultExam(): Promise<{ id: string; code: string; name: string }> {
    const exam = await this.prisma.exam.findFirst({
      where: { code: 'exam_civil_service', status: ExamStatus.ACTIVE },
      select: { id: true, code: true, name: true },
    });
    if (!exam) {
      throw new ApiException(
        'EXAM_CONFIGURATION_MISSING',
        '考试分类尚未配置',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return exam;
  }
}
