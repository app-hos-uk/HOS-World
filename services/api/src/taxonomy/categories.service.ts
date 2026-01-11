import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { slugify } from '@hos-marketplace/utils';

export interface CreateCategoryDto {
  name: string;
  parentId?: string;
  description?: string;
  image?: string;
  order?: number;
  isActive?: boolean;
}

export interface UpdateCategoryDto {
  name?: string;
  parentId?: string;
  description?: string;
  image?: string;
  order?: number;
  isActive?: boolean;
}

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async createCategory(data: CreateCategoryDto) {
    // Validate parent if provided
    let parent: any = null;
    let level = 0;
    let path = '';

    if (data.parentId) {
      parent = await this.prisma.category.findUnique({
        where: { id: data.parentId },
      });

      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }

      if (parent.level >= 2) {
        throw new BadRequestException('Maximum category depth is 3 levels (0, 1, 2)');
      }

      level = parent.level + 1;
      path = parent.path ? `${parent.path}/${slugify(data.name)}` : `/${slugify(data.name)}`;
    } else {
      path = `/${slugify(data.name)}`;
    }

    // Generate unique slug
    const baseSlug = slugify(data.name);
    let slug = baseSlug;
    let counter = 1;

    while (await this.prisma.category.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return this.prisma.category.create({
      data: {
        name: data.name,
        slug,
        parentId: data.parentId,
        level,
        path,
        description: data.description,
        image: data.image,
        order: data.order || 0,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
      include: {
        parent: true,
        children: true,
        _count: {
          select: {
            products: true,
          },
        },
      },
    });
  }

  async findAll() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      include: {
        parent: true,
        children: {
          where: { isActive: true },
          include: {
            children: {
              where: { isActive: true },
            },
          },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: [
        { level: 'asc' },
        { order: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  async getCategoryTree() {
    // Get all root categories (level 0)
    const roots = await this.prisma.category.findMany({
      where: {
        isActive: true,
        level: 0,
      },
      include: {
        children: {
          where: { isActive: true },
          include: {
            children: {
              where: { isActive: true },
            },
          },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: [
        { order: 'asc' },
        { name: 'asc' },
      ],
    });

    return roots;
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: {
          include: {
            parent: true,
          },
        },
        children: {
          where: { isActive: true },
          include: {
            children: {
              where: { isActive: true },
            },
          },
        },
        attributes: {
          // Note: isActive field may not exist in schema - adjust based on actual schema
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async updateCategory(id: string, data: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Handle parent change
    let level = category.level;
    let path = category.path;

    if (data.parentId !== undefined && data.parentId !== category.parentId) {
      if (data.parentId === null) {
        // Moving to root
        level = 0;
        path = `/${slugify(data.name || category.name)}`;
      } else {
        const newParent = await this.prisma.category.findUnique({
          where: { id: data.parentId },
        });

        if (!newParent) {
          throw new NotFoundException('Parent category not found');
        }

        if (newParent.level >= 2) {
          throw new BadRequestException('Maximum category depth is 3 levels');
        }

        level = newParent.level + 1;
        path = newParent.path ? `${newParent.path}/${slugify(data.name || category.name)}` : `/${slugify(data.name || category.name)}`;
      }
    } else if (data.name && data.name !== category.name) {
      // Update path if name changed
      if (category.parentId) {
        const parent = await this.prisma.category.findUnique({
          where: { id: category.parentId },
        });
        path = parent?.path ? `${parent.path}/${slugify(data.name)}` : `/${slugify(data.name)}`;
      } else {
        path = `/${slugify(data.name)}`;
      }
    }

    // Update slug if name changed
    let slug = category.slug;
    if (data.name && data.name !== category.name) {
      const baseSlug = slugify(data.name);
      slug = baseSlug;
      let counter = 1;
      while (await this.prisma.category.findFirst({
        where: {
          slug,
          id: { not: id },
        },
      })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        name: data.name,
        slug,
        parentId: data.parentId,
        level,
        path,
        description: data.description,
        image: data.image,
        order: data.order,
        isActive: data.isActive,
      },
      include: {
        parent: true,
        children: true,
        _count: {
          select: {
            products: true,
          },
        },
      },
    });
  }

  async deleteCategory(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        children: true,
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (category.children.length > 0) {
      throw new BadRequestException('Cannot delete category with subcategories. Delete or move subcategories first.');
    }

    if (category._count.products > 0) {
      throw new BadRequestException('Cannot delete category with products. Reassign products first.');
    }

    return this.prisma.category.delete({
      where: { id },
    });
  }

  async getCategoryPath(id: string): Promise<string> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: {
          include: {
            parent: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category.path;
  }

  async validateCategoryLevel(parentId: string | null): Promise<number> {
    if (!parentId) {
      return 0;
    }

    const parent = await this.prisma.category.findUnique({
      where: { id: parentId },
    });

    if (!parent) {
      throw new NotFoundException('Parent category not found');
    }

    if (parent.level >= 2) {
      throw new BadRequestException('Maximum category depth is 3 levels');
    }

    return parent.level + 1;
  }
}

