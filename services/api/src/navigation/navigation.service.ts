import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

interface CreateNavigationItemDto {
  group: string;
  label: string;
  href: string;
  order?: number;
  isActive?: boolean;
  external?: boolean;
}

interface UpdateNavigationItemDto {
  group?: string;
  label?: string;
  href?: string;
  order?: number;
  isActive?: boolean;
  external?: boolean;
}

@Injectable()
export class NavigationService {
  private readonly logger = new Logger(NavigationService.name);

  constructor(private prisma: PrismaService) {}

  async findByGroup(group: string) {
    return this.prisma.navigationItem.findMany({
      where: { group, isActive: true },
      orderBy: { order: 'asc' },
    });
  }

  async findAll() {
    return this.prisma.navigationItem.findMany({
      orderBy: [{ group: 'asc' }, { order: 'asc' }],
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.navigationItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Navigation item not found');
    return item;
  }

  async create(dto: CreateNavigationItemDto) {
    return this.prisma.navigationItem.create({
      data: {
        group: dto.group,
        label: dto.label,
        href: dto.href,
        order: dto.order ?? 0,
        isActive: dto.isActive ?? true,
        external: dto.external ?? false,
      },
    });
  }

  async update(id: string, dto: UpdateNavigationItemDto) {
    await this.findOne(id);
    return this.prisma.navigationItem.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.navigationItem.delete({ where: { id } });
  }
}
