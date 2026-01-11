import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class CollectionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, includePublic: boolean = false) {
    const where: any = {};
    
    if (includePublic) {
      where.OR = [
        { userId },
        { isPublic: true },
      ];
    } else {
      where.userId = userId;
    }

    const collections = await this.prisma.collection.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate item counts
    return collections.map((collection) => ({
      ...collection,
      itemCount: Array.isArray(collection.items) ? (collection.items as any[]).length : 0,
    }));
  }

  async findOne(id: string, userId: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    // Check if user can access (owner or public)
    if (collection.userId !== userId && !collection.isPublic) {
      throw new ForbiddenException('You do not have access to this collection');
    }

    const items = Array.isArray(collection.items) ? (collection.items as any[]) : [];
    
    return {
      ...collection,
      itemCount: items.length,
    };
  }

  async create(userId: string, data: { name: string; description?: string; isPublic?: boolean }) {
    return this.prisma.collection.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        isPublic: data.isPublic || false,
        items: [],
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async update(id: string, userId: string, data: { name?: string; description?: string; isPublic?: boolean }) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    if (collection.userId !== userId) {
      throw new ForbiddenException('You can only update your own collections');
    }

    return this.prisma.collection.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async delete(id: string, userId: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    if (collection.userId !== userId) {
      throw new ForbiddenException('You can only delete your own collections');
    }

    await this.prisma.collection.delete({
      where: { id },
    });

    return { message: 'Collection deleted successfully' };
  }

  async addProduct(collectionId: string, userId: string, productId: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    if (collection.userId !== userId) {
      throw new ForbiddenException('You can only modify your own collections');
    }

    const items = Array.isArray(collection.items) ? (collection.items as any[]) : [];
    
    // Check if product already exists
    if (items.some((item: any) => item.productId === productId)) {
      throw new ForbiddenException('Product already in collection');
    }

    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, images: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    items.push({
      productId: product.id,
      productName: product.name,
      addedAt: new Date().toISOString(),
    });

    return this.prisma.collection.update({
      where: { id: collectionId },
      data: { items: items as any },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async removeProduct(collectionId: string, userId: string, productId: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    if (collection.userId !== userId) {
      throw new ForbiddenException('You can only modify your own collections');
    }

    const items = Array.isArray(collection.items) ? (collection.items as any[]) : [];
    const filteredItems = items.filter((item: any) => item.productId !== productId);

    return this.prisma.collection.update({
      where: { id: collectionId },
      data: { items: filteredItems as any },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }
}
