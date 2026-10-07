import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequireAccess } from '../access-control/decorators/require-access.decorator';
import { FandomNewsService } from './fandom-news.service';
import { ArticleQueryDto, FandomWorldFeedQueryDto } from './dto/article-query.dto';
import { CreateSourceDto } from './dto/create-source.dto';
import { UpdateSourceDto } from './dto/update-source.dto';
import { BulkUpdateArticlesDto, UpdateArticleDto } from './dto/update-article.dto';

@ApiTags('fandom-news')
@Controller('fandom-news')
export class FandomNewsController {
  constructor(private readonly fandomNews: FandomNewsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List approved fandom news articles' })
  async list(@Query() query: ArticleQueryDto): Promise<ApiResponse<unknown>> {
    const data = await this.fandomNews.findAllArticles(query, { publicOnly: true });
    return { data, message: 'OK' };
  }

  @Public()
  @Post(':id/click')
  @ApiOperation({ summary: 'Record a click on a fandom news article' })
  async click(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.fandomNews.trackClick(id);
    return { data, message: 'OK' };
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get an approved fandom news article' })
  async getOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.fandomNews.findArticle(id, { publicOnly: true });
    return { data, message: 'OK' };
  }
}

@ApiTags('fandom-world')
@Controller('fandom-world')
export class FandomWorldController {
  constructor(private readonly fandomNews: FandomNewsService) {}

  @Public()
  @Get('feed')
  @ApiOperation({ summary: 'Unified fandom world feed of news and landing events' })
  async feed(@Query() query: FandomWorldFeedQueryDto): Promise<ApiResponse<unknown>> {
    const data = await this.fandomNews.getUnifiedFeed(query.market, query.limit ?? 6);
    return { data, message: 'OK' };
  }
}

@ApiTags('admin-fandom-news')
@ApiBearerAuth('JWT-auth')
@Controller('admin/fandom-news')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'CMS_EDITOR')
export class FandomNewsAdminController {
  constructor(private readonly fandomNews: FandomNewsService) {}

  @Get('sources')
  @RequireAccess({ permission: 'cms.edit', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'List fandom news sources' })
  async listSources(
    @Query('isActive') isActive?: string,
    @Query('market') market?: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.fandomNews.findAllSources({
      isActive: isActive === undefined ? undefined : isActive === 'true',
      market,
    });
    return { data, message: 'OK' };
  }

  @Post('sources')
  @RequireAccess({ permission: 'cms.edit', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Add an RSS source' })
  async createSource(@Body() dto: CreateSourceDto): Promise<ApiResponse<unknown>> {
    const data = await this.fandomNews.createSource(dto);
    return { data, message: 'News source created' };
  }

  @Post('fetch')
  @RequireAccess({ permission: 'cms.edit', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Fetch every active RSS source' })
  async fetchAll(): Promise<ApiResponse<unknown>> {
    const data = await this.fandomNews.fetchAllActiveSources();
    return { data, message: 'Fetch complete' };
  }

  @Get('sources/:id')
  @RequireAccess({ permission: 'cms.edit', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Get a fandom news source' })
  async getSource(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.fandomNews.findSource(id);
    return { data, message: 'OK' };
  }

  @Put('sources/:id')
  @RequireAccess({ permission: 'cms.edit', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Update a fandom news source' })
  async updateSource(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSourceDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.fandomNews.updateSource(id, dto);
    return { data, message: 'News source updated' };
  }

  @Delete('sources/:id')
  @RequireAccess({ permission: 'cms.edit', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Delete a fandom news source and its articles' })
  async deleteSource(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    await this.fandomNews.deleteSource(id);
    return { data: null, message: 'News source deleted' };
  }

  @Post('sources/:id/fetch')
  @RequireAccess({ permission: 'cms.edit', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Fetch one RSS source now' })
  async fetchSource(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.fandomNews.fetchSource(id);
    return { data, message: 'Feed fetched' };
  }

  @Get('articles')
  @RequireAccess({ permission: 'cms.edit', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'List fandom news articles' })
  async listArticles(@Query() query: ArticleQueryDto): Promise<ApiResponse<unknown>> {
    const data = await this.fandomNews.findAllArticles(query);
    return { data, message: 'OK' };
  }

  @Post('articles/bulk')
  @Patch('articles/bulk')
  @RequireAccess({ permission: 'cms.edit', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Bulk approve or hide articles' })
  async bulkUpdate(@Body() dto: BulkUpdateArticlesDto): Promise<ApiResponse<unknown>> {
    const data = await this.fandomNews.bulkUpdateArticles(dto.ids, dto.status);
    return { data, message: 'Articles updated' };
  }

  @Get('articles/:id')
  @RequireAccess({ permission: 'cms.edit', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Get a fandom news article' })
  async getArticle(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.fandomNews.findArticle(id);
    return { data, message: 'OK' };
  }

  @Put('articles/:id')
  @Patch('articles/:id')
  @RequireAccess({ permission: 'cms.edit', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Update article status, categories, pin, or video' })
  async updateArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateArticleDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.fandomNews.updateArticle(id, dto);
    return { data, message: 'Article updated' };
  }

  @Delete('articles/:id')
  @RequireAccess({ permission: 'cms.edit', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Delete a fandom news article' })
  async deleteArticle(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    await this.fandomNews.deleteArticle(id);
    return { data: null, message: 'Article deleted' };
  }
}
