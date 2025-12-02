import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CatalogService } from './catalog.service';
import {
  CreateCatalogEntryDto,
  UpdateCatalogEntryDto,
} from './dto/create-catalog-entry.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('catalog')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CATALOG', 'ADMIN')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('pending')
  async findPending(): Promise<ApiResponse<any[]>> {
    const submissions = await this.catalogService.findPending();
    return {
      data: submissions,
      message: 'Pending catalog entries retrieved successfully',
    };
  }

  @Get('entries')
  async findAll(
    @Query('status') status?: 'pending' | 'completed',
  ): Promise<ApiResponse<any[]>> {
    const entries = await this.catalogService.findAll(status);
    return {
      data: entries,
      message: 'Catalog entries retrieved successfully',
    };
  }

  @Get('entries/:submissionId')
  async findOne(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ): Promise<ApiResponse<any>> {
    const entry = await this.catalogService.findOne(submissionId);
    return {
      data: entry,
      message: 'Catalog entry retrieved successfully',
    };
  }

  @Post('entries/:submissionId')
  async create(
    @Request() req: any,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() createDto: CreateCatalogEntryDto,
  ): Promise<ApiResponse<any>> {
    const entry = await this.catalogService.create(
      submissionId,
      req.user.id,
      createDto,
    );
    return {
      data: entry,
      message: 'Catalog entry created successfully',
    };
  }

  @Put('entries/:submissionId')
  async update(
    @Request() req: any,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() updateDto: UpdateCatalogEntryDto,
  ): Promise<ApiResponse<any>> {
    const entry = await this.catalogService.update(
      submissionId,
      req.user.id,
      updateDto,
    );
    return {
      data: entry,
      message: 'Catalog entry updated successfully',
    };
  }

  @Post('entries/:submissionId/complete')
  async markComplete(
    @Request() req: any,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ): Promise<ApiResponse<any>> {
    const entry = await this.catalogService.markComplete(submissionId, req.user.id);
    return {
      data: entry,
      message: 'Catalog entry marked as completed',
    };
  }

  @Get('dashboard/stats')
  async getDashboardStats(): Promise<ApiResponse<any>> {
    const stats = await this.catalogService.getDashboardStats();
    return {
      data: stats,
      message: 'Dashboard statistics retrieved successfully',
    };
  }
}

