import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GatewayAuthGuard, Roles } from '@hos-marketplace/auth-common';
import { LogisticsService } from './logistics.service';

@ApiTags('logistics')
@Controller('logistics')
export class LogisticsController {
  constructor(private readonly logisticsService: LogisticsService) {}

  @Post('partners')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN')
  create(@Body() body: any) {
    return this.logisticsService.createPartner(body);
  }

  @Get('partners')
  findAll(@Query('activeOnly') activeOnly?: string) {
    return this.logisticsService.findAllPartners(activeOnly === 'true');
  }

  @Get('partners/:id')
  findOne(@Param('id') id: string) {
    return this.logisticsService.findOnePartner(id);
  }

  @Put('partners/:id')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() body: any) {
    return this.logisticsService.updatePartner(id, body);
  }

  @Delete('partners/:id')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.logisticsService.deletePartner(id);
  }

  @Post('assign/:shipmentId/:partnerId')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN', 'FULFILLMENT')
  assign(@Param('shipmentId') shipmentId: string, @Param('partnerId') partnerId: string) {
    return this.logisticsService.assignPartnerToShipment(shipmentId, partnerId);
  }
}
