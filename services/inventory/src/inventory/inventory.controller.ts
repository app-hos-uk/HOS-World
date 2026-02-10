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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { GatewayAuthGuard, Roles, CurrentUser, AuthUser } from '@hos-marketplace/auth-common';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ─── Warehouses ───────────────────────────────────
  @Post('warehouses')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN', 'FULFILLMENT')
  @ApiBearerAuth('JWT-auth')
  createWarehouse(@Body() body: any) {
    return this.inventoryService.createWarehouse(body);
  }

  @Get('warehouses')
  findAllWarehouses(@Query('includeInactive') includeInactive?: string) {
    return this.inventoryService.findAllWarehouses(includeInactive === 'true');
  }

  @Get('warehouses/:id')
  findWarehouse(@Param('id') id: string) {
    return this.inventoryService.findWarehouseById(id);
  }

  @Put('warehouses/:id')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN', 'FULFILLMENT')
  updateWarehouse(@Param('id') id: string, @Body() body: any) {
    return this.inventoryService.updateWarehouse(id, body);
  }

  @Delete('warehouses/:id')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN')
  deleteWarehouse(@Param('id') id: string) {
    return this.inventoryService.deleteWarehouse(id);
  }

  // ─── Product Inventory ────────────────────────────
  @Get('products/:productId')
  getProductInventory(@Param('productId') productId: string) {
    return this.inventoryService.getProductInventory(productId);
  }

  // ─── Reservations ─────────────────────────────────
  @Post('reservations')
  @UseGuards(GatewayAuthGuard)
  reserveStock(@Body() body: any) {
    return this.inventoryService.reserveStock(body);
  }

  @Post('reservations/:id/confirm')
  @UseGuards(GatewayAuthGuard)
  confirmReservation(@Param('id') id: string, @Body('orderId') orderId: string) {
    return this.inventoryService.confirmReservation(id, orderId);
  }

  @Post('reservations/:id/cancel')
  @UseGuards(GatewayAuthGuard)
  cancelReservation(@Param('id') id: string) {
    return this.inventoryService.cancelReservation(id);
  }

  // ─── Alerts & Metrics ─────────────────────────────
  @Get('alerts/low-stock')
  getLowStockAlerts(@Query('warehouseId') warehouseId?: string) {
    return this.inventoryService.getLowStockAlerts(warehouseId);
  }

  @Get('metrics')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN', 'FULFILLMENT')
  getMetrics() {
    return this.inventoryService.getInventoryMetrics();
  }
}
