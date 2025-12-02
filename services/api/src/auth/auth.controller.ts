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
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { CharacterSelectionDto } from './dto/character-selection.dto';
import { FandomQuizDto } from './dto/fandom-quiz.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { LocalAuthGuard } from '../common/guards/local-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse, AuthResponse, User } from '@hos-marketplace/shared-types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto): Promise<ApiResponse<AuthResponse>> {
    const result = await this.authService.register(registerDto);
    return {
      data: result,
      message: 'User registered successfully',
    };
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Request() req: any): Promise<ApiResponse<AuthResponse>> {
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
