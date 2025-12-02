import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class FandomsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.fandom.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            characters: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const fandom = await this.prisma.fandom.findUnique({
      where: { id },
      include: {
        characters: {
          where: { isActive: true },
        },
      },
    });

    if (!fandom) {
      throw new NotFoundException('Fandom not found');
    }

    return fandom;
  }

  async findBySlug(slug: string) {
    const fandom = await this.prisma.fandom.findUnique({
      where: { slug },
      include: {
        characters: {
          where: { isActive: true },
        },
      },
    });

    if (!fandom) {
      throw new NotFoundException('Fandom not found');
    }

    return fandom;
  }
}

