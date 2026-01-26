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
Version,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { AdminSellersService } from './sellers.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@Version('1')
@Controller('admin/sellers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminSellersController {
  constructor(private readonly sellersService: AdminSellersService) {}

  @Post('invite')
  @ApiOperation({
    summary: 'Invite seller (Admin only)',
    description: 'Sends an invitation email to a new seller. The seller will receive an email with an invitation link.',
  })
  @ApiBody({
    description: 'Seller invitation data',
    schema: {
      type: 'object',
      required: ['email', 'sellerType'],
      properties: {
        email: { type: 'string', format: 'email', example: 'seller@example.com' },
        sellerType: { type: 'string', enum: ['WHOLESALER', 'B2C_SELLER'], example: 'B2C_SELLER' },
        message: { type: 'string', description: 'Optional custom message for the invitation' },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Seller invitation sent successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
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
  @ApiOperation({
    summary: 'Get seller invitations (Admin only)',
    description: 'Retrieves all seller invitations. Can filter by status (PENDING, ACCEPTED, EXPIRED, CANCELLED).',
  })
  @SwaggerApiResponse({ status: 200, description: 'Invitations retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
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
  @ApiOperation({
    summary: 'Resend seller invitation (Admin only)',
    description: 'Resends an invitation email to a seller. Useful if the original email was not received.',
  })
  @ApiParam({ name: 'id', description: 'Invitation UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Invitation resent successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Invitation not found' })
  async resendInvitation(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    const invitation = await this.sellersService.resendInvitation(id);
    return {
      data: invitation,
      message: 'Invitation resent successfully',
    };
  }

  @Delete('invitations/:id')
  @ApiOperation({
    summary: 'Cancel seller invitation (Admin only)',
    description: 'Cancels a pending seller invitation. The invitation link will no longer be valid.',
  })
  @ApiParam({ name: 'id', description: 'Invitation UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Invitation cancelled successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Invitation not found' })
  async cancelInvitation(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    await this.sellersService.cancelInvitation(id);
    return {
      data: { id },
      message: 'Invitation cancelled successfully',
    };
  }
}

