import { Controller, Get, Post, Delete, Body, Query, UseGuards, Request, Headers } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { GDPRService, CURRENT_PRIVACY_POLICY_VERSION } from './gdpr.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('privacy')
@ApiBearerAuth('JWT-auth')
@Controller('gdpr')
@UseGuards(JwtAuthGuard)
export class GDPRController {
  constructor(private readonly gdprService: GDPRService) {}

  @Post('consent')
  @ApiOperation({
    summary: 'Update privacy consent',
    description:
      "Updates the user's privacy consent preferences for marketing, analytics, and essential cookies (CCPA compliant).",
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        marketing: { type: 'boolean', description: 'Marketing consent' },
        analytics: { type: 'boolean', description: 'Analytics consent' },
        essential: { type: 'boolean', description: 'Essential cookies consent' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Consent updated successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async updateConsent(
    @Request() req: any,
    @Body() body: { marketing?: boolean; analytics?: boolean; essential?: boolean },
    @Headers('x-forwarded-for') forwardedFor?: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<ApiResponse<any>> {
    const ipAddress = forwardedFor?.split(',')[0] || req.ip;
    await this.gdprService.updateConsent(req.user.id, body, ipAddress, userAgent);

    return {
      data: { message: 'Consent updated successfully' },
      message: 'Consent updated successfully',
    };
  }

  @Get('consent')
  @ApiOperation({
    summary: 'Get privacy consent',
    description: "Retrieves the user's current privacy consent preferences.",
  })
  @SwaggerApiResponse({ status: 200, description: 'Consent retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async getConsent(@Request() req: any): Promise<ApiResponse<any>> {
    const consent = await this.gdprService.getConsent(req.user.id);
    return {
      data: consent,
      message: 'Consent retrieved successfully',
    };
  }

  @Get('export')
  @ApiOperation({
    summary: 'Export user data',
    description: 'Exports all user data in compliance with CCPA right to know.',
  })
  @SwaggerApiResponse({ status: 200, description: 'User data exported successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async exportData(
    @Request() req: any,
    @Headers('x-forwarded-for') forwardedFor?: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<ApiResponse<any>> {
    const ipAddress = forwardedFor?.split(',')[0] || req.ip;
    const data = await this.gdprService.exportUserData(req.user.id, ipAddress, userAgent);
    return {
      data,
      message: 'User data exported successfully',
    };
  }

  @Delete('data')
  @ApiOperation({
    summary: 'Delete user data',
    description: 'Deletes all user data in compliance with CCPA right to deletion.',
  })
  @SwaggerApiResponse({ status: 200, description: 'User data deleted successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteData(
    @Request() req: any,
    @Headers('x-forwarded-for') forwardedFor?: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<ApiResponse<{ message: string }>> {
    const ipAddress = forwardedFor?.split(',')[0] || req.ip;
    await this.gdprService.deleteUserData(req.user.id, ipAddress, userAgent);
    return {
      data: { message: 'User data deleted successfully' },
      message: 'User data deleted successfully',
    };
  }

  @Get('consent-history')
  @ApiOperation({
    summary: 'Get consent history',
    description: 'Retrieves the history of all consent changes for the user.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Consent history retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async getConsentHistory(@Request() req: any): Promise<ApiResponse<any[]>> {
    const history = await this.gdprService.getConsentHistory(req.user.id);
    return {
      data: history,
      message: 'Consent history retrieved successfully',
    };
  }

  @Post('do-not-sell')
  @Public()
  @ApiOperation({
    summary: 'Do Not Sell or Share My Personal Information (Public)',
    description:
      'CCPA opt-out: public endpoint for opting out of sale/sharing by email. No authentication required.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        optOut: { type: 'boolean', description: 'true = opt-out of sale/sharing' },
        email: { type: 'string', description: 'Email address for opt-out' },
      },
      required: ['optOut', 'email'],
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Do Not Sell preference updated' })
  async setDoNotSellPublic(
    @Request() req: any,
    @Body() body: { optOut: boolean; email: string },
    @Headers('x-forwarded-for') forwardedFor?: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<ApiResponse<any>> {
    const ipAddress = forwardedFor?.split(',')[0] || req.ip;
    const { updated } = await this.gdprService.setDoNotSellByEmail(
      body.email,
      body.optOut,
      ipAddress,
      userAgent,
    );
    return {
      data: { doNotSell: body.optOut, updated },
      message: `Do Not Sell preference ${body.optOut ? 'enabled' : 'disabled'} successfully`,
    };
  }

  @Get('policy-version')
  @ApiOperation({
    summary: 'Get current privacy policy version',
    description: 'Returns the current privacy policy version string.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Policy version returned' })
  async getPolicyVersion(): Promise<ApiResponse<{ version: string }>> {
    return {
      data: { version: CURRENT_PRIVACY_POLICY_VERSION },
      message: 'Current privacy policy version',
    };
  }

  @Get('admin/audit-log')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Admin: consent audit log',
    description:
      'Returns paginated consent event log for all users. Restricted to ADMIN role.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @SwaggerApiResponse({ status: 200, description: 'Audit log returned' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden' })
  async getAuditLog(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<{ logs: any[]; total: number }>> {
    const data = await this.gdprService.getConsentAuditLog(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
    return { data, message: 'Audit log retrieved successfully' };
  }
}
