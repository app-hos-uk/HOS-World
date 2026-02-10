import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { GatewayAuthGuard, Roles, CurrentUser, AuthUser } from '@hos-marketplace/auth-common';
import { FulfillmentService } from './fulfillment.service';

@ApiTags('fulfillment')
@Controller('fulfillment')
export class FulfillmentController {
  constructor(private readonly fulfillmentService: FulfillmentService) {}

  @Post('centers')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN', 'FULFILLMENT')
  createCenter(@Body() body: any) {
    return this.fulfillmentService.createFulfillmentCenter(body);
  }

  @Get('centers')
  findAllCenters(@Query('activeOnly') activeOnly?: string) {
    return this.fulfillmentService.findAllFulfillmentCenters(activeOnly === 'true');
  }

  @Get('centers/:id')
  findOneCenter(@Param('id') id: string) {
    return this.fulfillmentService.findOneFulfillmentCenter(id);
  }

  @Put('centers/:id')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN', 'FULFILLMENT')
  updateCenter(@Param('id') id: string, @Body() body: any) {
    return this.fulfillmentService.updateFulfillmentCenter(id, body);
  }

  @Delete('centers/:id')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN')
  deleteCenter(@Param('id') id: string) {
    return this.fulfillmentService.deleteFulfillmentCenter(id);
  }

  @Post('shipments')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN', 'FULFILLMENT')
  createShipment(@Body() body: any) {
    return this.fulfillmentService.createShipment(body);
  }

  @Get('shipments')
  findAllShipments(@Query('status') status?: string, @Query('fulfillmentCenterId') fcId?: string) {
    return this.fulfillmentService.findAllShipments(status, fcId);
  }

  @Get('shipments/:id')
  findOneShipment(@Param('id') id: string) {
    return this.fulfillmentService.findOneShipment(id);
  }

  @Post('shipments/:id/verify')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN', 'FULFILLMENT')
  verifyShipment(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() body: any) {
    return this.fulfillmentService.verifyShipment(id, user.id, body);
  }

  @Get('dashboard')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN', 'FULFILLMENT')
  getDashboard(@Query('fulfillmentCenterId') fcId?: string) {
    return this.fulfillmentService.getDashboardStats(fcId);
  }
}
