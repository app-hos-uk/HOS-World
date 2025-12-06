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
} from '@nestjs/common';
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

@Controller('taxonomy/attributes')
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  @Public()
  @Get()
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
  async getGlobalAttributes(): Promise<ApiResponse<any[]>> {
    const attributes = await this.attributesService.findAll({ isGlobal: true });
    return {
      data: attributes,
      message: 'Global attributes retrieved successfully',
    };
  }

  @Public()
  @Get('category/:categoryId')
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
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    const attribute = await this.attributesService.findOne(id);
    return {
      data: attribute,
      message: 'Attribute retrieved successfully',
    };
  }

  @Public()
  @Get(':id/values')
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

