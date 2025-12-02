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
} from '@nestjs/common';
import { MarketingService } from './marketing.service';
import { CreateMaterialDto, UpdateMaterialDto } from './dto/create-material.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { MaterialType } from '@prisma/client';

@Controller('marketing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MARKETING', 'ADMIN')
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  @Get('pending')
  async findPending(): Promise<ApiResponse<any[]>> {
    const submissions = await this.marketingService.findPending();
    return {
      data: submissions,
      message: 'Pending marketing materials retrieved successfully',
    };
  }

  @Get('materials')
  async findAllMaterials(
    @Query('submissionId') submissionId?: string,
    @Query('type') type?: MaterialType,
  ): Promise<ApiResponse<any[]>> {
    const materials = await this.marketingService.findAllMaterials(submissionId, type);
    return {
      data: materials,
      message: 'Marketing materials retrieved successfully',
    };
  }

  @Get('materials/:id')
  async findOneMaterial(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<any>> {
    const material = await this.marketingService.findOneMaterial(id);
    return {
      data: material,
      message: 'Marketing material retrieved successfully',
    };
  }

  @Post('materials')
  async createMaterial(
    @Request() req: any,
    @Body() createDto: CreateMaterialDto,
  ): Promise<ApiResponse<any>> {
    const material = await this.marketingService.createMaterial(
      req.user.id,
      createDto,
    );
    return {
      data: material,
      message: 'Marketing material created successfully',
    };
  }

  @Put('materials/:id')
  async updateMaterial(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateMaterialDto,
  ): Promise<ApiResponse<any>> {
    const material = await this.marketingService.updateMaterial(id, updateDto);
    return {
      data: material,
      message: 'Marketing material updated successfully',
    };
  }

  @Delete('materials/:id')
  async deleteMaterial(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<{ message: string }>> {
    const result = await this.marketingService.deleteMaterial(id);
    return {
      data: result,
      message: result.message,
    };
  }

  @Post('submissions/:submissionId/complete')
  async markComplete(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ): Promise<ApiResponse<any>> {
    const submission = await this.marketingService.markComplete(submissionId);
    return {
      data: submission,
      message: 'Marketing materials marked as completed',
    };
  }

  @Get('dashboard/stats')
  async getDashboardStats(): Promise<ApiResponse<any>> {
    const stats = await this.marketingService.getDashboardStats();
    return {
      data: stats,
      message: 'Dashboard statistics retrieved successfully',
    };
  }
}

