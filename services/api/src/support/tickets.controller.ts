import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Request,
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
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('support')
@Controller('support/tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create support ticket',
    description: 'Creates a new support ticket. Users can create tickets for orders, products, returns, or general support.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['subject', 'category', 'initialMessage'],
      properties: {
        userId: { type: 'string', format: 'uuid' },
        sellerId: { type: 'string', format: 'uuid' },
        orderId: { type: 'string', format: 'uuid' },
        subject: { type: 'string' },
        category: {
          type: 'string',
          enum: ['ORDER_INQUIRY', 'PRODUCT_QUESTION', 'RETURN_REQUEST', 'PAYMENT_ISSUE', 'TECHNICAL_SUPPORT', 'SELLER_SUPPORT', 'OTHER'],
        },
        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
        initialMessage: { type: 'string' },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Ticket created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async createTicket(
    @Body()
    body: {
      userId?: string;
      sellerId?: string;
      orderId?: string;
      subject: string;
      category: 'ORDER_INQUIRY' | 'PRODUCT_QUESTION' | 'RETURN_REQUEST' | 'PAYMENT_ISSUE' | 'TECHNICAL_SUPPORT' | 'SELLER_SUPPORT' | 'OTHER';
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
      initialMessage: string;
    },
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const ticket = await this.ticketsService.createTicket({
      ...body,
      userId: body.userId || req.user?.id,
    });
    return {
      data: ticket,
      message: 'Ticket created successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get all tickets (Admin only)',
    description: 'Retrieves all support tickets with filtering options. Admin access required.',
  })
  @ApiQuery({ name: 'userId', required: false, type: String, description: 'Filter by user ID' })
  @ApiQuery({ name: 'sellerId', required: false, type: String, description: 'Filter by seller ID' })
  @ApiQuery({ name: 'orderId', required: false, type: String, description: 'Filter by order ID' })
  @ApiQuery({ name: 'category', required: false, type: String, description: 'Filter by category' })
  @ApiQuery({ name: 'priority', required: false, type: String, description: 'Filter by priority' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by status' })
  @ApiQuery({ name: 'assignedTo', required: false, type: String, description: 'Filter by assigned user ID' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date (ISO format)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date (ISO format)' })
  @ApiQuery({ name: 'page', required: false, type: String, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: String, description: 'Items per page' })
  @SwaggerApiResponse({ status: 200, description: 'Tickets retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getTickets(
    @Query('userId') userId?: string,
    @Query('sellerId') sellerId?: string,
    @Query('orderId') orderId?: string,
    @Query('category') category?: string,
    @Query('priority') priority?: string,
    @Query('status') status?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.ticketsService.getTickets({
      userId,
      sellerId,
      orderId,
      category: category as any,
      priority: priority as any,
      status: status as any,
      assignedTo,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return {
      data: result,
      message: 'Tickets retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get ticket by ID',
    description: 'Retrieves a specific ticket by ID. Users can only view their own tickets unless they are admin.',
  })
  @ApiParam({ name: 'id', description: 'Ticket UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Ticket retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Cannot access this ticket' })
  @SwaggerApiResponse({ status: 404, description: 'Ticket not found' })
  async getTicketById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<any>> {
    const ticket = await this.ticketsService.getTicketById(id);
    return {
      data: ticket,
      message: 'Ticket retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update ticket (Admin only)',
    description: 'Updates ticket details. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Ticket UUID', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        subject: { type: 'string' },
        category: { type: 'string' },
        priority: { type: 'string' },
        status: { type: 'string' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Ticket updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Ticket not found' })
  async updateTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      subject?: string;
      category?: string;
      priority?: string;
      status?: string;
    },
  ): Promise<ApiResponse<any>> {
    const ticket = await this.ticketsService.updateTicket(id, body);
    return {
      data: ticket,
      message: 'Ticket updated successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/messages')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Add message to ticket',
    description: 'Adds a message to a support ticket. Users can add messages to their own tickets.',
  })
  @ApiParam({ name: 'id', description: 'Ticket UUID', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['content'],
      properties: {
        content: { type: 'string', description: 'Message content' },
        isInternal: { type: 'boolean', description: 'Mark as internal note (admin only)' },
        attachments: { type: 'array', description: 'File attachments' },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Message added successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Cannot add message to this ticket' })
  @SwaggerApiResponse({ status: 404, description: 'Ticket not found' })
  async addMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      content: string;
      isInternal?: boolean;
      attachments?: any;
    },
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const message = await this.ticketsService.addMessage(id, {
      userId: req.user?.id,
      ...body,
    });
    return {
      data: message,
      message: 'Message added successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put(':id/assign')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Assign ticket (Admin only)',
    description: 'Assigns a ticket to a support agent. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Ticket UUID', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['assignedTo'],
      properties: {
        assignedTo: { type: 'string', format: 'uuid', description: 'User ID to assign ticket to' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Ticket assigned successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Ticket or user not found' })
  async assignTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { assignedTo: string },
  ): Promise<ApiResponse<any>> {
    const ticket = await this.ticketsService.assignTicket(id, body.assignedTo);
    return {
      data: ticket,
      message: 'Ticket assigned successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put(':id/status')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update ticket status (Admin only)',
    description: 'Updates the status of a support ticket. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Ticket UUID', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['status'],
      properties: {
        status: {
          type: 'string',
          enum: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'],
        },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Ticket status updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid status' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Ticket not found' })
  async updateTicketStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED' },
  ): Promise<ApiResponse<any>> {
    const ticket = await this.ticketsService.updateTicketStatus(id, body.status);
    return {
      data: ticket,
      message: 'Ticket status updated successfully',
    };
  }
}

