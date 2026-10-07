import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Parser = require('rss-parser');
import { PrismaService } from '../database/prisma.service';
import { categorize } from './fandom-news.categorizer';
import { extractMedia } from './fandom-news.media-extractor';
import { CreateSourceDto } from './dto/create-source.dto';
import { UpdateSourceDto } from './dto/update-source.dto';
import { ArticleQueryDto } from './dto/article-query.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

const PUBLIC_STATUSES = ['approved', 'featured'];

export interface FandomWorldItem {
  id: string;
  type: 'news' | 'event';
  title: string;
  excerpt: string;
  imageUrl: string | null;
  videoUrl: string | null;
  videoType: string | null;
  mediaType: string;
  date: string;
  categories: string[];
  sourceName?: string;
  sourceLogoUrl?: string;
  externalUrl?: string;
  eventType?: string;
  location?: string;
  slug?: string;
  isHOSEvent?: boolean;
}

type RssItem = {
  title?: string;
  link?: string;
  guid?: string;
  content?: string;
  contentSnippet?: string;
  isoDate?: string;
  pubDate?: string;
  creator?: string;
  author?: string;
  enclosure?: { url?: string; type?: string };
  [key: string]: any;
};

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function isNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function toExcerpt(content: string | undefined): string | null {
  if (!content) return null;
  const text = stripHtml(content);
  if (!text) return null;
  return text.slice(0, 200);
}

function marketVariants(market: string): string[] {
  return Array.from(new Set([market, market.toUpperCase(), market.toLowerCase()].filter(Boolean)));
}

function articleMarketWhere(market?: string): Prisma.FandomNewsArticleWhereInput {
  if (!market) return {};
  return {
    OR: [{ marketCodes: { isEmpty: true } }, { marketCodes: { hasSome: marketVariants(market) } }],
  };
}

function eventMarketWhere(market?: string): Prisma.EventWhereInput {
  if (!market) return {};
  return {
    OR: [{ marketCodes: { isEmpty: true } }, { marketCodes: { hasSome: marketVariants(market) } }],
  };
}

@Injectable()
export class FandomNewsService {
  private readonly logger = new Logger(FandomNewsService.name);
  private readonly parser = new Parser({
    timeout: 15000,
    customFields: {
      item: [
        ['media:content', 'media:content'],
        ['media:thumbnail', 'media:thumbnail'],
        ['content:encoded', 'content:encoded'],
      ],
    },
  });

  constructor(private readonly prisma: PrismaService) {}

  async findAllSources(filters?: { isActive?: boolean; market?: string }) {
    const where: Prisma.FandomNewsSourceWhereInput = {};
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.market) {
      where.OR = [
        { marketCodes: { isEmpty: true } },
        { marketCodes: { hasSome: marketVariants(filters.market) } },
      ];
    }

    const rows = await this.prisma.fandomNewsSource.findMany({
      where,
      include: { _count: { select: { articles: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map(({ _count, ...source }) => ({
      ...source,
      articleCount: _count.articles,
    }));
  }

  async findSource(id: string) {
    const source = await this.prisma.fandomNewsSource.findUnique({
      where: { id },
      include: { _count: { select: { articles: true } } },
    });
    if (!source) throw new NotFoundException('News source not found');
    const { _count, ...rest } = source;
    return { ...rest, articleCount: _count.articles };
  }

  async createSource(dto: CreateSourceDto) {
    try {
      return await this.prisma.fandomNewsSource.create({
        data: {
          name: dto.name,
          feedUrl: dto.feedUrl,
          feedType: dto.feedType ?? 'rss',
          logoUrl: dto.logoUrl,
          isActive: dto.isActive ?? true,
          marketCodes: dto.marketCodes ?? [],
          categories: dto.categories ?? [],
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('A source with this feed URL already exists');
      }
      throw error;
    }
  }

  async updateSource(id: string, dto: UpdateSourceDto) {
    await this.findSource(id);
    try {
      return await this.prisma.fandomNewsSource.update({
        where: { id },
        data: {
          name: dto.name,
          feedUrl: dto.feedUrl,
          feedType: dto.feedType,
          logoUrl: dto.logoUrl,
          isActive: dto.isActive,
          marketCodes: dto.marketCodes,
          categories: dto.categories,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('A source with this feed URL already exists');
      }
      throw error;
    }
  }

  async deleteSource(id: string) {
    try {
      await this.prisma.fandomNewsSource.delete({ where: { id } });
    } catch (error) {
      if (isNotFound(error)) throw new NotFoundException('News source not found');
      throw error;
    }
  }

  async fetchSource(sourceId: string) {
    const source = await this.prisma.fandomNewsSource.findUnique({ where: { id: sourceId } });
    if (!source) throw new NotFoundException('News source not found');
    try {
      return await this.ingestSource(source);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Failed to fetch feed: ${(error as Error).message}`);
    }
  }

  async fetchAllActiveSources() {
    const sources = await this.prisma.fandomNewsSource.findMany({ where: { isActive: true } });
    const results: Array<{
      ok: boolean;
      sourceId: string;
      name: string;
      created?: number;
      skipped?: number;
      error?: string;
    }> = [];

    for (const source of sources) {
      try {
        const result = await this.ingestSource(source);
        results.push({ ok: true, ...result });
      } catch (error) {
        const message = (error as Error).message;
        this.logger.warn(`Feed fetch failed for ${source.name}: ${message}`);
        results.push({ ok: false, sourceId: source.id, name: source.name, error: message });
      }
    }

    return results;
  }

  async findAllArticles(query: ArticleQueryDto, options?: { publicOnly?: boolean }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.FandomNewsArticleWhereInput = {};

    if (options?.publicOnly) {
      where.status =
        query.status && PUBLIC_STATUSES.includes(query.status)
          ? query.status
          : { in: PUBLIC_STATUSES };
    } else if (query.status) {
      where.status = query.status;
    }

    if (query.category) where.categories = { has: query.category };
    if (query.mediaType) where.mediaType = query.mediaType;
    if (query.sourceId) where.sourceId = query.sourceId;
    if (query.search) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { excerpt: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const marketWhere = articleMarketWhere(query.market);
    if (marketWhere.OR) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        marketWhere,
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.fandomNewsArticle.findMany({
        where,
        include: { source: { select: { id: true, name: true, logoUrl: true } } },
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.fandomNewsArticle.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findArticle(id: string, options?: { publicOnly?: boolean }) {
    const article = await this.prisma.fandomNewsArticle.findUnique({
      where: { id },
      include: { source: { select: { id: true, name: true, logoUrl: true, feedUrl: true } } },
    });
    if (!article) throw new NotFoundException('Article not found');
    if (options?.publicOnly && !PUBLIC_STATUSES.includes(article.status)) {
      throw new NotFoundException('Article not found');
    }
    return article;
  }

  async updateArticle(id: string, dto: UpdateArticleDto) {
    await this.findArticle(id);
    return this.prisma.fandomNewsArticle.update({
      where: { id },
      data: {
        status: dto.status,
        categories: dto.categories,
        marketCodes: dto.marketCodes,
        isPinned: dto.isPinned,
        videoUrl: dto.videoUrl,
        videoType: dto.videoType,
        mediaType: dto.mediaType,
        imageUrl: dto.imageUrl,
        title: dto.title,
        excerpt: dto.excerpt,
      },
    });
  }

  async bulkUpdateArticles(ids: string[], status: string) {
    const result = await this.prisma.fandomNewsArticle.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });
    return { updated: result.count };
  }

  async deleteArticle(id: string) {
    try {
      await this.prisma.fandomNewsArticle.delete({ where: { id } });
    } catch (error) {
      if (isNotFound(error)) throw new NotFoundException('Article not found');
      throw error;
    }
  }

  async trackClick(id: string) {
    try {
      return await this.prisma.fandomNewsArticle.update({
        where: { id },
        data: { clicks: { increment: 1 } },
        select: { id: true, clicks: true },
      });
    } catch (error) {
      if (isNotFound(error)) throw new NotFoundException('Article not found');
      throw error;
    }
  }

  async cleanupOldArticles(daysOld = 90) {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const result = await this.prisma.fandomNewsArticle.deleteMany({
      where: {
        status: 'auto',
        publishedAt: { lt: cutoff },
      },
    });
    return result.count;
  }

  async getUnifiedFeed(market?: string, limit = 6): Promise<FandomWorldItem[]> {
    const take = Math.min(Math.max(limit, 1), 50);
    const window = take * 3;

    const [articles, events] = await Promise.all([
      this.prisma.fandomNewsArticle.findMany({
        where: {
          status: { in: PUBLIC_STATUSES },
          ...articleMarketWhere(market),
        },
        include: { source: { select: { name: true, logoUrl: true } } },
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
        take: window,
      }),
      this.prisma.event.findMany({
        where: {
          showOnLanding: true,
          status: 'PUBLISHED',
          ...eventMarketWhere(market),
        },
        orderBy: [{ displayOrder: 'asc' }, { startsAt: 'desc' }],
        take: window,
        include: { fandom: { select: { name: true } } },
      }),
    ]);

    const pinned = articles
      .filter((article) => article.isPinned)
      .map((article) => this.toNewsItem(article))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const newsItems = articles
      .filter((article) => !article.isPinned)
      .map((article) => this.toNewsItem(article));

    const eventItems = events.map((event, index) => {
      const item = this.toEventItem(event);
      (item as any)._displayOrder = event.displayOrder ?? index;
      return item;
    });

    const rest: FandomWorldItem[] = [
      ...eventItems.sort((a, b) => ((b as any)._displayOrder ?? 0) - ((a as any)._displayOrder ?? 0)),
      ...newsItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    ];

    rest.forEach((item) => delete (item as any)._displayOrder);

    return [...pinned, ...rest].slice(0, take);
  }

  private toNewsItem(
    article: Prisma.FandomNewsArticleGetPayload<{
      include: { source: { select: { name: true; logoUrl: true } } };
    }>,
  ): FandomWorldItem {
    return {
      id: article.id,
      type: 'news',
      title: article.title,
      excerpt: article.excerpt ?? '',
      imageUrl: article.imageUrl,
      videoUrl: article.videoUrl,
      videoType: article.videoType,
      mediaType: article.mediaType,
      date: article.publishedAt.toISOString(),
      categories: article.categories,
      sourceName: article.source?.name,
      sourceLogoUrl: article.source?.logoUrl ?? undefined,
      externalUrl: article.externalUrl,
    };
  }

  private toEventItem(
    event: Prisma.EventGetPayload<{ include: { fandom: { select: { name: true } } } }>,
  ): FandomWorldItem {
    const categories = [...event.tags];
    if (event.fandom?.name && !categories.includes(event.fandom.name)) {
      categories.unshift(event.fandom.name);
    }
    const trailer = event.trailerUrl?.trim() || null;
    const youtubeId = trailer?.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/,
    )?.[1];
    return {
      id: event.id,
      type: 'event',
      title: event.title,
      excerpt:
        event.shortDescription ||
        (event.description ? stripHtml(event.description).slice(0, 200) : ''),
      imageUrl: event.imageUrl || event.bannerUrl,
      videoUrl: youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : trailer,
      videoType: youtubeId ? 'youtube' : trailer ? 'url' : null,
      mediaType: trailer ? 'video' : 'event',
      date: event.startsAt.toISOString(),
      categories,
      eventType: event.type,
      location: event.venueName || event.venueAddress || undefined,
      slug: event.slug,
      externalUrl: event.externalUrl || undefined,
      isHOSEvent: true,
    };
  }

  private async ingestSource(source: {
    id: string;
    name: string;
    feedUrl: string;
    categories: string[];
    marketCodes: string[];
  }) {
    let created = 0;
    let skipped = 0;

    try {
      const feed = await this.parser.parseURL(source.feedUrl);
      for (const item of (feed.items || []) as RssItem[]) {
        const outcome = await this.upsertFeedItem(source, item);
        if (outcome === 'created') created += 1;
        else skipped += 1;
      }

      await this.prisma.fandomNewsSource.update({
        where: { id: source.id },
        data: { lastFetchedAt: new Date(), errorCount: 0 },
      });

      return { sourceId: source.id, name: source.name, created, skipped };
    } catch (error) {
      await this.prisma.fandomNewsSource
        .update({
          where: { id: source.id },
          data: { errorCount: { increment: 1 } },
        })
        .catch((updateError) => {
          this.logger.warn(
            `Could not record feed error for ${source.id}: ${(updateError as Error).message}`,
          );
        });
      throw error;
    }
  }

  private async upsertFeedItem(
    source: { id: string; categories: string[]; marketCodes: string[] },
    item: RssItem,
  ): Promise<'created' | 'skipped'> {
    const externalUrl = this.externalUrlOf(item);
    const title = item.title?.trim();
    if (!externalUrl || !title) return 'skipped';

    const encoded = typeof item['content:encoded'] === 'string' ? item['content:encoded'] : '';
    const rawContent = encoded || item.content || item.contentSnippet || '';
    const excerpt = toExcerpt(rawContent) || toExcerpt(item.contentSnippet) || null;
    const media = extractMedia(item);
    const categories = Array.from(
      new Set([...categorize(title, stripHtml(rawContent)), ...source.categories]),
    );
    const publishedAt = this.publishedAtOf(item);
    const author = item.creator || item.author || null;

    try {
      await this.prisma.fandomNewsArticle.create({
        data: {
          sourceId: source.id,
          externalUrl,
          title,
          excerpt,
          imageUrl: media.imageUrl,
          videoUrl: media.videoUrl,
          videoType: media.videoType,
          mediaType: media.mediaType,
          author,
          publishedAt,
          categories,
          marketCodes: source.marketCodes,
          status: 'auto',
        },
      });
      return 'created';
    } catch (error) {
      if (isUniqueViolation(error)) return 'skipped';
      throw error;
    }
  }

  private externalUrlOf(item: RssItem): string | null {
    const link = item.link?.trim();
    if (link) return link;
    const guid = typeof item.guid === 'string' ? item.guid.trim() : '';
    if (guid.startsWith('http://') || guid.startsWith('https://')) return guid;
    return null;
  }

  private publishedAtOf(item: RssItem): Date {
    const raw = item.isoDate || item.pubDate;
    if (!raw) return new Date();
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }
}
