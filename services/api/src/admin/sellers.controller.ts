import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import { AdminSellersService } from './sellers.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('admin/sellers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminSellersController {
  constructor(private readonly sellersService: AdminSellersService) {}

  @Post('invite')
  async inviteSeller(
    @Body() body: { email: string; sellerType: 'WHOLESALER' | 'B2C_SELLER'; message?: string },
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const invitation = await this.sellersService.inviteSeller(
      body.email,
      body.sellerType,
      req.user.id,
      body.message,
    );
    return {
      data: invitation,
      message: 'Seller invitation sent successfully',
    };
  }

  @Get('invitations')
  async getInvitations(@Body() body?: { status?: string }): Promise<ApiResponse<any[]>> {
    const invitations = await this.sellersService.getInvitations(
      body?.status as any,
    );
    return {
      data: invitations,
      message: 'Invitations retrieved successfully',
    };
  }

  @Put('invitations/:id/resend')
  async resendInvitation(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    const invitation = await this.sellersService.resendInvitation(id);
    return {
      data: invitation,
      message: 'Invitation resent successfully',
    };
  }

  @Delete('invitations/:id')
  async cancelInvitation(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    await this.sellersService.cancelInvitation(id);
    return {
      data: { id },
      message: 'Invitation cancelled successfully',
    };
  }
}

