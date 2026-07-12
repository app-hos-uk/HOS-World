import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { slugify } from '@hos-marketplace/utils';
import { CreateUniverseDto } from './dto/create-universe.dto';
import { UpdateUniverseDto } from './dto/update-universe.dto';

@Injectable()
export class UniversesService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateUniqueSlug(name: string, excludeId?: string): Promise<string> {
    const baseSlug = slugify(name);
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.universe.findUnique({ where: { slug } });
      if (!existing || existing.id === excludeId) break;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  private serialize(universe: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    tag: string | null;
    description: string | null;
    accentColor: string | null;
    gradientColors: unknown;
    order: number;
    featured: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...universe,
      gradientColors: Array.isArray(universe.gradientColors)
        ? universe.gradientColors
        : universe.gradientColors
          ? (universe.gradientColors as string[])
          : [],
    };
  }

  async findActive() {
    const rows = await this.prisma.universe.findMany({
      where: { isActive: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
    return rows.map((row) => this.serialize(row));
  }

  async findAll() {
    const rows = await this.prisma.universe.findMany({
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
    return rows.map((row) => this.serialize(row));
  }

  async findOne(id: string) {
    const universe = await this.prisma.universe.findUnique({ where: { id } });
    if (!universe) throw new NotFoundException('Universe not found');
    return this.serialize(universe);
  }

  private async getNextOrder(): Promise<number> {
    const max = await this.prisma.universe.aggregate({ _max: { order: true } });
    return (max._max.order ?? -1) + 1;
  }

  async create(dto: CreateUniverseDto) {
    const slug = await this.generateUniqueSlug(dto.name);
    const order = await this.getNextOrder();
    const result = await this.prisma.universe.create({
      data: {
        name: dto.name,
        slug,
        logo: dto.logo,
        tag: dto.tag,
        description: dto.description,
        accentColor: dto.accentColor,
        gradientColors: dto.gradientColors ?? [],
        order,
        featured: dto.featured ?? false,
        isActive: dto.isActive ?? true,
      },
    });
    return this.serialize(result);
  }

  async update(id: string, dto: UpdateUniverseDto) {
    const existing = await this.prisma.universe.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Universe not found');

    let slug = existing.slug;
    if (dto.name && dto.name !== existing.name) {
      slug = await this.generateUniqueSlug(dto.name, id);
    }

    const result = await this.prisma.universe.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.logo !== undefined ? { logo: dto.logo } : {}),
        ...(dto.tag !== undefined ? { tag: dto.tag } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.accentColor !== undefined ? { accentColor: dto.accentColor } : {}),
        ...(dto.gradientColors !== undefined ? { gradientColors: dto.gradientColors } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
        ...(dto.featured !== undefined ? { featured: dto.featured } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        slug,
      },
    });
    return this.serialize(result);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.universe.delete({ where: { id } });
  }

  async reorder(orderedIds: string[]) {
    if (!orderedIds.length) {
      throw new BadRequestException('orderedIds must not be empty');
    }

    const existing = await this.prisma.universe.findMany({
      where: { id: { in: orderedIds } },
      select: { id: true },
    });

    if (existing.length !== orderedIds.length) {
      throw new BadRequestException('One or more universe IDs are invalid');
    }

    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.universe.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );

    return this.findAll();
  }
}
