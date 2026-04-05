import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  Request,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './strategies/guards/google-auth.guard';
import { FacebookAuthGuard } from './strategies/guards/facebook-auth.guard';
import { AppleAuthGuard } from './strategies/guards/apple-auth.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { setAuthCookies } from './cookie.utils';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('auth')
export class AuthOAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  // Google OAuth
  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // Initiates Google OAuth flow
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(@Request() req: any, @Res() res: Response) {
    const { token, refreshToken } = req.user;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    setAuthCookies(res, token, refreshToken, this.configService);
    res.redirect(`${frontendUrl}/auth/callback?provider=google`);
  }

  // Facebook OAuth
  @Public()
  @Get('facebook')
  @UseGuards(FacebookAuthGuard)
  async facebookAuth() {
    // Initiates Facebook OAuth flow
  }

  @Public()
  @Get('facebook/callback')
  @UseGuards(FacebookAuthGuard)
  async facebookAuthCallback(@Request() req: any, @Res() res: Response) {
    const { token, refreshToken } = req.user;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    setAuthCookies(res, token, refreshToken, this.configService);
    res.redirect(`${frontendUrl}/auth/callback?provider=facebook`);
  }

  // Apple OAuth
  @Public()
  @Get('apple')
  @UseGuards(AppleAuthGuard)
  async appleAuth() {
    // Initiates Apple OAuth flow
  }

  @Public()
  @Get('apple/callback')
  @UseGuards(AppleAuthGuard)
  async appleAuthCallback(@Request() req: any, @Res() res: Response) {
    const { token, refreshToken } = req.user;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    setAuthCookies(res, token, refreshToken, this.configService);
    res.redirect(`${frontendUrl}/auth/callback?provider=apple`);
  }

  // OAuth Account Management
  @UseGuards(JwtAuthGuard)
  @Get('oauth/accounts')
  async getLinkedAccounts(@Request() req: any): Promise<ApiResponse<any[]>> {
    const accounts = await this.authService.getLinkedAccounts(req.user.id);
    return {
      data: accounts,
      message: 'Linked accounts retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('oauth/accounts/:provider')
  @HttpCode(HttpStatus.OK)
  async unlinkAccount(
    @Request() req: any,
    @Param('provider') provider: string,
  ): Promise<ApiResponse<{ message: string }>> {
    await this.authService.unlinkOAuthAccount(req.user.id, provider);
    return {
      data: { message: 'Account unlinked successfully' },
      message: 'Account unlinked successfully',
    };
  }
}
