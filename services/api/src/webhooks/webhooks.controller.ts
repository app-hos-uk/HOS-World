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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('webhooks')
@Controller('webhooks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SELLER', 'B2C_SELLER', 'WHOLESALER')
@ApiBearerAuth('JWT-auth')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  @ApiOperation({
    summary: 'Create webhook',
    description: 'Creates a new webhook subscription. Requires ADMIN, SELLER, or B2C_SELLER role.',
  })
  @SwaggerApiResponse({ status: 201, description: 'Webhook created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid webhook data' })
  async create(
    @Body() createDto: CreateWebhookDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    // If user is seller, automatically set sellerId
    if (req.user.role === 'SELLER' || req.user.role === 'B2C_SELLER') {
      const seller = await this.webhooksService['prisma'].seller.findUnique({
        where: { userId: req.user.id },
      });
      if (seller) {
        createDto.sellerId = seller.id;
      }
    }

    const webhook = await this.webhooksService.create(createDto);
    return {
      data: webhook,
      message: 'Webhook created successfully',
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all webhooks',
    description: 'Retrieves all webhooks for the authenticated user or seller.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Webhooks retrieved successfully' })
  async findAll(@Request() req: any): Promise<ApiResponse<any[]>> {
    let sellerId: string | undefined;
    if (req.user.role === 'SELLER' || req.user.role === 'B2C_SELLER') {
      const seller = await this.webhooksService['prisma'].seller.findUnique({
        where: { userId: req.user.id },
      });
      if (seller) {
        sellerId = seller.id;
      }
    } else if (req.user.role !== 'ADMIN') {
      sellerId = undefined; // Only platform-wide for non-sellers
    }

    const webhooks = await this.webhooksService.findAll(sellerId);
    return {
      data: webhooks,
      message: 'Webhooks retrieved successfully',
    };
  }

  // ==================== Dead Letter Queue (must be before :id routes) ====================

  @Get('dlq/deliveries')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'List dead-lettered webhook deliveries',
    description: 'Returns deliveries that exhausted all retry attempts. Admin only.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @SwaggerApiResponse({ status: 200, description: 'Dead-lettered deliveries retrieved' })
  async listDeadLettered(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<ApiResponse<any>> {
    const [deliveries, total] = await Promise.all([
      this.webhooksService.listDeadLettered(
        limit ? parseInt(limit, 10) : 50,
        offset ? parseInt(offset, 10) : 0,
      ),
      this.webhooksService.countDeadLettered(),
    ]);
    return {
      data: { deliveries, total },
      message: 'Dead-lettered deliveries retrieved successfully',
    };
  }

  @Post('dlq/deliveries/:id/retry')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Retry a dead-lettered delivery',
    description: 'Resets attempt count and re-queues a dead-lettered webhook delivery. Admin only.',
  })
  @ApiParam({ name: 'id', description: 'Delivery UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Dead-lettered delivery retried' })
  async retryDeadLettered(@Param('id') id: string): Promise<ApiResponse<any>> {
    const result = await this.webhooksService.retryDeadLettered(id);
    return {
      data: result,
      message: 'Dead-lettered delivery retry attempted',
    };
  }

  // ==================== Parameterized routes ====================

  @Get(':id')
  @ApiOperation({
    summary: 'Get webhook by ID',
    description: 'Retrieves a specific webhook by ID.',
  })
  @ApiParam({ name: 'id', description: 'Webhook UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Webhook retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Webhook not found' })
  async findOne(@Param('id') id: string): Promise<ApiResponse<any>> {
    const webhook = await this.webhooksService.findOne(id);
    return {
      data: webhook,
      message: 'Webhook retrieved successfully',
    };
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update webhook',
    description: 'Updates an existing webhook.',
  })
  @ApiParam({ name: 'id', description: 'Webhook UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Webhook updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateWebhookDto>,
  ): Promise<ApiResponse<any>> {
    const webhook = await this.webhooksService.update(id, updateDto);
    return {
      data: webhook,
      message: 'Webhook updated successfully',
    };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete webhook',
    description: 'Deletes a webhook subscription.',
  })
  @ApiParam({ name: 'id', description: 'Webhook UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Webhook deleted successfully' })
  async delete(@Param('id') id: string): Promise<ApiResponse<any>> {
    await this.webhooksService.delete(id);
    return {
      data: null,
      message: 'Webhook deleted successfully',
    };
  }

  @Post('deliveries/:id/retry')
  @ApiOperation({
    summary: 'Retry webhook delivery',
    description: 'Retries a failed webhook delivery.',
  })
  @ApiParam({ name: 'id', description: 'Delivery UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Webhook delivery retried' })
  async retryDelivery(@Param('id') id: string): Promise<ApiResponse<any>> {
    const result = await this.webhooksService.retryDelivery(id);
    return {
      data: result,
      message: 'Webhook delivery retried',
    };
  }

  @Get(':id/deliveries')
  @ApiOperation({
    summary: 'Get webhook delivery history',
    description: 'Retrieves delivery history for a webhook.',
  })
  @ApiParam({ name: 'id', description: 'Webhook UUID', type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @SwaggerApiResponse({ status: 200, description: 'Delivery history retrieved successfully' })
  async getDeliveryHistory(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any[]>> {
    const deliveries = await this.webhooksService.getDeliveryHistory(
      id,
      limit ? parseInt(limit, 10) : 50,
    );
    return {
      data: deliveries,
      message: 'Delivery history retrieved successfully',
    };
  }
}
