import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ClickCollectService } from './click-collect.service';
import { CreateClickCollectDto } from './dto/create-click-collect.dto';

@ApiTags('click-collect')
@ApiBearerAuth('JWT-auth')
@Controller('click-collect')
@UseGuards(JwtAuthGuard)
export class ClickCollectCustomerController {
  constructor(private cc: ClickCollectService) {}

  @Post()
  @ApiOperation({ summary: 'Create click & collect for an order' })
  async create(
    @Req() req: { user: { id: string } },
    @Body() dto: CreateClickCollectDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.cc.createClickCollect(req.user.id, dto);
    return { data, message: 'OK' };
  }

  @Get('my-orders')
  @ApiOperation({ summary: 'My active click & collect orders' })
  async mine(@Req() req: { user: { id: string } }): Promise<ApiResponse<unknown>> {
    const data = await this.cc.listMine(req.user.id);
    return { data, message: 'OK' };
  }

  @Get('stores')
  @ApiOperation({ summary: 'Eligible stores for products' })
  async stores(
    @Query('productIds') productIds?: string,
    @Query('verifyInventory') verifyInventory?: string,
  ): Promise<ApiResponse<unknown>> {
    const ids = productIds
      ? productIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const data = await this.cc.getEligibleStores(ids, {
      verifyInventory: verifyInventory === 'true' || verifyInventory === '1',
    });
    return { data, message: 'OK' };
  }
}
