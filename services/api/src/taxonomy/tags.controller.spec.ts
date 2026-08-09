import { BadRequestException, ParseEnumPipe } from '@nestjs/common';
import { TagCategory } from '@prisma/client';
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

  // The route annotates the param as TagCategory, but that is erased at runtime, so an unknown
  // value used to travel into the Prisma enum filter and surface as a 500. ParseEnumPipe is what
  // actually stops it, so that is what these assert.
  describe('category parameter', () => {
    const pipe = new ParseEnumPipe(TagCategory);
    const meta = { type: 'param' as const, data: 'category' };

    it.each(Object.values(TagCategory))('accepts the real category %s', async (category) => {
      await expect(pipe.transform(category as any, meta)).resolves.toBe(category);
    });

    it.each(['theme', 'GENRE', '00000000-0000-4000-8000-000000000000', ''])(
      'rejects %p with a 400 instead of crashing the query',
      async (value) => {
        await expect(pipe.transform(value as any, meta)).rejects.toBeInstanceOf(
          BadRequestException,
        );
      },
    );
  });
});
