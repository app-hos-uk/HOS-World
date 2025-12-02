import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SettlementsService } from './settlements.service';
import { CreateSettlementDto, ProcessSettlementDto } from './dto/create-settlement.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { SettlementStatus } from '@prisma/client';

@Controller('settlements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Roles('ADMIN', 'FINANCE')
  @Post()
  async createSettlement(
    @Request() req: any,
    @Body() createDto: CreateSettlementDto,
  ): Promise<ApiResponse<any>> {
    const settlement = await this.settlementsService.createSettlement(
      req.user.id,
      createDto,
    );
    return {
      data: settlement,
      message: 'Settlement created successfully',
    };
  }

  @Get()
  async findAll(
    @Request() req: any,
    @Query('sellerId') sellerId?: string,
    @Query('status') status?: SettlementStatus,
  ): Promise<ApiResponse<any[]>> {
    // Sellers can only see their own settlements
    let filterSellerId = sellerId;
    if (req.user.role === 'WHOLESALER' || req.user.role === 'B2C_SELLER' || req.user.role === 'SELLER') {
      filterSellerId = await this.settlementsService.getSellerIdByUserId(req.user.id) || undefined;
    }

    const settlements = await this.settlementsService.findAll(filterSellerId, status);
    return {
      data: settlements,
      message: 'Settlements retrieved successfully',
    };
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<any>> {
    const settlement = await this.settlementsService.findOne(id);
    return {
      data: settlement,
      message: 'Settlement retrieved successfully',
    };
  }

  @Roles('ADMIN', 'FINANCE')
  @Put(':id/process')
  async processSettlement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() processDto: ProcessSettlementDto,
  ): Promise<ApiResponse<any>> {
    const settlement = await this.settlementsService.processSettlement(id, processDto);
    return {
      data: settlement,
      message: 'Settlement processed successfully',
    };
  }

  @Get('calculate/:sellerId')
  async calculateSettlement(
    @Request() req: any,
    @Param('sellerId', ParseUUIDPipe) sellerId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<ApiResponse<any>> {
    const calculation = await this.settlementsService.calculateSettlement(
      sellerId,
      new Date(startDate),
      new Date(endDate),
    );
    return {
      data: calculation,
      message: 'Settlement calculated successfully',
    };
  }
}

