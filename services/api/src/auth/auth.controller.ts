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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
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

@ApiTags('auth')
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
  @ApiOperation({ summary: 'Register a new user', description: 'Create a new user account with email and password' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'User already exists' })
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
  @ApiOperation({ summary: 'Login user', description: 'Authenticate user with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto): Promise<ApiResponse<AuthResponse>> {
    const result = await this.authService.login(loginDto);
    return {
      data: result,
      message: 'Login successful',
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: { refreshToken: string }): Promise<ApiResponse<AuthResponse>> {
    const result = await this.authService.refresh(body.refreshToken);
    return {
      data: result,
      message: 'Token refreshed successfully',
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(@Request() req: any): Promise<ApiResponse<{ message: string }>> {
    // Revoke all refresh tokens for this user
    await this.authService.revokeAllTokens(req.user.id);
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
