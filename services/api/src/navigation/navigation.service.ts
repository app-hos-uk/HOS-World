import { Injectable, NotFoundException, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CacheService } from '../cache/cache.service';

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
  private static readonly NAV_CACHE_PREFIX = 'navigation:group:';
  private static readonly NAV_CACHE_TTL = 300;

  constructor(
    private prisma: PrismaService,
    @Optional() private cache?: CacheService,
  ) {}

  async findByGroup(group: string) {
    const cacheKey = `${NavigationService.NAV_CACHE_PREFIX}${group}`;
    const cached = await this.cache?.get<any[]>(cacheKey);
    if (cached) return cached;

    const result = await this.prisma.navigationItem.findMany({
      where: { group, isActive: true },
      orderBy: { order: 'asc' },
    });

    await this.cache?.set(cacheKey, result, NavigationService.NAV_CACHE_TTL);
    return result;
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
    const result = await this.prisma.navigationItem.create({
      data: {
        group: dto.group,
        label: dto.label,
        href: dto.href,
        order: dto.order ?? 0,
        isActive: dto.isActive ?? true,
        external: dto.external ?? false,
      },
    });
    await this.invalidateNavCache(dto.group);
    return result;
  }

  async update(id: string, dto: UpdateNavigationItemDto) {
    const existing = await this.findOne(id);
    const result = await this.prisma.navigationItem.update({
      where: { id },
      data: dto,
    });
    await this.invalidateNavCache(existing.group);
    if (dto.group && dto.group !== existing.group) {
      await this.invalidateNavCache(dto.group);
    }
    return result;
  }

  async remove(id: string) {
    const existing = await this.findOne(id);
    const result = await this.prisma.navigationItem.delete({ where: { id } });
    await this.invalidateNavCache(existing.group);
    return result;
  }

  private async invalidateNavCache(group?: string) {
    if (!this.cache) return;
    if (group) {
      await this.cache.del(`${NavigationService.NAV_CACHE_PREFIX}${group}`);
    } else {
      await this.cache.delPattern(`${NavigationService.NAV_CACHE_PREFIX}*`);
    }
  }
}
