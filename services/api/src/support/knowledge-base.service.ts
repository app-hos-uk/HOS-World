import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class KnowledgeBaseService {
  constructor(private prisma: PrismaService) {}

  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }

  async createArticle(data: {
    title: string;
    content: string;
    category: string;
    tags?: string[];
    isPublished?: boolean;
    createdBy: string;
  }) {
    const baseSlug = this.slugify(data.title);
    let slug = baseSlug;
    let counter = 1;

    while (await this.prisma.knowledgeBaseArticle.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return this.prisma.knowledgeBaseArticle.create({
      data: {
        title: data.title,
        slug,
        content: data.content,
        category: data.category,
        tags: data.tags || [],
        isPublished: data.isPublished || false,
        createdBy: data.createdBy,
      },
    });
  }

  async updateArticle(
    id: string,
    data: {
      title?: string;
      content?: string;
      category?: string;
      tags?: string[];
      isPublished?: boolean;
    },
  ) {
    const article = await this.prisma.knowledgeBaseArticle.findUnique({
      where: { id },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    let slug = article.slug;
    if (data.title && data.title !== article.title) {
      const baseSlug = this.slugify(data.title);
      slug = baseSlug;
      let counter = 1;

      while (
        await this.prisma.knowledgeBaseArticle.findFirst({
          where: { slug, id: { not: id } },
        })
      ) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
    }

    return this.prisma.knowledgeBaseArticle.update({
      where: { id },
      data: {
        ...data,
        slug,
      },
    });
  }

  async getArticles(filters?: {
    category?: string;
    tags?: string[];
    isPublished?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const where: any = {};

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.tags && filters.tags.length > 0) {
      where.tags = {
        hasSome: filters.tags,
      };
    }

    if (filters?.isPublished !== undefined) {
      where.isPublished = filters.isPublished;
    }

    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { content: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const [articles, total] = await Promise.all([
      this.prisma.knowledgeBaseArticle.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.knowledgeBaseArticle.count({ where }),
    ]);

    return {
      articles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async searchArticles(query: string, filters?: {
    category?: string;
    tags?: string[];
    limit?: number;
  }) {
    const where: any = {
      isPublished: true,
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } },
        { tags: { has: query } },
      ],
    };

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.tags && filters.tags.length > 0) {
      where.tags = {
        hasSome: filters.tags,
      };
    }

    const limit = filters?.limit || 10;

    return this.prisma.knowledgeBaseArticle.findMany({
      where,
      orderBy: {
        views: 'desc',
      },
      take: limit,
    });
  }

  async getArticleById(id: string) {
    const article = await this.prisma.knowledgeBaseArticle.findUnique({
      where: { id },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    // Increment view count
    await this.prisma.knowledgeBaseArticle.update({
      where: { id },
      data: {
        views: article.views + 1,
      },
    });

    return {
      ...article,
      views: article.views + 1,
    };
  }

  async getArticleBySlug(slug: string) {
    const article = await this.prisma.knowledgeBaseArticle.findUnique({
      where: { slug },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    if (!article.isPublished) {
      throw new NotFoundException('Article not published');
    }

    // Increment view count
    await this.prisma.knowledgeBaseArticle.update({
      where: { slug },
      data: {
        views: article.views + 1,
      },
    });

    return {
      ...article,
      views: article.views + 1,
    };
  }

  async markArticleHelpful(id: string) {
    const article = await this.prisma.knowledgeBaseArticle.findUnique({
      where: { id },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    return this.prisma.knowledgeBaseArticle.update({
      where: { id },
      data: {
        helpful: article.helpful + 1,
      },
    });
  }
}

