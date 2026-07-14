import { Injectable } from '@nestjs/common';
import { KnowledgePointStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface KnowledgePointCandidate {
  id: string;
  code: string;
  name: string;
  parentCode: string | null;
}

@Injectable()
export class KnowledgePointsService {
  constructor(private readonly prisma: PrismaService) {}

  async listActiveCandidates(
    examId: string,
  ): Promise<KnowledgePointCandidate[]> {
    const items = await this.prisma.knowledgePoint.findMany({
      where: { examId, status: KnowledgePointStatus.ACTIVE },
      include: { parent: { select: { code: true } } },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
    });
    return items.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      parentCode: item.parent?.code ?? null,
    }));
  }

  async requireActiveCodes(examId: string, codes: string[]) {
    const uniqueCodes = [...new Set(codes)];
    const points = await this.prisma.knowledgePoint.findMany({
      where: {
        examId,
        status: KnowledgePointStatus.ACTIVE,
        code: { in: uniqueCodes },
      },
    });
    return points.length === uniqueCodes.length ? points : null;
  }
}
