import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { CharacterSelectionDto } from './dto/character-selection.dto';
import { FandomQuizDto } from './dto/fandom-quiz.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { LocalAuthGuard } from '../common/guards/local-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AdminSellersService } from '../admin/sellers.service';
import type { ApiResponse, AuthResponse, User } from '@hos-marketplace/shared-types';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly adminSellersService: AdminSellersService,
  ) {}

  @Public()
  @Get('invitation')
  async validateInvitation(@Query('token') token: string): Promise<ApiResponse<any>> {
    const invitation = await this.adminSellersService.getInvitationByToken(token);
    return {
      data: {
        email: invitation.email,
        sellerType: invitation.sellerType,
        expiresAt: invitation.expiresAt,
      },
      message: 'Invitation is valid',
    };
  }

  @Public()
  @Post('accept-invitation')
  @HttpCode(HttpStatus.CREATED)
  async acceptInvitation(
    @Body() body: { token: string; registerDto: RegisterDto },
    @Request() req: any,
  ): Promise<ApiResponse<AuthResponse>> {
    // Get IP address for country detection
    const ipAddress =
      req.headers['x-forwarded-for']?.split(',')[0] ||
      req.headers['x-real-ip'] ||
      req.ip ||
      req.connection.remoteAddress;

    const result = await this.authService.acceptInvitation(
      body.token,
      body.registerDto,
      ipAddress,
    );
    return {
      data: result,
      message: 'Invitation accepted and account created successfully',
    };
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() registerDto: RegisterDto,
    @Request() req: any,
  ): Promise<ApiResponse<AuthResponse>> {
    // Get IP address for country detection
    const ipAddress =
      req.headers['x-forwarded-for']?.split(',')[0] ||
      req.headers['x-real-ip'] ||
      req.ip ||
      req.connection.remoteAddress;

    const result = await this.authService.register(registerDto, ipAddress);
    return {
      data: result,
      message: 'User registered successfully',
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<ApiResponse<AuthResponse>> {
    const result = await this.authService.login(loginDto);
    return {
      data: result,
      message: 'Login successful',
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(): Promise<ApiResponse<{ message: string }>> {
    return {
      data: { message: 'Logged out successfully' },
      message: 'Logout successful',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser() user: any): Promise<ApiResponse<User>> {
    return {
      data: user as User,
      message: 'User profile retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('select-character')
  @HttpCode(HttpStatus.OK)
  async selectCharacter(
    @Request() req: any,
    @Body() dto: CharacterSelectionDto,
  ): Promise<ApiResponse<{ message: string }>> {
    await this.authService.selectCharacter(req.user.id, dto.characterId, dto.favoriteFandoms);
    return {
      data: { message: 'Character selected successfully' },
      message: 'Character selected successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('fandom-quiz')
  @HttpCode(HttpStatus.OK)
  async completeFandomQuiz(
    @Request() req: any,
    @Body() dto: FandomQuizDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.authService.completeFandomQuiz(req.user.id, dto);
    return {
      data: result,
      message: 'Fandom quiz completed successfully',
    };
  }
}
