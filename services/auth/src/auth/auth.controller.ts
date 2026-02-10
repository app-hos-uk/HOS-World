import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { CharacterSelectionDto } from './dto/character-selection.dto';
import { FandomQuizDto } from './dto/fandom-quiz.dto';
import { Public, GatewayAuthGuard, CurrentUser } from '@hos-marketplace/auth-common';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @SwaggerApiResponse({ status: 201, description: 'User registered successfully' })
  @SwaggerApiResponse({ status: 409, description: 'User already exists' })
  async register(@Body() registerDto: RegisterDto, @Request() req: any) {
    const ipAddress =
      req.headers['x-forwarded-for']?.split(',')[0] ||
      req.headers['x-real-ip'] ||
      req.ip ||
      req.connection?.remoteAddress;

    const result = await this.authService.register(registerDto, ipAddress);
    return { data: result, message: 'User registered successfully' };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiBody({ type: LoginDto })
  @SwaggerApiResponse({ status: 200, description: 'Login successful' })
  @SwaggerApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);
    return { data: result, message: 'Login successful' };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @SwaggerApiResponse({ status: 200, description: 'Token refreshed' })
  @SwaggerApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Body() body: { refreshToken: string }) {
    const result = await this.authService.refresh(body.refreshToken);
    return { data: result, message: 'Token refreshed successfully' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(GatewayAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout user' })
  @SwaggerApiResponse({ status: 200, description: 'Logout successful' })
  async logout(@Request() req: any) {
    await this.authService.revokeAllTokens(req.user.id);
    return { data: { message: 'Logged out successfully' }, message: 'Logout successful' };
  }

  @UseGuards(GatewayAuthGuard)
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user profile' })
  @SwaggerApiResponse({ status: 200, description: 'User profile retrieved' })
  async getProfile(@CurrentUser() user: any) {
    return { data: user, message: 'User profile retrieved successfully' };
  }

  @UseGuards(GatewayAuthGuard)
  @Post('select-character')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Select character' })
  @ApiBody({ type: CharacterSelectionDto })
  async selectCharacter(@Request() req: any, @Body() dto: CharacterSelectionDto) {
    await this.authService.selectCharacter(req.user.id, dto.characterId, dto.favoriteFandoms);
    return { data: { message: 'Character selected successfully' }, message: 'Character selected successfully' };
  }

  @UseGuards(GatewayAuthGuard)
  @Post('fandom-quiz')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Complete fandom quiz' })
  @ApiBody({ type: FandomQuizDto })
  async completeFandomQuiz(@Request() req: any, @Body() dto: FandomQuizDto) {
    const result = await this.authService.completeFandomQuiz(req.user.id, dto);
    return { data: result, message: 'Fandom quiz completed successfully' };
  }

  @UseGuards(GatewayAuthGuard)
  @Get('oauth/accounts')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get linked OAuth accounts' })
  async getLinkedAccounts(@Request() req: any) {
    const accounts = await this.authService.getLinkedAccounts(req.user.id);
    return { data: accounts, message: 'Linked accounts retrieved' };
  }

  @UseGuards(GatewayAuthGuard)
  @Post('oauth/unlink')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Unlink OAuth account' })
  async unlinkOAuth(@Request() req: any, @Body() body: { provider: string }) {
    await this.authService.unlinkOAuthAccount(req.user.id, body.provider);
    return { data: null, message: `${body.provider} account unlinked` };
  }
}
