import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import { PrismaService } from '../database/prisma.service';

describe('KnowledgeBaseService', () => {
  let service: KnowledgeBaseService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    knowledgeBaseArticle: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeBaseService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<KnowledgeBaseService>(KnowledgeBaseService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('createArticle', () => {
    const articleData = {
      title: 'Test Article',
      content: 'Article content',
      category: 'FAQ',
      tags: ['help', 'support'],
      createdBy: 'user-1',
    };

    it('should create article successfully', async () => {
      const mockArticle = {
        id: 'article-1',
        slug: 'test-article',
        ...articleData,
        views: 0,
        helpful: 0,
      };

      mockPrismaService.knowledgeBaseArticle.findUnique.mockResolvedValue(null);
      mockPrismaService.knowledgeBaseArticle.create.mockResolvedValue(mockArticle);

      const result = await service.createArticle(articleData);

      expect(mockPrismaService.knowledgeBaseArticle.create).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('slug');
    });

    it('should generate unique slug if duplicate exists', async () => {
      mockPrismaService.knowledgeBaseArticle.findUnique
        .mockResolvedValueOnce({ id: 'existing' })
        .mockResolvedValueOnce(null);
      mockPrismaService.knowledgeBaseArticle.create.mockResolvedValue({
        id: 'article-1',
        slug: 'test-article-1',
      });

      const result = await service.createArticle(articleData);

      expect(result.slug).toBe('test-article-1');
    });
  });

  describe('updateArticle', () => {
    it('should update article successfully', async () => {
      const articleId = 'article-1';
      const updateData = {
        title: 'Updated Title',
        content: 'Updated content',
      };
      const mockArticle = {
        id: articleId,
        title: 'Original Title',
        slug: 'original-title',
      };
      const updatedArticle = {
        ...mockArticle,
        ...updateData,
        slug: 'updated-title',
      };

      mockPrismaService.knowledgeBaseArticle.findUnique.mockResolvedValue(mockArticle);
      mockPrismaService.knowledgeBaseArticle.findFirst.mockResolvedValue(null);
      mockPrismaService.knowledgeBaseArticle.update.mockResolvedValue(updatedArticle);

      const result = await service.updateArticle(articleId, updateData);

      expect(mockPrismaService.knowledgeBaseArticle.update).toHaveBeenCalled();
      expect(result.title).toBe(updateData.title);
    });

    it('should throw NotFoundException if article not found', async () => {
      mockPrismaService.knowledgeBaseArticle.findUnique.mockResolvedValue(null);

      await expect(service.updateArticle('non-existent', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('getArticles', () => {
    it('should return articles with filters', async () => {
      const mockArticles = [
        { id: 'article-1', title: 'Article 1', isPublished: true },
        { id: 'article-2', title: 'Article 2', isPublished: true },
      ];

      mockPrismaService.knowledgeBaseArticle.findMany.mockResolvedValue(mockArticles);
      mockPrismaService.knowledgeBaseArticle.count.mockResolvedValue(2);

      const result = await service.getArticles({
        category: 'FAQ',
        isPublished: true,
        page: 1,
        limit: 20,
      });

      expect(result).toHaveProperty('articles');
      expect(result).toHaveProperty('pagination');
      expect(result.articles).toHaveLength(2);
    });

    it('should support search functionality', async () => {
      mockPrismaService.knowledgeBaseArticle.findMany.mockResolvedValue([]);
      mockPrismaService.knowledgeBaseArticle.count.mockResolvedValue(0);

      await service.getArticles({ search: 'test query' });

      const callArgs = mockPrismaService.knowledgeBaseArticle.findMany.mock.calls[0][0];
      expect(callArgs.where.OR).toBeDefined();
    });
  });

  describe('searchArticles', () => {
    it('should search published articles', async () => {
      const mockArticles = [{ id: 'article-1', title: 'Test Article', views: 10 }];

      mockPrismaService.knowledgeBaseArticle.findMany.mockResolvedValue(mockArticles);

      const result = await service.searchArticles('test');

      expect(mockPrismaService.knowledgeBaseArticle.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('should filter by category if provided', async () => {
      mockPrismaService.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      await service.searchArticles('test', { category: 'FAQ' });

      const callArgs = mockPrismaService.knowledgeBaseArticle.findMany.mock.calls[0][0];
      expect(callArgs.where.category).toBe('FAQ');
    });
  });

  describe('getArticleById', () => {
    it('should return article and increment views', async () => {
      const articleId = 'article-1';
      const mockArticle = {
        id: articleId,
        title: 'Test Article',
        views: 5,
      };

      mockPrismaService.knowledgeBaseArticle.findUnique.mockResolvedValue(mockArticle);
      mockPrismaService.knowledgeBaseArticle.update.mockResolvedValue({
        ...mockArticle,
        views: 6,
      });

      const result = await service.getArticleById(articleId);

      expect(mockPrismaService.knowledgeBaseArticle.update).toHaveBeenCalledWith({
        where: { id: articleId },
        data: { views: 6 },
      });
      expect(result.views).toBe(6);
    });

    it('should throw NotFoundException if article not found', async () => {
      mockPrismaService.knowledgeBaseArticle.findUnique.mockResolvedValue(null);

      await expect(service.getArticleById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getArticleBySlug', () => {
    it('should return published article by slug', async () => {
      const slug = 'test-article';
      const mockArticle = {
        id: 'article-1',
        slug,
        isPublished: true,
        views: 5,
      };

      mockPrismaService.knowledgeBaseArticle.findUnique.mockResolvedValue(mockArticle);
      mockPrismaService.knowledgeBaseArticle.update.mockResolvedValue({
        ...mockArticle,
        views: 6,
      });

      const result = await service.getArticleBySlug(slug);

      expect(result.isPublished).toBe(true);
      expect(result.views).toBe(6);
    });

    it('should throw NotFoundException if article not published', async () => {
      const mockArticle = {
        id: 'article-1',
        slug: 'test-article',
        isPublished: false,
      };

      mockPrismaService.knowledgeBaseArticle.findUnique.mockResolvedValue(mockArticle);

      await expect(service.getArticleBySlug('test-article')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markArticleHelpful', () => {
    it('should increment helpful count', async () => {
      const articleId = 'article-1';
      const mockArticle = {
        id: articleId,
        helpful: 10,
      };

      mockPrismaService.knowledgeBaseArticle.findUnique.mockResolvedValue(mockArticle);
      mockPrismaService.knowledgeBaseArticle.update.mockResolvedValue({
        ...mockArticle,
        helpful: 11,
      });

      const result = await service.markArticleHelpful(articleId);

      expect(result.helpful).toBe(11);
    });

    it('should throw NotFoundException if article not found', async () => {
      mockPrismaService.knowledgeBaseArticle.findUnique.mockResolvedValue(null);

      await expect(service.markArticleHelpful('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
