import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AmbassadorService } from './ambassador.service';
import { ReviewUgcDto } from './dto/review-ugc.dto';

@ApiTags('admin-ambassadors')
@ApiBearerAuth('JWT-auth')
@Controller('admin/ambassadors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AmbassadorAdminController {
  constructor(private ambassador: AmbassadorService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Ambassador programme KPIs' })
  async dashboard(): Promise<ApiResponse<unknown>> {
    const data = await this.ambassador.adminDashboard();
    return { data, message: 'OK' };
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Leaderboard (admin)' })
  async leaderboard(
    @Query('period') period?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<unknown>> {
    const p = (period === 'month' || period === 'all' ? period : 'week') as 'week' | 'month' | 'all';
    const data = await this.ambassador.getLeaderboard(
      p,
      limit ? parseInt(limit, 10) : 50,
    );
    return { data, message: 'OK' };
  }

  @Get('ugc')
  @ApiOperation({ summary: 'All UGC submissions' })
  async listUgc(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.ambassador.listAllUgcAdmin({
      status,
      type,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { data, message: 'OK' };
  }

  @Post('ugc/:id/review')
  @ApiOperation({ summary: 'Review UGC submission' })
  async reviewUgc(
    @Request() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewUgcDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.ambassador.reviewUgc(id, dto, req.user.id);
    return { data, message: 'OK' };
  }

  @Get()
  @ApiOperation({ summary: 'List ambassadors' })
  async list(
    @Query('status') status?: string,
    @Query('tier') tier?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.ambassador.adminListAmbassadors({
      status,
      tier,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { data, message: 'OK' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ambassador detail' })
  async getOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.ambassador.adminGetAmbassador(id);
    return { data, message: 'OK' };
  }

  @Post(':id/suspend')
  @ApiOperation({ summary: 'Suspend ambassador' })
  async suspend(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.ambassador.suspendAmbassador(id);
    return { data, message: 'Suspended' };
  }

  @Post(':id/reactivate')
  @ApiOperation({ summary: 'Reactivate ambassador' })
  async reactivate(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.ambassador.reactivateAmbassador(id);
    return { data, message: 'Reactivated' };
  }
}
