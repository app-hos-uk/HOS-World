import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class CharactersService {
  constructor(private prisma: PrismaService) {}

  async findAll(fandomId?: string) {
    const where: any = { isActive: true };
    if (fandomId) {
      where.fandomId = fandomId;
    }

    return this.prisma.character.findMany({
      where,
      include: {
        fandom: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const character = await this.prisma.character.findUnique({
      where: { id },
      include: {
        fandom: true,
      },
    });

    if (!character) {
      throw new NotFoundException('Character not found');
    }

    return character;
  }

  async findByFandom(fandomSlug: string) {
    const fandom = await this.prisma.fandom.findUnique({
      where: { slug: fandomSlug },
    });

    if (!fandom) {
      throw new NotFoundException('Fandom not found');
    }

    return this.prisma.character.findMany({
      where: {
        fandomId: fandom.id,
        isActive: true,
      },
      include: {
        fandom: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }
}
