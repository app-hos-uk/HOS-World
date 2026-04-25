import { Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ClickCollectService } from './click-collect.service';

@ApiTags('admin-click-collect')
@ApiBearerAuth('JWT-auth')
@Controller('admin/click-collect')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ClickCollectAdminController {
  constructor(private cc: ClickCollectService) {}

  @Get()
  @ApiOperation({ summary: 'List click & collect orders' })
  async list(
    @Query('storeId') storeId?: string,
    @Query('status') status?: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.cc.adminList({ storeId, status });
    return { data, message: 'OK' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Click & collect detail' })
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.cc.adminGet(id);
    return { data, message: 'OK' };
  }

  @Post(':id/preparing')
  @ApiOperation({ summary: 'Mark preparing' })
  async preparing(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.cc.markPreparing(id);
    return { data, message: 'OK' };
  }

  @Post(':id/ready')
  @ApiOperation({ summary: 'Mark ready for pickup' })
  async ready(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.cc.markReady(id);
    return { data, message: 'OK' };
  }

  @Post(':id/collected')
  @ApiOperation({ summary: 'Mark collected' })
  async collected(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user?: { id: string } },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.cc.markCollected(id, req.user?.id);
    return { data, message: 'OK' };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel click & collect' })
  async cancel(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.cc.cancelClickCollect(id);
    return { data, message: 'OK' };
  }
}
