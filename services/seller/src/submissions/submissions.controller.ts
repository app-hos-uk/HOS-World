import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GatewayAuthGuard, Roles, CurrentUser, AuthUser } from '@hos-marketplace/auth-common';
import { SubmissionsService } from './submissions.service';

@ApiTags('submissions')
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  @UseGuards(GatewayAuthGuard)
  @Roles('SELLER', 'B2C_SELLER', 'WHOLESALER')
  create(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.submissionsService.create(user.sellerId || user.id, body);
  }

  @Get()
  @UseGuards(GatewayAuthGuard)
  findAll(@Query('sellerId') sellerId?: string, @Query('status') status?: string) {
    return this.submissionsService.findAll(sellerId, status);
  }

  @Get(':id')
  @UseGuards(GatewayAuthGuard)
  findOne(@Param('id') id: string) {
    return this.submissionsService.findOne(id);
  }

  @Post(':id/approve')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN', 'PROCUREMENT')
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body('reviewNotes') notes?: string) {
    return this.submissionsService.approve(id, user.id, notes);
  }

  @Post(':id/reject')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN', 'PROCUREMENT')
  reject(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body('reviewNotes') notes?: string) {
    return this.submissionsService.reject(id, user.id, notes);
  }
}
