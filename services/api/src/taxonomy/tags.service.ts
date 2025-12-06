import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { slugify } from '@hos-marketplace/utils';
import { TagCategory } from '@prisma/client';

export interface CreateTagDto {
  name: string;
  category: TagCategory;
  description?: string;
  synonyms?: string[];
  isActive?: boolean;
}

export interface UpdateTagDto {
  name?: string;
  category?: TagCategory;
  description?: string;
  synonyms?: string[];
  isActive?: boolean;
}

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  async createTag(data: CreateTagDto) {
    // Generate unique slug
    const baseSlug = slugify(data.name);
    let slug = baseSlug;
    let counter = 1;

    while (await this.prisma.tag.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return this.prisma.tag.create({
      data: {
        name: data.name,
        slug,
        category: data.category,
        description: data.description,
        synonyms: data.synonyms || [],
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });
  }

  async findAll(filters?: { category?: TagCategory; isActive?: boolean; search?: string }) {
    const where: any = {};

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { synonyms: { has: filters.search } },
      ];
    }

    return this.prisma.tag.findMany({
      where,
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return tag;
  }

  async updateTag(id: string, data: UpdateTagDto) {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    // Update slug if name changed
    let slug = tag.slug;
    if (data.name && data.name !== tag.name) {
      const baseSlug = slugify(data.name);
      slug = baseSlug;
      let counter = 1;
      while (await this.prisma.tag.findFirst({
        where: {
          slug,
          id: { not: id },
        },
      })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
    }

    return this.prisma.tag.update({
      where: { id },
      data: {
        name: data.name,
        slug,
        category: data.category,
        description: data.description,
        synonyms: data.synonyms,
        isActive: data.isActive,
      },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });
  }

  async deleteTag(id: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    // Note: We allow deletion even if tag is used by products
    // The ProductTag junction will be deleted via cascade
    return this.prisma.tag.delete({
      where: { id },
    });
  }

  async searchTags(query: string) {
    return this.prisma.tag.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { synonyms: { has: query } },
        ],
      },
      take: 20,
      orderBy: {
        _relevance: {
          fields: ['name'],
          search: query,
          sort: 'asc',
        },
      },
    });
  }

  async getTagsByCategory(category: TagCategory) {
    return this.prisma.tag.findMany({
      where: {
        category,
        isActive: true,
      },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }
}

