import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  UseGuards,
  Request,
  Headers,
} from '@nestjs/common';
import { GDPRService } from './gdpr.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('gdpr')
@UseGuards(JwtAuthGuard)
export class GDPRController {
  constructor(private readonly gdprService: GDPRService) {}

  @Post('consent')
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
  async getConsent(@Request() req: any): Promise<ApiResponse<any>> {
    const consent = await this.gdprService.getConsent(req.user.id);
    return {
      data: consent,
      message: 'Consent retrieved successfully',
    };
  }

  @Get('export')
  async exportData(@Request() req: any): Promise<ApiResponse<any>> {
    const data = await this.gdprService.exportUserData(req.user.id);
    return {
      data,
      message: 'User data exported successfully',
    };
  }

  @Delete('data')
  async deleteData(@Request() req: any): Promise<ApiResponse<{ message: string }>> {
    await this.gdprService.deleteUserData(req.user.id);
    return {
      data: { message: 'User data deleted successfully' },
      message: 'User data deleted successfully',
    };
  }

  @Get('consent-history')
  async getConsentHistory(@Request() req: any): Promise<ApiResponse<any[]>> {
    const history = await this.gdprService.getConsentHistory(req.user.id);
    return {
      data: history,
      message: 'Consent history retrieved successfully',
    };
  }
}

