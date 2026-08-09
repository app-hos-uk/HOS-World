import { BadRequestException } from '@nestjs/common';
import { KnowledgeBaseController } from './knowledge-base.controller';

describe('KnowledgeBaseController search', () => {
  const knowledgeBaseService = { searchArticles: jest.fn() };
  const controller = new KnowledgeBaseController(knowledgeBaseService as any);

  beforeEach(() => jest.clearAllMocks());

  it.each([undefined, '', '   '])(
    'rejects a missing q instead of reaching the service (%p)',
    async (q) => {
      await expect(controller.searchArticles(q as string)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(knowledgeBaseService.searchArticles).not.toHaveBeenCalled();
    },
  );

  it('passes the optional filters through when q is present', async () => {
    knowledgeBaseService.searchArticles.mockResolvedValue([{ id: 'article-1' }]);

    const result = await controller.searchArticles('refund', 'orders', 'a,b', '5');

    expect(knowledgeBaseService.searchArticles).toHaveBeenCalledWith('refund', {
      category: 'orders',
      tags: ['a', 'b'],
      limit: 5,
    });
    expect(result.data).toEqual([{ id: 'article-1' }]);
  });
});
