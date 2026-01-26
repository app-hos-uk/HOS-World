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
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { CreateInventoryLocationDto } from './dto/create-inventory-location.dto';
import { ReserveStockDto } from './dto/reserve-stock.dto';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Request } from '@nestjs/common';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('warehouses')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create warehouse',
    description: 'Creates a new warehouse. Requires ADMIN, SELLER, or B2C_SELLER role.',
  })
  @SwaggerApiResponse({ status: 201, description: 'Warehouse created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid warehouse data' })
  async createWarehouse(
    @Body() createDto: CreateWarehouseDto,
  ): Promise<ApiResponse<any>> {
    const warehouse = await this.inventoryService.createWarehouse(createDto);
    return {
      data: warehouse,
      message: 'Warehouse created successfully',
    };
  }

  @Get('warehouses')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER', 'FULFILLMENT')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get all warehouses',
    description: 'Retrieves all warehouses. Requires ADMIN, SELLER, B2C_SELLER, or FULFILLMENT role.',
  })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @SwaggerApiResponse({ status: 200, description: 'Warehouses retrieved successfully' })
  async findAllWarehouses(
    @Query('includeInactive') includeInactive?: string,
  ): Promise<ApiResponse<any[]>> {
    const warehouses = await this.inventoryService.findAllWarehouses(
      includeInactive === 'true',
    );
    return {
      data: warehouses,
      message: 'Warehouses retrieved successfully',
    };
  }

  @Get('warehouses/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER', 'FULFILLMENT')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get warehouse by ID',
    description: 'Retrieves a specific warehouse by ID.',
  })
  @ApiParam({ name: 'id', description: 'Warehouse UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Warehouse retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Warehouse not found' })
  async findWarehouseById(
    @Param('id') id: string,
  ): Promise<ApiResponse<any>> {
    const warehouse = await this.inventoryService.findWarehouseById(id);
    return {
      data: warehouse,
      message: 'Warehouse retrieved successfully',
    };
  }

  @Post('locations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER', 'FULFILLMENT')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create or update inventory location',
    description: 'Creates or updates inventory for a product in a warehouse.',
  })
  @SwaggerApiResponse({ status: 201, description: 'Inventory location created/updated successfully' })
  async upsertInventoryLocation(
    @Body() createDto: CreateInventoryLocationDto,
  ): Promise<ApiResponse<any>> {
    const location = await this.inventoryService.upsertInventoryLocation(createDto);
    return {
      data: location,
      message: 'Inventory location created/updated successfully',
    };
  }

  @Get('products/:productId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER', 'FULFILLMENT')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get product inventory',
    description: 'Retrieves inventory for a product across all warehouses.',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Product inventory retrieved successfully' })
  async getProductInventory(
    @Param('productId') productId: string,
  ): Promise<ApiResponse<any>> {
    const inventory = await this.inventoryService.getProductInventory(productId);
    return {
      data: inventory,
      message: 'Product inventory retrieved successfully',
    };
  }

  @Post('reserve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Reserve stock',
    description: 'Reserves stock for an order or cart.',
  })
  @SwaggerApiResponse({ status: 201, description: 'Stock reserved successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Insufficient stock' })
  async reserveStock(
    @Body() reserveDto: ReserveStockDto,
  ): Promise<ApiResponse<any>> {
    const reservation = await this.inventoryService.reserveStock(reserveDto);
    return {
      data: reservation,
      message: 'Stock reserved successfully',
    };
  }

  @Post('reservations/:id/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FULFILLMENT')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Confirm reservation',
    description: 'Confirms a stock reservation and deducts from inventory.',
  })
  @ApiParam({ name: 'id', description: 'Reservation UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Reservation confirmed successfully' })
  async confirmReservation(
    @Param('id') id: string,
    @Body() body: { orderId: string },
  ): Promise<ApiResponse<any>> {
    const reservation = await this.inventoryService.confirmReservation(
      id,
      body.orderId,
    );
    return {
      data: reservation,
      message: 'Reservation confirmed successfully',
    };
  }

  @Post('reservations/:id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Cancel reservation',
    description: 'Cancels a stock reservation and releases the stock.',
  })
  @ApiParam({ name: 'id', description: 'Reservation UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Reservation cancelled successfully' })
  async cancelReservation(
    @Param('id') id: string,
  ): Promise<ApiResponse<any>> {
    const reservation = await this.inventoryService.cancelReservation(id);
    return {
      data: reservation,
      message: 'Reservation cancelled successfully',
    };
  }

  @Get('alerts/low-stock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER', 'FULFILLMENT')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get low stock alerts',
    description: 'Retrieves products with low stock levels.',
  })
  @ApiQuery({ name: 'warehouseId', required: false, type: String })
  @SwaggerApiResponse({ status: 200, description: 'Low stock alerts retrieved successfully' })
  async getLowStockAlerts(
    @Query('warehouseId') warehouseId?: string,
  ): Promise<ApiResponse<any[]>> {
    const alerts = await this.inventoryService.getLowStockAlerts(warehouseId);
    return {
      data: alerts,
      message: 'Low stock alerts retrieved successfully',
    };
  }

  @Post('allocate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FULFILLMENT')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Allocate stock for order',
    description: 'Automatically allocates stock from warehouses for order items.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Stock allocated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Insufficient stock' })
  async allocateStockForOrder(
    @Body() body: {
      orderItems: Array<{ productId: string; quantity: number }>;
    },
  ): Promise<ApiResponse<any[]>> {
    const allocations = await this.inventoryService.allocateStockForOrder(
      body.orderItems,
    );
    return {
      data: allocations,
      message: 'Stock allocated successfully',
    };
  }

  @Post('allocate-with-location')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FULFILLMENT')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Allocate stock for order with location priority',
    description: 'Allocates stock from nearest warehouses based on shipping address.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Stock allocated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Insufficient stock' })
  async allocateStockForOrderWithLocation(
    @Body() body: {
      orderItems: Array<{ productId: string; quantity: number }>;
      shippingAddress: {
        country: string;
        state?: string;
        city?: string;
        postalCode?: string;
      };
    },
  ): Promise<ApiResponse<any[]>> {
    const allocations = await this.inventoryService.allocateStockForOrderWithLocation(
      body.orderItems,
      body.shippingAddress,
    );
    return {
      data: allocations,
      message: 'Stock allocated successfully',
    };
  }

  // Stock Transfers
  @Post('transfers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FULFILLMENT', 'SELLER', 'B2C_SELLER')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create stock transfer',
    description: 'Creates a stock transfer request between warehouses.',
  })
  @SwaggerApiResponse({ status: 201, description: 'Stock transfer created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Insufficient stock or invalid request' })
  async createStockTransfer(
    @Body() createDto: CreateStockTransferDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const transfer = await this.inventoryService.transferStock(
      createDto,
      req.user.id,
    );
    return {
      data: transfer,
      message: 'Stock transfer created successfully',
    };
  }

  @Get('transfers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FULFILLMENT', 'SELLER', 'B2C_SELLER')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get stock transfers',
    description: 'Retrieves stock transfers with optional filters.',
  })
  @ApiQuery({ name: 'fromWarehouseId', required: false, type: String })
  @ApiQuery({ name: 'toWarehouseId', required: false, type: String })
  @ApiQuery({ name: 'productId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @SwaggerApiResponse({ status: 200, description: 'Stock transfers retrieved successfully' })
  async getStockTransfers(
    @Query('fromWarehouseId') fromWarehouseId?: string,
    @Query('toWarehouseId') toWarehouseId?: string,
    @Query('productId') productId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.inventoryService.getStockTransfers({
      fromWarehouseId,
      toWarehouseId,
      productId,
      status,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
    return {
      data: result,
      message: 'Stock transfers retrieved successfully',
    };
  }

  @Post('transfers/:id/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FULFILLMENT')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Complete stock transfer',
    description: 'Completes a stock transfer and updates inventory.',
  })
  @ApiParam({ name: 'id', description: 'Transfer UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Stock transfer completed successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Transfer not found' })
  async completeStockTransfer(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const transfer = await this.inventoryService.completeStockTransfer(
      id,
      req.user.id,
    );
    return {
      data: transfer,
      message: 'Stock transfer completed successfully',
    };
  }

  // Stock Movements
  @Post('movements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FULFILLMENT', 'SELLER', 'B2C_SELLER')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Record stock movement',
    description: 'Records a stock movement for audit trail (adjustments, returns, etc.).',
  })
  @SwaggerApiResponse({ status: 201, description: 'Stock movement recorded successfully' })
  async recordStockMovement(
    @Body() createDto: CreateStockMovementDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const movement = await this.inventoryService.recordStockMovement(
      createDto,
      req.user.id,
    );
    return {
      data: movement,
      message: 'Stock movement recorded successfully',
    };
  }

  @Get('movements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FULFILLMENT', 'SELLER', 'B2C_SELLER')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get stock movement history',
    description: 'Retrieves stock movement history with optional filters.',
  })
  @ApiQuery({ name: 'inventoryLocationId', required: false, type: String })
  @ApiQuery({ name: 'productId', required: false, type: String })
  @ApiQuery({ name: 'warehouseId', required: false, type: String })
  @ApiQuery({ name: 'movementType', required: false, type: String })
  @ApiQuery({ name: 'referenceType', required: false, type: String })
  @ApiQuery({ name: 'referenceId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @SwaggerApiResponse({ status: 200, description: 'Stock movements retrieved successfully' })
  async getStockMovements(
    @Query('inventoryLocationId') inventoryLocationId?: string,
    @Query('productId') productId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('movementType') movementType?: string,
    @Query('referenceType') referenceType?: string,
    @Query('referenceId') referenceId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.inventoryService.getStockMovements({
      inventoryLocationId,
      productId,
      warehouseId,
      movementType,
      referenceType,
      referenceId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
    return {
      data: result,
      message: 'Stock movements retrieved successfully',
    };
  }
}
