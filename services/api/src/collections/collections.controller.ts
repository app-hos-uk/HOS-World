import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
Version,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { CollectionsService } from './collections.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('collections')
@ApiBearerAuth('JWT-auth')
@Version('1')
@Controller('collections')
@UseGuards(JwtAuthGuard)
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get user collections',
    description: 'Retrieves all collections for the authenticated user. Optionally includes public collections.',
  })
  @ApiQuery({ name: 'includePublic', required: false, type: Boolean, description: 'Include public collections from other users' })
  @SwaggerApiResponse({ status: 200, description: 'Collections retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Request() req: any,
    @Query('includePublic') includePublic?: string,
  ): Promise<ApiResponse<any[]>> {
    const collections = await this.collectionsService.findAll(
      req.user.id,
      includePublic === 'true',
    );
    return {
      data: collections,
      message: 'Collections retrieved successfully',
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get collection by ID',
    description: 'Retrieves a specific collection. Can access own collections or public collections.',
  })
  @ApiParam({ name: 'id', description: 'Collection ID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Collection retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Collection is private' })
  @SwaggerApiResponse({ status: 404, description: 'Collection not found' })
  async findOne(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<any>> {
    const collection = await this.collectionsService.findOne(id, req.user.id);
    return {
      data: collection,
      message: 'Collection retrieved successfully',
    };
  }

  @Post()
  @ApiOperation({
    summary: 'Create collection',
    description: 'Creates a new collection for the authenticated user.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', description: 'Collection name' },
        description: { type: 'string', description: 'Collection description' },
        isPublic: { type: 'boolean', description: 'Whether collection is public' },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Collection created successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Request() req: any,
    @Body() body: { name: string; description?: string; isPublic?: boolean },
  ): Promise<ApiResponse<any>> {
    const collection = await this.collectionsService.create(req.user.id, body);
    return {
      data: collection,
      message: 'Collection created successfully',
    };
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update collection',
    description: 'Updates a collection. Only the owner can update.',
  })
  @ApiParam({ name: 'id', description: 'Collection ID', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Collection name' },
        description: { type: 'string', description: 'Collection description' },
        isPublic: { type: 'boolean', description: 'Whether collection is public' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Collection updated successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Not the owner' })
  @SwaggerApiResponse({ status: 404, description: 'Collection not found' })
  async update(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { name?: string; description?: string; isPublic?: boolean },
  ): Promise<ApiResponse<any>> {
    const collection = await this.collectionsService.update(id, req.user.id, body);
    return {
      data: collection,
      message: 'Collection updated successfully',
    };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete collection',
    description: 'Deletes a collection. Only the owner can delete.',
  })
  @ApiParam({ name: 'id', description: 'Collection ID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Collection deleted successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Not the owner' })
  @SwaggerApiResponse({ status: 404, description: 'Collection not found' })
  async delete(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<any>> {
    await this.collectionsService.delete(id, req.user.id);
    return {
      data: { message: 'Collection deleted successfully' },
      message: 'Collection deleted successfully',
    };
  }

  @Post(':id/products/:productId')
  @ApiOperation({
    summary: 'Add product to collection',
    description: 'Adds a product to a collection. Only the owner can modify.',
  })
  @ApiParam({ name: 'id', description: 'Collection ID', type: String })
  @ApiParam({ name: 'productId', description: 'Product ID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Product added to collection successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Not the owner or product already in collection' })
  @SwaggerApiResponse({ status: 404, description: 'Collection or product not found' })
  async addProduct(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<ApiResponse<any>> {
    const collection = await this.collectionsService.addProduct(id, req.user.id, productId);
    return {
      data: collection,
      message: 'Product added to collection successfully',
    };
  }

  @Delete(':id/products/:productId')
  @ApiOperation({
    summary: 'Remove product from collection',
    description: 'Removes a product from a collection. Only the owner can modify.',
  })
  @ApiParam({ name: 'id', description: 'Collection ID', type: String })
  @ApiParam({ name: 'productId', description: 'Product ID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Product removed from collection successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Not the owner' })
  @SwaggerApiResponse({ status: 404, description: 'Collection not found' })
  async removeProduct(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<ApiResponse<any>> {
    const collection = await this.collectionsService.removeProduct(id, req.user.id, productId);
    return {
      data: collection,
      message: 'Product removed from collection successfully',
    };
  }
}
