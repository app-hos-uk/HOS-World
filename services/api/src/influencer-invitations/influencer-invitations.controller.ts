import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
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
import { InfluencerInvitationsService } from './influencer-invitations.service';
import { CreateInfluencerInvitationDto } from './dto/create-invitation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('influencer-invitations')
@Controller()
export class InfluencerInvitationsController {
  constructor(private readonly invitationsService: InfluencerInvitationsService) {}

  // ============================================
  // ADMIN ENDPOINTS
  // ============================================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MARKETING')
  @Post('admin/influencer-invitations')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Send influencer invitation',
    description: 'Send an invitation to become an influencer. Admin/Marketing access required.',
  })
  @ApiBody({ type: CreateInfluencerInvitationDto })
  @SwaggerApiResponse({ status: 201, description: 'Invitation sent successfully' })
  @SwaggerApiResponse({ status: 409, description: 'Invitation already pending for this email' })
  async create(
    @Request() req: any,
    @Body() dto: CreateInfluencerInvitationDto,
  ): Promise<ApiResponse<any>> {
    const invitation = await this.invitationsService.create(req.user.id, dto);
    return {
      data: invitation,
      message: 'Invitation sent successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MARKETING')
  @Get('admin/influencer-invitations')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'List all influencer invitations',
    description:
      'Get paginated list of all influencer invitations. Admin/Marketing access required.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED'],
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @SwaggerApiResponse({ status: 200, description: 'Invitations retrieved successfully' })
  async findAll(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.invitationsService.findAll({
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return {
      data: result.data,
      pagination: result.pagination,
      message: 'Invitations retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MARKETING')
  @Get('admin/influencer-invitations/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get invitation by ID',
    description: 'Get details of a specific invitation. Admin/Marketing access required.',
  })
  @ApiParam({ name: 'id', description: 'Invitation UUID' })
  @SwaggerApiResponse({ status: 200, description: 'Invitation retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Invitation not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    const invitation = await this.invitationsService.findOne(id);
    return {
      data: invitation,
      message: 'Invitation retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete('admin/influencer-invitations/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Cancel invitation',
    description: 'Cancel a pending invitation. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Invitation UUID' })
  @SwaggerApiResponse({ status: 200, description: 'Invitation cancelled successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Only pending invitations can be cancelled' })
  @SwaggerApiResponse({ status: 404, description: 'Invitation not found' })
  async cancel(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    const result = await this.invitationsService.cancel(id);
    return {
      data: null,
      message: result.message,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MARKETING')
  @Post('admin/influencer-invitations/:id/resend')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Resend invitation',
    description: 'Resend an invitation email and extend expiry. Admin/Marketing access required.',
  })
  @ApiParam({ name: 'id', description: 'Invitation UUID' })
  @SwaggerApiResponse({ status: 200, description: 'Invitation resent successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Only pending invitations can be resent' })
  @SwaggerApiResponse({ status: 404, description: 'Invitation not found' })
  async resend(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    const result = await this.invitationsService.resend(id);
    return {
      data: null,
      message: result.message,
    };
  }

  // ============================================
  // PUBLIC ENDPOINTS (for accepting invitations)
  // ============================================

  @Public()
  @Get('influencer-invitations/token/:token')
  @ApiOperation({
    summary: 'Get invitation by token',
    description: 'Get invitation details by token. Public endpoint for acceptance flow.',
  })
  @ApiParam({ name: 'token', description: 'Invitation token' })
  @SwaggerApiResponse({ status: 200, description: 'Invitation retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Invitation not found' })
  async findByToken(@Param('token') token: string): Promise<ApiResponse<any>> {
    const invitation = await this.invitationsService.findByToken(token);
    return {
      data: invitation,
      message: 'Invitation retrieved successfully',
    };
  }

  @Public()
  @Post('influencer-invitations/accept/:token')
  @ApiOperation({
    summary: 'Accept invitation',
    description: 'Accept an invitation and create influencer account. Public endpoint.',
  })
  @ApiParam({ name: 'token', description: 'Invitation token' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['password', 'firstName', 'lastName', 'displayName'],
      properties: {
        password: { type: 'string', minLength: 8 },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        displayName: { type: 'string', description: 'Public display name for storefront' },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Invitation accepted successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid or expired invitation' })
  @SwaggerApiResponse({ status: 404, description: 'Invitation not found' })
  async accept(
    @Param('token') token: string,
    @Body() body: { password: string; firstName: string; lastName: string; displayName: string },
  ): Promise<ApiResponse<any>> {
    const result = await this.invitationsService.accept(token, body);
    return {
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
        },
        influencer: result.influencer,
      },
      message: 'Invitation accepted successfully. You can now log in.',
    };
  }
}
