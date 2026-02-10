import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GatewayAuthGuard, RolesGuard, CurrentUser, AuthUser, Roles } from '@hos-marketplace/auth-common';
import { GdprService } from './gdpr.service';

@ApiTags('gdpr')
@Controller('gdpr')
export class GdprController {
  constructor(private readonly gdprService: GdprService) {}

  @Post('consent')
  @UseGuards(GatewayAuthGuard)
  logConsent(@CurrentUser() user: AuthUser, @Body() body: { consentType: string; granted: boolean }, @Req() req: any) {
    return this.gdprService.logConsent(user.id, body.consentType, body.granted, req.ip);
  }

  @Get('consent/me')
  @UseGuards(GatewayAuthGuard)
  getMyConsents(@CurrentUser() user: AuthUser) { return this.gdprService.getUserConsents(user.id); }

  @Get('export/me')
  @UseGuards(GatewayAuthGuard)
  exportMyData(@CurrentUser() user: AuthUser) { return this.gdprService.exportUserData(user.id); }

  @Get('export/:userId')
  @UseGuards(GatewayAuthGuard, RolesGuard)
  @Roles('ADMIN')
  exportUserData(@Param('userId') userId: string) { return this.gdprService.exportUserData(userId); }
}
