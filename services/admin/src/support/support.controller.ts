import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GatewayAuthGuard, Roles, CurrentUser, AuthUser } from '@hos-marketplace/auth-common';
import { SupportService } from './support.service';

@ApiTags('support')
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('tickets')
  @UseGuards(GatewayAuthGuard)
  createTicket(@CurrentUser() user: AuthUser, @Body() body: any) { return this.supportService.createTicket(user.id, body); }

  @Get('tickets')
  @UseGuards(GatewayAuthGuard)
  findAll(@Query('status') status?: string, @Query('userId') userId?: string, @Query('page') page?: string) {
    return this.supportService.findAll({ status, userId, page: page ? parseInt(page) : undefined });
  }

  @Get('tickets/:id')
  @UseGuards(GatewayAuthGuard)
  findOne(@Param('id') id: string) { return this.supportService.findOne(id); }

  @Post('tickets/:id/messages')
  @UseGuards(GatewayAuthGuard)
  addMessage(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() body: { content: string; isInternal?: boolean }) {
    return this.supportService.addMessage(id, user.id, body.content, body.isInternal);
  }

  @Put('tickets/:id/status')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN')
  updateStatus(@Param('id') id: string, @Body() body: { status: string; assignedTo?: string }) {
    return this.supportService.updateStatus(id, body.status, body.assignedTo);
  }

  @Get('knowledge-base')
  getKnowledgeBase(@Query('category') category?: string) { return this.supportService.getKnowledgeBase(category); }
}
