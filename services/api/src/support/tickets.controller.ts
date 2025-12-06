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
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('support/tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
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

