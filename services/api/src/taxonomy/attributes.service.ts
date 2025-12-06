import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { slugify } from '@hos-marketplace/utils';
import { AttributeType } from '@prisma/client';

export interface CreateAttributeDto {
  name: string;
  type: AttributeType;
  isRequired?: boolean;
  isFilterable?: boolean;
  isSearchable?: boolean;
  isGlobal?: boolean;
  categoryId?: string;
}

export interface UpdateAttributeDto {
  name?: string;
  type?: AttributeType;
  isRequired?: boolean;
  isFilterable?: boolean;
  isSearchable?: boolean;
  isGlobal?: boolean;
  categoryId?: string;
}

export interface CreateAttributeValueDto {
  value: string;
  order?: number;
}

@Injectable()
export class AttributesService {
  constructor(private prisma: PrismaService) {}

  async createAttribute(data: CreateAttributeDto) {
    // Validate category if provided
    if (data.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: data.categoryId },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    // Generate unique slug
    const baseSlug = slugify(data.name);
    let slug = baseSlug;
    let counter = 1;

    while (await this.prisma.attribute.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return this.prisma.attribute.create({
      data: {
        name: data.name,
        slug,
        type: data.type,
        isRequired: data.isRequired || false,
        isFilterable: data.isFilterable !== undefined ? data.isFilterable : true,
        isSearchable: data.isSearchable || false,
        isGlobal: data.isGlobal || false,
        categoryId: data.categoryId,
      },
      include: {
        category: true,
        values: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async findAll(filters?: { categoryId?: string; isGlobal?: boolean; type?: AttributeType }) {
    const where: any = {};

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters?.isGlobal !== undefined) {
      where.isGlobal = filters.isGlobal;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    return this.prisma.attribute.findMany({
      where,
      include: {
        category: true,
        values: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: {
            productAttributes: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const attribute = await this.prisma.attribute.findUnique({
      where: { id },
      include: {
        category: true,
        values: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: {
            productAttributes: true,
          },
        },
      },
    });

    if (!attribute) {
      throw new NotFoundException('Attribute not found');
    }

    return attribute;
  }

  async updateAttribute(id: string, data: UpdateAttributeDto) {
    const attribute = await this.prisma.attribute.findUnique({
      where: { id },
    });

    if (!attribute) {
      throw new NotFoundException('Attribute not found');
    }

    // Validate category if provided
    if (data.categoryId !== undefined && data.categoryId !== attribute.categoryId) {
      if (data.categoryId) {
        const category = await this.prisma.category.findUnique({
          where: { id: data.categoryId },
        });

        if (!category) {
          throw new NotFoundException('Category not found');
        }
      }
    }

    // Update slug if name changed
    let slug = attribute.slug;
    if (data.name && data.name !== attribute.name) {
      const baseSlug = slugify(data.name);
      slug = baseSlug;
      let counter = 1;
      while (await this.prisma.attribute.findFirst({
        where: {
          slug,
          id: { not: id },
        },
      })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
    }

    return this.prisma.attribute.update({
      where: { id },
      data: {
        name: data.name,
        slug,
        type: data.type,
        isRequired: data.isRequired,
        isFilterable: data.isFilterable,
        isSearchable: data.isSearchable,
        isGlobal: data.isGlobal,
        categoryId: data.categoryId,
      },
      include: {
        category: true,
        values: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async deleteAttribute(id: string) {
    const attribute = await this.prisma.attribute.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            productAttributes: true,
          },
        },
      },
    });

    if (!attribute) {
      throw new NotFoundException('Attribute not found');
    }

    if (attribute._count.productAttributes > 0) {
      throw new BadRequestException('Cannot delete attribute that is used by products');
    }

    return this.prisma.attribute.delete({
      where: { id },
    });
  }

  async getAttributeValues(attributeId: string) {
    const attribute = await this.prisma.attribute.findUnique({
      where: { id: attributeId },
    });

    if (!attribute) {
      throw new NotFoundException('Attribute not found');
    }

    if (attribute.type !== 'SELECT') {
      throw new BadRequestException('Attribute values are only available for SELECT type attributes');
    }

    return this.prisma.attributeValue.findMany({
      where: { attributeId },
      orderBy: { order: 'asc' },
    });
  }

  async createAttributeValue(attributeId: string, data: CreateAttributeValueDto) {
    const attribute = await this.prisma.attribute.findUnique({
      where: { id: attributeId },
    });

    if (!attribute) {
      throw new NotFoundException('Attribute not found');
    }

    if (attribute.type !== 'SELECT') {
      throw new BadRequestException('Can only add values to SELECT type attributes');
    }

    // Generate unique slug
    const baseSlug = slugify(data.value);
    let slug = baseSlug;
    let counter = 1;

    while (await this.prisma.attributeValue.findFirst({
      where: {
        attributeId,
        slug,
      },
    })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return this.prisma.attributeValue.create({
      data: {
        attributeId,
        value: data.value,
        slug,
        order: data.order || 0,
      },
    });
  }

  async updateAttributeValue(id: string, data: { value?: string; order?: number }) {
    const attributeValue = await this.prisma.attributeValue.findUnique({
      where: { id },
    });

    if (!attributeValue) {
      throw new NotFoundException('Attribute value not found');
    }

    let slug = attributeValue.slug;
    if (data.value && data.value !== attributeValue.value) {
      const baseSlug = slugify(data.value);
      slug = baseSlug;
      let counter = 1;
      while (await this.prisma.attributeValue.findFirst({
        where: {
          attributeId: attributeValue.attributeId,
          slug,
          id: { not: id },
        },
      })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
    }

    return this.prisma.attributeValue.update({
      where: { id },
      data: {
        value: data.value,
        slug,
        order: data.order,
      },
    });
  }

  async deleteAttributeValue(id: string) {
    const attributeValue = await this.prisma.attributeValue.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            productAttributes: true,
          },
        },
      },
    });

    if (!attributeValue) {
      throw new NotFoundException('Attribute value not found');
    }

    if (attributeValue._count.productAttributes > 0) {
      throw new BadRequestException('Cannot delete attribute value that is used by products');
    }

    return this.prisma.attributeValue.delete({
      where: { id },
    });
  }

  async getAttributesForCategory(categoryId: string) {
    // Get global attributes + category-specific attributes
    const [globalAttributes, categoryAttributes] = await Promise.all([
      this.prisma.attribute.findMany({
        where: {
          isGlobal: true,
        },
        include: {
          values: {
            orderBy: { order: 'asc' },
          },
        },
      }),
      this.prisma.attribute.findMany({
        where: {
          categoryId,
          isGlobal: false,
        },
        include: {
          values: {
            orderBy: { order: 'asc' },
          },
        },
      }),
    ]);

    return {
      global: globalAttributes,
      categorySpecific: categoryAttributes,
      all: [...globalAttributes, ...categoryAttributes],
    };
  }
}

