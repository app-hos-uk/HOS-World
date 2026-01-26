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
import {
  AttributesService,
  CreateAttributeDto,
  UpdateAttributeDto,
  CreateAttributeValueDto,
} from './attributes.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { AttributeType } from '@prisma/client';

@ApiTags('taxonomy')
@Version('1')
@Controller('taxonomy/attributes')
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Get all attributes',
    description: 'Retrieves all attributes with optional filtering. Public endpoint, no authentication required.',
  })
  @ApiQuery({ name: 'categoryId', required: false, type: String, description: 'Filter by category ID' })
  @ApiQuery({ name: 'isGlobal', required: false, type: String, description: 'Filter by global status (true/false)' })
  @ApiQuery({ name: 'type', required: false, type: String, description: 'Filter by attribute type' })
  @SwaggerApiResponse({ status: 200, description: 'Attributes retrieved successfully' })
  async findAll(
    @Query('categoryId') categoryId?: string,
    @Query('isGlobal') isGlobal?: string,
    @Query('type') type?: AttributeType,
  ): Promise<ApiResponse<any[]>> {
    const attributes = await this.attributesService.findAll({
      categoryId,
      isGlobal: isGlobal === 'true' ? true : isGlobal === 'false' ? false : undefined,
      type,
    });
    return {
      data: attributes,
      message: 'Attributes retrieved successfully',
    };
  }

  @Public()
  @Get('global')
  @ApiOperation({
    summary: 'Get global attributes',
    description: 'Retrieves all global attributes. Public endpoint, no authentication required.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Global attributes retrieved successfully' })
  async getGlobalAttributes(): Promise<ApiResponse<any[]>> {
    const attributes = await this.attributesService.findAll({ isGlobal: true });
    return {
      data: attributes,
      message: 'Global attributes retrieved successfully',
    };
  }

  @Public()
  @Get('category/:categoryId')
  @ApiOperation({
    summary: 'Get attributes for category',
    description: 'Retrieves all attributes for a specific category. Public endpoint, no authentication required.',
  })
  @ApiParam({ name: 'categoryId', description: 'Category UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Category attributes retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Category not found' })
  async getAttributesForCategory(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.attributesService.getAttributesForCategory(categoryId);
    return {
      data: result,
      message: 'Category attributes retrieved successfully',
    };
  }

  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Get attribute by ID',
    description: 'Retrieves a specific attribute by ID. Public endpoint, no authentication required.',
  })
  @ApiParam({ name: 'id', description: 'Attribute UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Attribute retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Attribute not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    const attribute = await this.attributesService.findOne(id);
    return {
      data: attribute,
      message: 'Attribute retrieved successfully',
    };
  }

  @Public()
  @Get(':id/values')
  @ApiOperation({
    summary: 'Get attribute values',
    description: 'Retrieves all values for a specific attribute. Public endpoint, no authentication required.',
  })
  @ApiParam({ name: 'id', description: 'Attribute UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Attribute values retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Attribute not found' })
  async getAttributeValues(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any[]>> {
    const values = await this.attributesService.getAttributeValues(id);
    return {
      data: values,
      message: 'Attribute values retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create attribute (Admin only)',
    description: 'Creates a new attribute. Admin access required.',
  })
  @ApiBody({
    description: 'Attribute creation data',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        categoryId: { type: 'string', format: 'uuid' },
        isRequired: { type: 'boolean' },
        isGlobal: { type: 'boolean' },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Attribute created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async createAttribute(@Body() createDto: CreateAttributeDto): Promise<ApiResponse<any>> {
    const attribute = await this.attributesService.createAttribute(createDto);
    return {
      data: attribute,
      message: 'Attribute created successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post(':id/values')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create attribute value (Admin only)',
    description: 'Creates a new value for an attribute. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Attribute UUID', type: String })
  @ApiBody({
    description: 'Attribute value creation data',
    schema: {
      type: 'object',
      properties: {
        value: { type: 'string' },
        displayOrder: { type: 'number' },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Attribute value created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Attribute not found' })
  async createAttributeValue(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createDto: CreateAttributeValueDto,
  ): Promise<ApiResponse<any>> {
    const value = await this.attributesService.createAttributeValue(id, createDto);
    return {
      data: value,
      message: 'Attribute value created successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update attribute (Admin only)',
    description: 'Updates an existing attribute. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Attribute UUID', type: String })
  @ApiBody({
    description: 'Attribute update data',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        isRequired: { type: 'boolean' },
        isGlobal: { type: 'boolean' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Attribute updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Attribute not found' })
  async updateAttribute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateAttributeDto,
  ): Promise<ApiResponse<any>> {
    const attribute = await this.attributesService.updateAttribute(id, updateDto);
    return {
      data: attribute,
      message: 'Attribute updated successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put('values/:valueId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update attribute value (Admin only)',
    description: 'Updates an existing attribute value. Admin access required.',
  })
  @ApiParam({ name: 'valueId', description: 'Attribute value UUID', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        value: { type: 'string', description: 'Attribute value' },
        order: { type: 'number', description: 'Display order' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Attribute value updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Attribute value not found' })
  async updateAttributeValue(
    @Param('valueId', ParseUUIDPipe) valueId: string,
    @Body() updateDto: { value?: string; order?: number },
  ): Promise<ApiResponse<any>> {
    const value = await this.attributesService.updateAttributeValue(valueId, updateDto);
    return {
      data: value,
      message: 'Attribute value updated successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete attribute (Admin only)',
    description: 'Deletes an attribute. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Attribute UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Attribute deleted successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Attribute not found' })
  async deleteAttribute(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    await this.attributesService.deleteAttribute(id);
    return {
      data: { id },
      message: 'Attribute deleted successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete('values/:valueId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete attribute value (Admin only)',
    description: 'Deletes an attribute value. Admin access required.',
  })
  @ApiParam({ name: 'valueId', description: 'Attribute value UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Attribute value deleted successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Attribute value not found' })
  async deleteAttributeValue(
    @Param('valueId', ParseUUIDPipe) valueId: string,
  ): Promise<ApiResponse<any>> {
    await this.attributesService.deleteAttributeValue(valueId);
    return {
      data: { id: valueId },
      message: 'Attribute value deleted successfully',
    };
  }
}

