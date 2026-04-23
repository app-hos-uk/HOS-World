import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ProductCampaignsService } from './product-campaigns.service';
import { CreateProductCampaignDto } from './dto/create-product-campaign.dto';
import { UpdateProductCampaignDto } from './dto/update-product-campaign.dto';

@ApiTags('admin-product-campaigns')
@ApiBearerAuth('JWT-auth')
@Controller('admin/product-campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ProductCampaignsController {
  constructor(private campaigns: ProductCampaignsService) {}

  @Get()
  @ApiOperation({ summary: 'List product campaigns' })
  async list(@Query('status') status?: string): Promise<ApiResponse<unknown>> {
    const data = await this.campaigns.list({ status });
    return { data, message: 'OK' };
  }

  @Post()
  @ApiOperation({ summary: 'Create product campaign' })
  async create(@Body() dto: CreateProductCampaignDto): Promise<ApiResponse<unknown>> {
    const data = await this.campaigns.create(dto);
    return { data, message: 'OK' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get campaign' })
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.campaigns.get(id);
    return { data, message: 'OK' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update campaign' })
  async patch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductCampaignDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.campaigns.update(id, dto);
    return { data, message: 'OK' };
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate campaign' })
  async activate(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.campaigns.activate(id);
    return { data, message: 'OK' };
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete campaign' })
  async complete(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.campaigns.complete(id);
    return { data, message: 'OK' };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel campaign' })
  async cancel(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.campaigns.cancel(id);
    return { data, message: 'OK' };
  }
}
