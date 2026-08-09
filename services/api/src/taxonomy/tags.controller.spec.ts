import { BadRequestException } from '@nestjs/common';
import { TagsController } from './tags.controller';

describe('TagsController search', () => {
  const tagsService = { searchTags: jest.fn() };
  const controller = new TagsController(tagsService as any);

  beforeEach(() => jest.clearAllMocks());

  it.each([undefined, '', '   '])(
    'rejects a missing q instead of reaching the service (%p)',
    async (q) => {
      await expect(controller.searchTags(q as string)).rejects.toBeInstanceOf(BadRequestException);
      expect(tagsService.searchTags).not.toHaveBeenCalled();
    },
  );

  it('searches when q is present', async () => {
    tagsService.searchTags.mockResolvedValue([{ id: 'tag-1' }]);

    const result = await controller.searchTags('wand');

    expect(tagsService.searchTags).toHaveBeenCalledWith('wand');
    expect(result.data).toEqual([{ id: 'tag-1' }]);
  });
});
