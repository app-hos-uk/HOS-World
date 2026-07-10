import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface CreateDepartmentDto {
  name: string;
  slug?: string;
  description?: string;
  meta?: string;
  ctaText?: string;
  ctaUrl: string;
  iconSvg?: string;
  image?: string;
  order?: number;
  isActive?: boolean;
  categoryId?: string;
}

export interface UpdateDepartmentDto {
  name?: string;
  slug?: string;
  description?: string;
  meta?: string;
  ctaText?: string;
  ctaUrl?: string;
  iconSvg?: string;
  image?: string;
  order?: number;
  isActive?: boolean;
  categoryId?: string | null;
}

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  async findAll() {
    return this.prisma.department.findMany({
      orderBy: { order: 'asc' },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
  }

  async findActive() {
    return this.prisma.department.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
  }

  async findOne(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  async create(dto: CreateDepartmentDto) {
    const slug = dto.slug || this.slugify(dto.name);

    const existing = await this.prisma.department.findUnique({ where: { slug } });
    if (existing) throw new ConflictException(`Department with slug "${slug}" already exists`);

    if (dto.categoryId) {
      const cat = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!cat) throw new NotFoundException('Linked category not found');
    }

    return this.prisma.department.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        meta: dto.meta,
        ctaText: dto.ctaText,
        ctaUrl: dto.ctaUrl,
        iconSvg: dto.iconSvg,
        image: dto.image,
        order: dto.order ?? 0,
        isActive: dto.isActive ?? true,
        categoryId: dto.categoryId || null,
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Department not found');

    if (dto.slug && dto.slug !== existing.slug) {
      const conflict = await this.prisma.department.findUnique({ where: { slug: dto.slug } });
      if (conflict) throw new ConflictException(`Department with slug "${dto.slug}" already exists`);
    }

    if (dto.categoryId) {
      const cat = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!cat) throw new NotFoundException('Linked category not found');
    }

    return this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.meta !== undefined && { meta: dto.meta }),
        ...(dto.ctaText !== undefined && { ctaText: dto.ctaText }),
        ...(dto.ctaUrl !== undefined && { ctaUrl: dto.ctaUrl }),
        ...(dto.iconSvg !== undefined && { iconSvg: dto.iconSvg }),
        ...(dto.image !== undefined && { image: dto.image }),
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Department not found');

    return this.prisma.department.delete({ where: { id } });
  }

  async reorder(orderedIds: string[]) {
    const updates = orderedIds.map((id, index) =>
      this.prisma.department.update({ where: { id }, data: { order: index } }),
    );
    await this.prisma.$transaction(updates);
    return this.findAll();
  }
}
