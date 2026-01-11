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
import { ApiTags, ApiOperation, ApiResponse as SwaggerApiResponse, ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Validate invitation token', description: 'Validates a seller invitation token and returns invitation details' })
  @ApiQuery({ name: 'token', required: true, type: String, description: 'Invitation token' })
  @SwaggerApiResponse({ status: 200, description: 'Invitation is valid' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid or expired token' })
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
  @ApiOperation({ summary: 'Accept seller invitation', description: 'Accepts a seller invitation and creates a new account' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['token', 'registerDto'],
      properties: {
        token: { type: 'string', description: 'Invitation token' },
        registerDto: { type: 'object', description: 'Registration data' },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Invitation accepted and account created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid token or registration data' })
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
  @SwaggerApiResponse({ status: 201, description: 'User registered successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid input data' })
  @SwaggerApiResponse({ status: 409, description: 'User already exists' })
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
  @SwaggerApiResponse({ status: 200, description: 'Login successful' })
  @SwaggerApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto): Promise<ApiResponse<AuthResponse>> {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.controller.ts:122',message:'Login controller entry',data:{email:loginDto.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    try {
      const result = await this.authService.login(loginDto);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.controller.ts:124',message:'Login controller success',data:{hasToken:!!result.token,hasUser:!!result.user},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      return {
        data: result,
        message: 'Login successful',
      };
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.controller.ts:128',message:'Login controller error',data:{errorMessage:error?.message,errorName:error?.name,errorStatus:error?.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      throw error;
    }
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token', description: 'Refresh an access token using a refresh token' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['refreshToken'],
      properties: {
        refreshToken: { type: 'string', description: 'Refresh token' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout user', description: 'Logout user and revoke all refresh tokens' })
  @SwaggerApiResponse({ status: 200, description: 'Logout successful' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user profile', description: 'Retrieve the authenticated user profile' })
  @SwaggerApiResponse({ status: 200, description: 'User profile retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@CurrentUser() user: any): Promise<ApiResponse<User>> {
    return {
      data: user as User,
      message: 'User profile retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('select-character')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Select character', description: 'Select a character and favorite fandoms for the user' })
  @ApiBody({ type: CharacterSelectionDto })
  @SwaggerApiResponse({ status: 200, description: 'Character selected successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid character or fandoms' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Complete fandom quiz', description: 'Complete the fandom quiz for personalized recommendations' })
  @ApiBody({ type: FandomQuizDto })
  @SwaggerApiResponse({ status: 200, description: 'Fandom quiz completed successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid quiz data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
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
