import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class FandomsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Returns fandoms for the public list (Navigation → Fandoms).
   * Uses level-0 Categories so the list matches what Admin creates in Admin → Fandoms.
   * Products are linked to Categories; the Fandom table is legacy/characters.
   */
  async findAll() {
    const categories = await this.prisma.category.findMany({
      where: { level: 0, isActive: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, image: true, description: true },
    });
    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      image: c.image ?? undefined,
      description: c.description ?? undefined,
    }));
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
