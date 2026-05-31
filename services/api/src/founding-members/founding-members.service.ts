import { Injectable, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateFoundingMemberDto } from './dto/create-founding-member.dto';

@Injectable()
export class FoundingMembersService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: CreateFoundingMemberDto, metadata?: Record<string, unknown>) {
    const existing = await this.prisma.foundingMember.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ConflictException('This email is already registered as a founding member.');
    }

    return this.prisma.foundingMember.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        firstName: dto.firstName.trim(),
        lastName: dto.lastName?.trim() || null,
        phone: dto.phone?.trim() || null,
        country: dto.country?.trim() || null,
        fandoms: dto.fandoms,
        otherFranchises: dto.otherFranchises?.trim() || null,
        source: dto.source?.trim() || null,
        spendBracket: dto.spendBracket?.trim() || null,
        metadata: (metadata || Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.foundingMember.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async linkToUser(email: string, userId: string) {
    const member = await this.findByEmail(email);
    if (!member) return null;
    return this.prisma.foundingMember.update({
      where: { id: member.id },
      data: { userId, status: 'LINKED' },
    });
  }

  async getStats() {
    const [total, byStatus, topFandoms] = await Promise.all([
      this.prisma.foundingMember.count(),
      this.prisma.foundingMember.groupBy({ by: ['status'], _count: true }),
      this.prisma.$queryRaw`
        SELECT unnest(fandoms) as fandom, COUNT(*) as count
        FROM founding_members
        GROUP BY fandom ORDER BY count DESC LIMIT 20
      ` as Promise<Array<{ fandom: string; count: bigint }>>,
    ]);

    return {
      total,
      byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
      topFandoms: topFandoms.map((f) => ({ fandom: f.fandom, count: Number(f.count) })),
    };
  }

  async findAll(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.foundingMember.findMany({
        skip,
        take: limit,
        orderBy: { registeredAt: 'desc' },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.foundingMember.count(),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
