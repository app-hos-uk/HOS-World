import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  UseGuards,
  Request,
  Headers,
Version,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { GDPRService } from './gdpr.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('gdpr')
@ApiBearerAuth('JWT-auth')
@Version('1')
@Controller('gdpr')
@UseGuards(JwtAuthGuard)
export class GDPRController {
  constructor(private readonly gdprService: GDPRService) {}

  @Post('consent')
  @ApiOperation({ summary: 'Update GDPR consent', description: 'Updates the user\'s GDPR consent preferences for marketing, analytics, and essential cookies.' })
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
  @ApiOperation({ summary: 'Get GDPR consent', description: 'Retrieves the user\'s current GDPR consent preferences.' })
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
  @ApiOperation({ summary: 'Export user data', description: 'Exports all user data in compliance with GDPR right to data portability.' })
  @SwaggerApiResponse({ status: 200, description: 'User data exported successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async exportData(@Request() req: any): Promise<ApiResponse<any>> {
    const data = await this.gdprService.exportUserData(req.user.id);
    return {
      data,
      message: 'User data exported successfully',
    };
  }

  @Delete('data')
  @ApiOperation({ summary: 'Delete user data', description: 'Deletes all user data in compliance with GDPR right to be forgotten.' })
  @SwaggerApiResponse({ status: 200, description: 'User data deleted successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteData(@Request() req: any): Promise<ApiResponse<{ message: string }>> {
    await this.gdprService.deleteUserData(req.user.id);
    return {
      data: { message: 'User data deleted successfully' },
      message: 'User data deleted successfully',
    };
  }

  @Get('consent-history')
  @ApiOperation({ summary: 'Get consent history', description: 'Retrieves the history of all consent changes for the user.' })
  @SwaggerApiResponse({ status: 200, description: 'Consent history retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async getConsentHistory(@Request() req: any): Promise<ApiResponse<any[]>> {
    const history = await this.gdprService.getConsentHistory(req.user.id);
    return {
      data: history,
      message: 'Consent history retrieved successfully',
    };
  }
}

