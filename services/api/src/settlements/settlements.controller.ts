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
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { SettlementsService } from './settlements.service';
import { SettlementSchedulerService } from './settlement-scheduler.service';
import { CreateSettlementDto, ProcessSettlementDto } from './dto/create-settlement.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { SettlementStatus } from '@prisma/client';

@ApiTags('settlements')
@ApiBearerAuth('JWT-auth')
@Controller('settlements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettlementsController {
  constructor(
    private readonly settlementsService: SettlementsService,
    private readonly schedulerService: SettlementSchedulerService,
  ) {}

  @Roles('ADMIN', 'FINANCE')
  @Post()
  @ApiOperation({
    summary: 'Create settlement (Admin/Finance only)',
    description: 'Creates a new settlement for a seller. Admin or Finance access required.',
  })
  @ApiBody({ type: CreateSettlementDto })
  @SwaggerApiResponse({ status: 201, description: 'Settlement created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin/Finance access required' })
  async createSettlement(
    @Request() req: any,
    @Body() createDto: CreateSettlementDto,
  ): Promise<ApiResponse<any>> {
    const settlement = await this.settlementsService.createSettlement(req.user.id, createDto);
    return {
      data: settlement,
      message: 'Settlement created successfully',
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all settlements',
    description:
      'Retrieves all settlements. Sellers can only view their own settlements, admins/finance can view all.',
  })
  @ApiQuery({ name: 'sellerId', required: false, type: String, description: 'Filter by seller ID' })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filter by settlement status',
  })
  @SwaggerApiResponse({ status: 200, description: 'Settlements retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Request() req: any,
    @Query('sellerId') sellerId?: string,
    @Query('status') status?: SettlementStatus,
  ): Promise<ApiResponse<any[]>> {
    // Sellers can only see their own settlements
    let filterSellerId = sellerId;
    if (
      req.user.role === 'WHOLESALER' ||
      req.user.role === 'B2C_SELLER' ||
      req.user.role === 'SELLER'
    ) {
      filterSellerId =
        (await this.settlementsService.getSellerIdByUserId(req.user.id)) || undefined;
    }

    const settlements = await this.settlementsService.findAll(filterSellerId, status);
    return {
      data: settlements,
      message: 'Settlements retrieved successfully',
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get settlement by ID',
    description:
      'Retrieves a specific settlement by ID. Sellers can only view their own settlements.',
  })
  @ApiParam({ name: 'id', description: 'Settlement UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Settlement retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Cannot access this settlement' })
  @SwaggerApiResponse({ status: 404, description: 'Settlement not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    const settlement = await this.settlementsService.findOne(id);
    return {
      data: settlement,
      message: 'Settlement retrieved successfully',
    };
  }

  @Roles('ADMIN', 'FINANCE')
  @Put(':id/process')
  @ApiOperation({
    summary: 'Process settlement (Admin/Finance only)',
    description: 'Processes a settlement (marks as paid, etc.). Admin or Finance access required.',
  })
  @ApiParam({ name: 'id', description: 'Settlement UUID', type: String })
  @ApiBody({ type: ProcessSettlementDto })
  @SwaggerApiResponse({ status: 200, description: 'Settlement processed successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin/Finance access required' })
  @SwaggerApiResponse({ status: 404, description: 'Settlement not found' })
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
  @ApiOperation({
    summary: 'Calculate settlement',
    description: 'Calculates settlement amount for a seller within a date range.',
  })
  @ApiParam({ name: 'sellerId', description: 'Seller UUID', type: String })
  @ApiQuery({
    name: 'startDate',
    required: true,
    type: String,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({ name: 'endDate', required: true, type: String, description: 'End date (ISO format)' })
  @SwaggerApiResponse({ status: 200, description: 'Settlement calculated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid date range' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 404, description: 'Seller not found' })
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

  // ============================================================
  // AUTOMATION ENDPOINTS - For scheduled/manual settlement tasks
  // ============================================================

  @Roles('ADMIN', 'FINANCE')
  @Post('automation/weekly')
  @ApiOperation({
    summary: 'Trigger weekly settlement creation (Admin/Finance only)',
    description:
      'Manually triggers the weekly settlement creation for all active sellers. Creates settlements for the previous week.',
  })
  @SwaggerApiResponse({ status: 201, description: 'Weekly settlements created' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin/Finance access required' })
  async triggerWeeklySettlements(): Promise<ApiResponse<any>> {
    const result = await this.schedulerService.createWeeklySettlements();
    return {
      data: result,
      message: `Weekly settlements processed: ${result.created} created, ${result.failed} failed`,
    };
  }

  @Roles('ADMIN')
  @Post('automation/cleanup-reservations')
  @ApiOperation({
    summary: 'Cleanup expired stock reservations (Admin only)',
    description: 'Manually triggers cleanup of expired stock reservations.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Reservations cleaned up' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async cleanupReservations(): Promise<ApiResponse<any>> {
    const result = await this.schedulerService.cleanupExpiredReservations();
    return {
      data: result,
      message: `Cleaned up ${result.cleaned} expired reservations`,
    };
  }

  @Roles('ADMIN', 'FINANCE')
  @Get('automation/reminders')
  @ApiOperation({
    summary: 'Check pending settlement reminders (Admin/Finance only)',
    description:
      'Checks for settlements that have been pending for more than 7 days and need attention.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Reminders checked' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin/Finance access required' })
  async checkReminders(): Promise<ApiResponse<any>> {
    const result = await this.schedulerService.sendSettlementReminders();
    return {
      data: result,
      message: `Found ${result.sent} settlements needing attention`,
    };
  }

  @Roles('ADMIN', 'FINANCE')
  @Get('automation/status')
  @ApiOperation({
    summary: 'Get automation status (Admin/Finance only)',
    description: 'Returns the current status of automated settlement processing.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Status retrieved' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin/Finance access required' })
  async getAutomationStatus(): Promise<ApiResponse<any>> {
    const status = this.schedulerService.getStatus();
    return {
      data: status,
      message: 'Automation status retrieved',
    };
  }
}
