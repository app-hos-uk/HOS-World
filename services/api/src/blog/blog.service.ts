import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BlogStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { slugify } from '@hos-marketplace/utils';
import * as sanitizeHtmlModule from 'sanitize-html';

// Handle both ESM and CommonJS imports
const sanitizeHtml = (sanitizeHtmlModule as any).default || sanitizeHtmlModule;

// Explicit allowed tags (sanitize-html defaults + additional tags for blog content)
const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a', 'b', 'i', 'u', 's', 'em', 'strong', 'mark', 'small', 'del', 'ins', 'sub', 'sup',
  'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  'div', 'span',
];

const SANITIZE_OPTIONS: sanitizeHtmlModule.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    td: ['colspan', 'rowspan', 'align', 'valign'],
    th: ['colspan', 'rowspan', 'align', 'valign'],
    div: ['class', 'id'],
    span: ['class', 'id'],
    pre: ['class'],
    code: ['class'],
    '*': ['style'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
};

@Injectable()
export class BlogService {
  constructor(private prisma: PrismaService) {}

  private sanitizeContent(html: string): string {
    return sanitizeHtml(html, SANITIZE_OPTIONS);
  }

  private calculateReadingTime(content: string): number {
    const text = content.replace(/<[^>]*>/g, ' ');
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
  }

  private async ensureUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.blogPost.findFirst({
        where: {
          slug,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });
      if (!existing) return slug;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  private async ensureUniqueCategorySlug(baseSlug: string, excludeId?: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.blogCategory.findFirst({
        where: {
          slug,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });
      if (!existing) return slug;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  // ── Public ──────────────────────────────────────────────────────────

  async getPublishedPosts(filters?: {
    categorySlug?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const where: Prisma.BlogPostWhereInput = {
      status: BlogStatus.PUBLISHED,
      publishedAt: { not: null },
    };

    if (filters?.categorySlug) {
      where.category = { slug: filters.categorySlug };
    }

    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { excerpt: { contains: filters.search, mode: 'insensitive' } },
        { content: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 12;
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        include: { category: true },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.blogPost.count({ where }),
    ]);

    return { posts, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getPublishedPostBySlug(slug: string) {
    const post = await this.prisma.blogPost.findFirst({
      where: { slug, status: BlogStatus.PUBLISHED, publishedAt: { not: null } },
      include: { category: true },
    });

    if (!post) throw new NotFoundException('Blog post not found');
    return post;
  }

  async getRelatedPosts(postId: string, categoryId: string | null, limit = 3) {
    if (!categoryId) return [];

    return this.prisma.blogPost.findMany({
      where: {
        id: { not: postId },
        categoryId,
        status: BlogStatus.PUBLISHED,
        publishedAt: { not: null },
      },
      include: { category: true },
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });
  }

  async getCategories() {
    return this.prisma.blogCategory.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            posts: {
              where: { status: BlogStatus.PUBLISHED },
            },
          },
        },
      },
    });
  }

  async getCategoryBySlug(slug: string) {
    const category = await this.prisma.blogCategory.findUnique({
      where: { slug },
      include: {
        _count: {
          select: {
            posts: {
              where: { status: BlogStatus.PUBLISHED },
            },
          },
        },
      },
    });

    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async searchPosts(query: string, categorySlug?: string) {
    return this.getPublishedPosts({ search: query, categorySlug, limit: 20 });
  }

  // ── Admin ───────────────────────────────────────────────────────────

  async getAllPosts(limit = 100) {
    return this.prisma.blogPost.findMany({
      include: { category: true },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  async getPostById(id: string) {
    const post = await this.prisma.blogPost.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!post) throw new NotFoundException('Blog post not found');
    return post;
  }

  async createPost(data: {
    title: string;
    slug?: string;
    excerpt: string;
    content: string;
    coverImage?: string;
    coverImageAlt?: string;
    coverImageTitle?: string;
    author: string;
    seoTitle?: string;
    metaDescription?: string;
    focusKeyword?: string;
    canonicalUrl?: string;
    categoryId?: string;
    status?: BlogStatus;
  }) {
    const baseSlug = data.slug?.trim() || slugify(data.title);
    if (!baseSlug) throw new BadRequestException('A valid slug is required');

    const slug = await this.ensureUniqueSlug(baseSlug);
    const contentHtml = this.sanitizeContent(data.content);
    const readingTime = this.calculateReadingTime(contentHtml);

    return this.prisma.blogPost.create({
      data: {
        title: data.title,
        slug,
        excerpt: data.excerpt,
        content: contentHtml,
        contentHtml,
        coverImage: data.coverImage,
        coverImageAlt: data.coverImageAlt,
        coverImageTitle: data.coverImageTitle,
        author: data.author,
        seoTitle: data.seoTitle,
        metaDescription: data.metaDescription,
        focusKeyword: data.focusKeyword,
        canonicalUrl: data.canonicalUrl,
        categoryId: data.categoryId || null,
        status: data.status || BlogStatus.DRAFT,
        readingTime,
        publishedAt: data.status === BlogStatus.PUBLISHED ? new Date() : null,
      },
      include: { category: true },
    });
  }

  async updatePost(
    id: string,
    data: {
      title?: string;
      slug?: string;
      excerpt?: string;
      content?: string;
      coverImage?: string;
      coverImageAlt?: string;
      coverImageTitle?: string;
      author?: string;
      seoTitle?: string;
      metaDescription?: string;
      focusKeyword?: string;
      canonicalUrl?: string;
      categoryId?: string | null;
      status?: BlogStatus;
    },
  ) {
    const post = await this.getPostById(id);

    let slug = post.slug;
    if (data.slug && data.slug !== post.slug) {
      slug = await this.ensureUniqueSlug(slugify(data.slug), id);
    } else if (data.title && data.title !== post.title && !data.slug) {
      slug = await this.ensureUniqueSlug(slugify(data.title), id);
    }

    const { content, ...updateFields } = data;
    const sanitizedContent = content !== undefined ? this.sanitizeContent(content) : undefined;
    const readingTime =
      sanitizedContent !== undefined ? this.calculateReadingTime(sanitizedContent) : undefined;

    let publishedAt = post.publishedAt;
    if (data.status === BlogStatus.PUBLISHED && !post.publishedAt) {
      publishedAt = new Date();
    } else if (data.status === BlogStatus.DRAFT) {
      publishedAt = null;
    }

    return this.prisma.blogPost.update({
      where: { id },
      data: {
        ...updateFields,
        slug,
        ...(sanitizedContent !== undefined
          ? { content: sanitizedContent, contentHtml: sanitizedContent }
          : {}),
        ...(readingTime !== undefined ? { readingTime } : {}),
        publishedAt,
      },
      include: { category: true },
    });
  }

  async deletePost(id: string) {
    await this.getPostById(id);
    return this.prisma.blogPost.delete({ where: { id } });
  }

  async publishPost(id: string) {
    return this.updatePost(id, { status: BlogStatus.PUBLISHED });
  }

  async unpublishPost(id: string) {
    return this.updatePost(id, { status: BlogStatus.DRAFT });
  }

  async createCategory(data: { name: string; slug?: string; description?: string }) {
    const baseSlug = data.slug?.trim() || slugify(data.name);
    const slug = await this.ensureUniqueCategorySlug(baseSlug);

    return this.prisma.blogCategory.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
      },
    });
  }

  async updateCategory(
    id: string,
    data: { name?: string; slug?: string; description?: string },
  ) {
    const category = await this.prisma.blogCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');

    let slug = category.slug;
    if (data.slug && data.slug !== category.slug) {
      slug = await this.ensureUniqueCategorySlug(slugify(data.slug), id);
    } else if (data.name && data.name !== category.name && !data.slug) {
      slug = await this.ensureUniqueCategorySlug(slugify(data.name), id);
    }

    return this.prisma.blogCategory.update({
      where: { id },
      data: { ...data, slug },
    });
  }

  async deleteCategory(id: string) {
    const category = await this.prisma.blogCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');

    await this.prisma.blogPost.updateMany({
      where: { categoryId: id },
      data: { categoryId: null },
    });

    return this.prisma.blogCategory.delete({ where: { id } });
  }

  async getAllCategories() {
    return this.prisma.blogCategory.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { posts: true } } },
    });
  }
}
